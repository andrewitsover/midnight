import Database from './db.js';
import { makeClient } from './proxy.js';

const wait = async () => {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(), 100);
  });
}

const isEmpty = (params) => {
  if (params === undefined) {
    return true;
  }
  return Object.keys(params).length === 0;
}

class SQLiteDatabase extends Database {
  constructor(props) {
    const supports = {
      jsonb: true,
      migrations: true
    };
    super({ ...props, supports });
    this.dbPath = props.db;
    this.extensionsPath = props.extensions;
    this.adaptor = props.adaptor;
    this.sqlPath = props.sql;
    this.viewsPath = props.views;
    this.tablesPath = props.tables;
    this.extensionsPath = props.extensions;
    this.isBusy = false;
  }

  async getWriter() {
    if (!this.isBusy) {
      this.isBusy = true;
      return;
    }
    await wait();
    return this.getWriter();
  }

  async initialize() {
    if (this.initialized) {
      return;
    }
    this.read = await this.createDatabase();
    this.write = await this.createDatabase();
    await this.setTables();
    await this.setVirtual();
    await this.setViews();
    this.initialized = true;
  }

  async readQuery(table, queryName) {
    const path = this.adaptor.join(this.sqlPath, table, `${queryName}.sql`);
    return await this.adaptor.readFile(path, 'utf8');
  }

  async readTables() {
    return await this.adaptor.readSql(this.tablesPath);
  }

  async readViews() {
    return await this.adaptor.readSql(this.viewsPath);
  }

  async runMigration(sql) {
    try {
      await this.begin();
      await this.deferForeignKeys();
      await this.exec(sql);
      await this.commit();
    }
    catch (e) {
      await this.rollback();
      throw e;
    }
  }

  async createDatabase() {
    const db = new this.adaptor.sqlite3(this.dbPath);
    await this.enableForeignKeys(db);
    if (this.extensionsPath) {
      if (typeof this.extensionsPath === 'string') {
        await this.loadExtension(this.extensionsPath, db);
      }
      else {
        for (const extension of this.extensionsPath) {
          await this.loadExtension(extension, db);
        }
      }
    }
    return db;
  }

  async enableForeignKeys(db) {
    db.pragma('foreign_keys = on');
  }

  async deferForeignKeys() {
    await this.pragma('defer_foreign_keys = true');
  }

  async getTransaction() {
    if (!this.initialized) {
      await this.initialize();
    }
    await this.getWriter();
    const tx = { db: this.writer };
    return makeClient(this, tx);
  }

  async loadExtension(path, db) {
    db.loadExtension(path);
  }

  async pragma(sql) {
    this.read.pragma(sql);
  }

  async begin(tx) {
    await this.basicRun('begin', tx);
  }

  async commit(tx) {
    await this.basicRun('commit', tx);
  }

  async rollback(tx) {
    await this.basicRun('rollback', tx);
  }

  async getError(sql) {
    return this.read.prepare(sql);
  }

  async basicRun(sql, tx) {
    if (!tx && !this.initialized) {
      await this.initialize();
    }
    if (!tx) {
      await this.getWriter();
    }
    const db = tx ? this.write : this.read;
    const statement = db.prepare(sql);
    statement.run();
    if (!tx) {
      this.isBusy = false;
    }
  }

  async basicAll(sql, tx) {
    if (!tx && !this.initialized) {
      await this.initialize();
    }
    const db = tx ? this.write : this.read;
    const statement = db.prepare(sql);
    return statement.all();
  }

  release() {
    this.isBusy = false;
  }

  async run(props) {
    if (!this.initialized) {
      await this.initialize();
    }
    let { query, params, tx, adjusted } = props;
    if (params === null) {
      params = undefined;
    }
    if (params !== undefined && !adjusted) {
      params = this.adjust(params);
    }
    if (!tx) {
      await this.getWriter();
    }
    const db = this.write;
    if (typeof query === 'string') {
      const cached = this.statements.get(query);
      if (cached) {
        query = cached;
      }
      else {
        const statement = await db.prepare(query);
        this.statements.set(query, statement);
        query = statement;
      }
    }
    const result = isEmpty(params) ? query.run() : query.run(params);
    if (!tx) {
      this.isBusy = false;
    }
    return result.changes;
  }

  async all(props) {
    if (!this.initialized) {
      await this.initialize();
    }
    let { query, params, options, tx, write, adjusted } = props;
    const needsWriter = !tx && write;
    if (needsWriter) {
      await this.getWriter();
    }
    if (params === null) {
      params = undefined;
    }
    if (params !== undefined && !adjusted) {
      params = this.adjust(params);
    }
    const client = (tx || write) ? this.write : this.read;
    if (typeof query === 'string') {
      const key = query;
      const cached = this.statements.get(key);
      if (cached) {
        query = cached;
      }
      else {
        const statement = await client.prepare(query);
        this.statements.set(key, statement);
        query = statement;
      }
    }
    const process = this.process;
    const rows = isEmpty(params) ? query.all() : query.all(params);
    if (needsWriter) {
      this.isBusy = false;
    }
    return process(rows, options);
  }

  async exec(sql) {
    if (!this.initialized) {
      await this.initialize();
    }
    this.write.exec(sql);
  }

  async close() {
    if (this.closed) {
      return;
    }
    this.read.close();
    this.write.close();
    this.closed = true;
  }
}

export default SQLiteDatabase;
