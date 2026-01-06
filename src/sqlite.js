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
    this.path = path;
    this.sqlite3 = sqlite3;
    this.extensions = options.extensions;
    this.db = this.createDatabase();
    this.lock = null;
  }

  async getLock() {
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

  async migrate(sql) {
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

  createDatabase() {
    const db = new this.sqlite3(this.path);
    db.pragma('foreign_keys = on');
    const extensions = this.extensions;
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

  async deferForeignKeys() {
    await this.pragma('defer_foreign_keys = true');
  }

  async pragma(sql) {
    return this.db.pragma(sql);
  }

  async begin(type) {
    if (type && !['deferred', 'immediate'].includes(type)) {
      throw Error(`invalid transaction type: ${type}`);
    }
    const lock = await this.getLock();
    const tx = { lock };
    const sql = type ? `begin ${type}` : 'begin';
    await this.basicRun(sql, tx);
    return makeClient(this, tx);
  }

  async commit(tx) {
    try {
      await this.basicRun('commit', tx);
    }
    finally {
      tx.lock.release();
    }
  }

  async rollback(tx) {
    try {
      await this.basicRun('rollback', tx);
    }
    finally {
      tx.lock.release();
    }
  }

  async getError(sql) {
    return this.db.prepare(sql);
  }

  async basicRun(sql, tx) {
    const statement = this.db.prepare(sql);
    let lock;
    if (!tx) {
      lock = await this.getLock();
    }
    try {
      statement.run();
    }
    finally {
      if (lock) {
        lock.release();
      }
    }
  }

  async insertBatch(inserts) {
    const lock = await this.getLock();
    try {
      const inserted = this.db.transaction(() => {
        for (const insert of inserts) {
          const { query, params } = insert;
          const statement = this.db.prepare(query);
          statement.run(params);
        }
      });
      inserted();
    }
    finally {
      lock.release();
    }
  }

  async batch(type, handler) {
    if (!handler) {
      handler = type;
    }
    const client = makeClient(this, { isBatch: true });
    const promises = handler(client).flat();
    const handlers = await Promise.all(promises);
    const lock = await this.getLock();
    try {
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
    finally {
      lock.release();
    }
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

  async run(props) {
    let { query, params, tx, adjusted } = props;
    if (params === null) {
      params = undefined;
    }
    if (!adjusted) {
      params = this.adjust(params);
    }
    const statement = this.cache(query);
    if (tx && tx.isBatch) {
      return {
        statement,
        params
      };
    }
    let lock;
    if (!tx) {
      lock = await this.getLock();
    }
    try {
      const result = isEmpty(params) ? statement.run() : statement.run(params);
      return result.changes;
    }
    finally {
      if (lock) {
        lock.release();
      }
    }
  }

  async all(props) {
    let { query, params, options, tx, adjusted } = props;
    if (params === null) {
      params = undefined;
    }
    if (!adjusted) {
      params = this.adjust(params);
    }
    const statement = this.cache(query);
    const process = this.process;
    if (tx && tx.isBatch) {
      return {
        statement,
        params,
        post: (rows) => this.process(rows, options)
      };
    }
    let lock;
    if (!tx) {
      lock = await this.getLock();
    }
    try {
      const rows = isEmpty(params) ? statement.all() : statement.all(params);
      return process(rows, options);
    }
    finally {
      if (lock) {
        lock.release();
      }
    }
  }

  async exec(sql, tx) {
    let lock;
    if (!tx) {
      lock = await this.getLock();
    }
    try {
      this.db.exec(sql);
    }
    finally {
      if (lock) {
        lock.release();
      }
    }
  }

  async close() {
    if (this.closed) {
      return;
    }
    this.db.close();
    this.closed = true;
  }
}

export default SQLiteDatabase;
