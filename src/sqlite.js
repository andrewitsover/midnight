import Database from './db.js';
import sqlite3 from 'better-sqlite3';
import { makeClient } from './proxy.js';

const isEmpty = (params) => {
  if (params === undefined) {
    return true;
  }
  return Object.keys(params).length === 0;
}

class SQLiteDatabase extends Database {
  constructor(path, options = {}) {
    super();
    this.db = this.createDatabase(path, options);
  }

  migrate(sql) {
    this.begin();
    try {
      this.deferForeignKeys();
      this.exec(sql);
      this.commit();
    }
    catch (e) {
      this.rollback();
      throw e;
    }
  }

  createDatabase(path, options) {
    const { extensions, ...rest } = options;
    const db = new sqlite3(path, rest);
    db.pragma('foreign_keys = on');
    if (extensions) {
      if (typeof extensions === 'string') {
        db.loadExtension(extensions);
      }
      else {
        for (const extension of extensions) {
          db.loadExtension(extension);
        }
      }
    }
    return db;
  }

  deferForeignKeys() {
    this.pragma('defer_foreign_keys = true');
  }

  pragma(sql) {
    return this.db.pragma(sql);
  }

  begin(type) {
    if (type && !['deferred', 'immediate'].includes(type)) {
      throw Error(`invalid transaction type: ${type}`);
    }
    const sql = type ? `begin ${type}` : 'begin';
    this.basicRun(sql);
  }

  commit() {
    this.basicRun('commit');
  }

  rollback() {
    this.basicRun('rollback');
  }

  getError(sql) {
    return this.db.prepare(sql);
  }

  basicRun(sql) {
    const statement = this.db.prepare(sql);
    statement.run();
  }

  insertBatch(inserts) {
    const inserted = this.db.transaction(() => {
      for (const insert of inserts) {
        const { query, params } = insert;
        const statement = this.db.prepare(query);
        statement.run(params);
      }
    });
    inserted();
  }

  cache(query) {
    if (typeof query !== 'string') {
      return query;
    }
    const cached = this.statements.get(query);
    if (cached) {
      return cached;
    }
    let statement;
    try {
      statement = this.db.prepare(query);
    }
    catch (e) {
      const message = `${e}\nQuery: ${query}`;
      throw Error(message);
    }
    this.statements.set(query, statement);
    return statement;
  }

  run(props) {
    let { query, params, adjusted } = props;
    if (params === null) {
      params = undefined;
    }
    if (!adjusted) {
      params = this.adjust(params);
    }
    const statement = this.cache(query);
    const result = isEmpty(params) ? statement.run() : statement.run(params);
    return result.changes;
  }

  all(props) {
    let { query, params, options, adjusted } = props;
    if (params === null) {
      params = undefined;
    }
    if (!adjusted) {
      params = this.adjust(params);
    }
    const statement = this.cache(query);
    const rows = isEmpty(params) ? statement.all() : statement.all(params);
    return this.process(rows, options);
  }

  exec(sql) {
    this.db.exec(sql);
  }

  close() {
    if (this.closed) {
      return;
    }
    this.db.close();
    this.closed = true;
  }
}

export default SQLiteDatabase;
