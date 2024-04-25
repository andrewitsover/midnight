import { join, readFile } from './files.js';
import Database from './db.js';
import sqlite3 from 'sqlite3';
import { makeClient } from './proxy.js';

class SQLiteDatabase extends Database {
  constructor(props) {
    super(props);
  }

  async runMigration(name) {
    const path = join(this.migrationPath, `${name}.sql`);
    const sql = await readFile(path, 'utf8');
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

  async createDatabase(options) {
    const serialize = options ? options.serialize : false;
    const db = new sqlite3.Database(this.dbPath);
    if (serialize) {
      db.serialize();
    }
    await this.enableForeignKeys(db);
    if (this.extensions) {
      if (typeof this.extensions === 'string') {
        await this.loadExtension(this.extensions, db);
      }
      else {
        for (const extension of this.extensions) {
          await this.loadExtension(extension, db);
        }
      }
    }
    this.databases.push(db);
    return db;
  }

  async getTransaction() {
    const db = this.pool.pop();
    if (!db) {
      if (this.databases.length < this.poolSize) {
        const db = await this.createDatabase({ serialize: true });
        const tx = { name: `tx${this.databases.length}`, db };
        const client = makeClient(this, this.sqlPath, tx);
        return client;
      }
      await wait();
      return this.getTransaction();
    }
    return db;
  }

  async loadExtension(path, db) {
    return new Promise((resolve, reject) => {
      db.loadExtension(path, (err) => {
        if (err) {
          reject(err);
        }
        else {
          resolve();
        }
      });
    });
  }

  async basicRun(sql, tx) {
    const db = tx ? tx.db : this.write;
    return new Promise((resolve, reject) => {
      db.run(sql, undefined, function (err) {
        if (err) {
          reject(err);
        }
        else {
          resolve();
        }
      });
    });
  }

  async basicAll(sql, tx) {
    const db = tx ? tx : this.write;
    return new Promise((resolve, reject) => {
      db.all(sql, undefined, function (err, rows) {
        if (err) {
          reject(err);
        }
        else {
          resolve(rows);
        }
      });
    });
  }

  async prepare(sql, db) {
    return new Promise((resolve, reject) => {
      const statement = db.prepare(sql, (err) => {
        if (err) {
          reject(err);
        }
        else {
          this.prepared.push(statement);
          resolve(statement);
        }
      });
    });
  }

  async finalize(statement) {
    return new Promise((resolve) => {
      statement.finalize(() => resolve());
    });
  }

  async run(props) {
    let { query, params, options, tx, adjusted } = props;
    if (params === null) {
      params = undefined;
    }
    if (params !== undefined && !adjusted) {
      params = this.adjust(params);
    }
    const db = tx ? tx.db : this.write;
    if (typeof query === 'string') {
      const statementKey = tx ? tx.name : 'write';
      let statements = this.statements.get(statementKey);
      const cached = statements ? statements.get(query) : undefined;
      if (cached) {
        query = cached;
      }
      else {
        if (!statements) {
          statements = new Map();
          this.statements.set(statementKey, statements);
        }
        const statement = await this.prepare(query, db);
        statements.set(query, statement);
        query = statement;
      }
    }
    return new Promise((resolve, reject) => {
      query.run(params, function (err) {
        if (err) {
          reject(err);
        }
        else {
          resolve();
        }
      });
    });
  }

  async all(props) {
    let { query, params, options, tx, write, adjusted } = props;
    if (params === null) {
      params = undefined;
    }
    if (params !== undefined && !adjusted) {
      params = this.adjust(params);
    }
    const client = tx ? tx.db : (write ? this.write : this.read);
    if (typeof query === 'string') {
      const key = query;
      const statementKey = tx ? tx.name : (write ? 'write' : 'read');
      let statements = this.statements.get(statementKey);
      const cached = statements ? statements.get(key) : undefined;
      if (cached) {
        query = cached;
      }
      else {
        if (!statements) {
          statements = new Map();
          this.statements.set(statementKey, statements);
        }
        const statement = await this.prepare(query, client);
        statements.set(key, statement);
        query = statement;
      }
    }
    const process = this.process;
    return new Promise((resolve, reject) => {
      query.all(params, function (err, rows) {
        if (err) {
          reject(err);
        }
        else {
          const result = process(rows, options);
          resolve(result);
        }
      });
    });
  }

  async exec(sql) {
    return new Promise((resolve, reject) => {
      this.write.exec(sql, function (err) {
        if (err) {
          reject(err);
        }
        else {
          resolve();
        }
      });
    });
  }

  async close() {
    if (this.closed) {
      return;
    }
    const makePromise = (db) => {
      return new Promise((resolve, reject) => {
        db.close(function (err) {
          if (err) {
            reject(err);
          }
          else {
            resolve();
          }
        });
      });
    }
    const finalizePromises = this.prepared.map(statement => this.finalize(statement));
    await Promise.all(finalizePromises);
    const promises = this.databases.map(db => makePromise(db));
    await Promise.all(promises);
    this.closed = true;
  }
}

export default SQLiteDatabase;
