import Database from './db.js';
import sqlite3 from 'better-sqlite3';
import { makeClient } from './proxy.js';
import { existsSync } from 'fs';

const isEmpty = (params) => {
  if (params === undefined) {
    return true;
  }
  return Object.keys(params).length === 0;
}

class SQLiteDatabase extends Database {
  constructor(path, options = {}) {
    super();
    this.path = path;
    this.permanent = path && !path.includes(':memory:') ? true : false;
    this.sqlite3 = sqlite3;
    this.extensions = options.extensions;
    this.db = null;
    this.lock = null;
    this.created = false;
  }

  async getWriteLock() {
    let next;
    while (true) {
      if (!this.lock) {
        next = Promise.withResolvers();
        this.lock = next.promise;
        break;
      }
      await this.lock;
    }
    return {
      release: () => {
        this.lock = null;
        next.resolve();
      }
    }
  }

  async initialize() {
    if (this.initialized) {
      return;
    }
    const exists = this.permanent && existsSync(this.path);
    this.db = await this.createDatabase();
    if (!exists) {
      this.created = true;
      if (this.permanent) {
        await this.pragma('journal_mode=WAL');
      }
    }
    this.initialized = true;
  }

  async migrate(sql) {
    if (!this.initialized) {
      await this.initialize();
    }
    const tx = await this.begin();
    try {
      await tx.deferForeignKeys();
      await tx.exec(sql);
      await tx.commit();
    }
    catch (e) {
      await tx.rollback();
      throw e;
    }
  }

  async createDatabase() {
    const db = new this.sqlite3(this.path);
    await this.enableForeignKeys(db);
    const extensions = this.extensions;
    if (extensions) {
      if (typeof extensions === 'string') {
        await this.loadExtension(extensions, db);
      }
      else {
        for (const extension of extensions) {
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
  
  async loadExtension(path, db) {
    db.loadExtension(path);
  }

  async pragma(sql) {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.db.pragma(sql);
  }

  async begin(type) {
    if (type && !['deferred', 'immediate'].includes(type)) {
      throw Error(`Invalid transaction type: ${type}`);
    }
    if (!this.initialized) {
      await this.initialize();
    }
    const lock = await this.getWriteLock();
    const tx = { lock };
    const sql = type ? `begin ${type}` : 'begin';
    await this.basicRun(sql, tx);
    return makeClient(this, tx);
  }

  async commit(tx) {
    await this.basicRun('commit', tx);
    tx.lock.release();
  }

  async rollback(tx) {
    await this.basicRun('rollback', tx);
    tx.lock.release();
  }

  async getError(sql) {
    return this.db.prepare(sql);
  }

  async basicRun(sql, tx) {
    if (!this.initialized) {
      await this.initialize();
    }
    const statement = this.db.prepare(sql);
    let lock;
    if (!tx) {
      lock = await this.getWriteLock();
    }
    statement.run();
    if (lock) {
      lock.release();
    }
  }

  async basicAll(sql) {
    if (!this.initialized) {
      await this.initialize();
    }
    const statement = this.db.prepare(sql);
    return statement.all();
  }

  async insertBatch(inserts) {
    if (!this.initialized) {
      await this.initialize();
    }
    const lock = await this.getWriteLock();
    const inserted = this.db.transaction(() => {
      for (const insert of inserts) {
        const { query, params } = insert;
        const statement = this.db.prepare(query);
        statement.run(params);
      }
    });
    inserted();
    lock.release();
  }

  async batch(type, handler) {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!handler) {
      handler = type;
    }
    const client = makeClient(this, { isBatch: true });
    const promises = handler(client).flat();
    const handlers = await Promise.all(promises);
    const result = this.db.transaction(() => {
      const responses = [];
      const flat = handlers.flat();
      for (const handler of flat) {
        const { statement, params, post } = handler;
        const run = post ? 'all' : 'run';
        let response = isEmpty(params) ? statement[run]() : statement[run](params);
        if (post) {
          response = post(response);
        }
        responses.push(response);
      }
      return responses;
    });
    return result();
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
    if (typeof query === 'string') {
      const key = query + 'write';
      const cached = this.statements.get(key);
      if (cached) {
        query = cached;
      }
      else {
        const statement = this.db.prepare(query);
        this.statements.set(key, statement);
        query = statement;
      }
    }
    if (tx && tx.isBatch) {
      return {
        statement: query,
        params
      };
    }
    let lock;
    if (!tx) {
      lock = await this.getWriteLock();
    }
    const result = isEmpty(params) ? query.run() : query.run(params);
    if (lock) {
      lock.release();
    }
    return result.changes;
  }

  async all(props) {
    if (!this.initialized) {
      await this.initialize();
    }
    let { query, params, options, tx, write, adjusted } = props;
    if (params === null) {
      params = undefined;
    }
    if (params !== undefined && !adjusted) {
      params = this.adjust(params);
    }
    if (typeof query === 'string') {
      const cached = this.statements.get(query);
      if (cached) {
        query = cached;
      }
      else {
        let statement;
        try {
          statement = this.db.prepare(query);
        }
        catch (e) {
          const message = `query: ${query} had the error: ${e}`;
          throw Error(message);
        }
        this.statements.set(query, statement);
        query = statement;
      }
    }
    const process = this.process;
    if (tx && tx.isBatch) {
      return {
        statement: query,
        params,
        post: (rows) => this.process(rows, options)
      };
    }
    let lock;
    if (!tx && write) {
      lock = await this.getWriteLock();
    }
    const rows = isEmpty(params) ? query.all() : query.all(params);
    if (lock) {
      lock.release();
    }
    return process(rows, options);
  }

  async exec(tx, sql) {
    if (!this.initialized) {
      await this.initialize();
    }
    let lock;
    if (!tx) {
      lock = await this.getWriteLock();
    }
    this.db.exec(sql);
    if (lock) {
      lock.release();
    }
  }

  async close() {
    if (this.closed || !this.initialized) {
      return;
    }
    this.db.close();
    this.closed = true;
  }
}

export default SQLiteDatabase;
