import { makeClient } from './proxy.js';
import { toValues } from './utils.js';
import { parse } from './parsers.js';
import { mapOne, mapMany } from './map.js';
import { processQuery } from './symbols.js';
import { process, removeCapital, toSql } from './tables.js';
import toMigration from './migrate.js';
import sqlite3 from 'better-sqlite3';

const dbTypes = {
  integer: true,
  int: true,
  real: true,
  text: true,
  blob: true,
  any: true
}

const isEmpty = (params) => {
  if (params === undefined) {
    return true;
  }
  return Object.keys(params).length === 0;
}

class Database {
  constructor(path, options = {}) {
    this.tables = {};
    this.mappers = {};
    this.customTypes = {};
    this.columns = {};
    this.computed = {};
    this.notNull = {};
    this.foreignKeys = {};
    this.schema = [];
    this.statements = new Map();
    this.virtualSet = new Set();
    this.closed = false;
    this.registerTypes([
      {
        name: 'boolean',
        valueTest: (v) => typeof v === 'boolean',
        makeConstraint: (column) => `check (${column} in (0, 1))`,
        dbToJs: (v) => v === null ? null : Boolean(v),
        jsToDb: (v) => v === null ? null : v === true ? 1 : 0,
        dbType: 'integer'
      },
      {
        name: 'date',
        valueTest: (v) => v instanceof Date,
        dbToJs: (v) => v === null ? null : new Date(v),
        jsToDb: (v) => v === null ? null : v.toISOString(),
        dbType: 'text'
      },
      {
        name: 'json',
        valueTest: (v) => Object.getPrototypeOf(v) === Object.prototype || Array.isArray(v),
        dbToJs: (v) => v === null ? null : JSON.parse(v),
        jsToDb: (v) => v === null ? null : JSON.stringify(v),
        dbType: 'blob'
      }
    ]);
    this.db = this.createDatabase(path, options);
  }

  getClient(schema) {
    const classTable = {};
    const entries = Object.entries(schema);
    for (const [key, type] of entries) {
      classTable[type.name] = removeCapital(key);
    }
    for (const [key, type] of entries) {
      const table = process(type, key, classTable);
      this.schema.push(table);
    }
    this.addTables();
    return makeClient(this);
  }

  getSchema() {
    return structuredClone(this.schema);
  }

  diff(previous) {
    const current = this.getSchema();
    if (!previous) {
      const statements = [];
      for (const table of current) {
        const sql = toSql(table);
        statements.push(sql);
      }
      return statements.join('\n');
    }
    return toMigration(previous, current);
  }

  subquery(expression) {
    return processQuery(this, expression);
  }

  query(expression, first) {
    const { sql, params, log, post } = processQuery(this, expression, first);
    const options = {
      query: sql,
      params: this.adjust(params),
      adjusted: true
    };
    let rows;
    if (log) {
      const start = Date.now();
      rows = this.all(options);
      const data = {
        sql,
        params,
        durationMs: Date.now() - start
      };
      if (typeof log === 'boolean') {
        console.log(data);
      }
      else {
        log(data);
      }
    }
    else {
      rows = this.all(options);
    }
    return post(rows);
  }

  addTables() {
    for (const table of this.schema) {
      if (table.type === 'fts5') {
        this.virtualSet.add(table.name);
      }
      this.tables[table.name] = table.columns;
      this.columns[table.name] = {};
      this.computed[table.name] = {};
      this.notNull[table.name] = {};
      this.foreignKeys[table.name] = table.foreignKeys;
      const columns = [...table.columns, ...table.computed];
      for (const column of columns) {
        this.columns[table.name][column.name] = column.type;
        this.notNull[table.name][column.name] = column.notNull;
      }
      for (const computed of table.computed) {
        this.computed[table.name][computed.name] = computed.sql;
      }
    }
  }

  registerTypes(customTypes) {
    for (const customType of customTypes) {
      const { name, ...options } = customType;
      if (name.includes(',')) {
        const names = name.split(',').map(n => n.trim());
        for (const name of names) {
          this.customTypes[name] = options;
        }
      }
      else {
        this.customTypes[name] = options;
      }
    }
  }

  getPrimaryKey(table) {
    const primaryKey = this.tables[table].find(c => c.primaryKey);
    return primaryKey.name;
  }

  getDbToJsConverter(type) {
    const customType = this.customTypes[type];
    if (customType) {
      return customType.dbToJs;
    }
    return null;
  }

  jsToDb(value) {
    if (value === undefined) {
      return null;
    }
    if (value === null || typeof value === 'string' || typeof value === 'number' || (typeof Buffer !== 'undefined' && Buffer.isBuffer(value))) {
      return value;
    }
    else {
      for (const customType of Object.values(this.customTypes)) {
        if (customType.valueTest && customType.valueTest(value)) {
          return customType.jsToDb(value);
        }
      }
    }
    return value;
  }

  adjust(params) {
    if (!params) {
      return params;
    }
    const adjusted = {};
    for (const [key, value] of Object.entries(params)) {
      adjusted[key] = this.jsToDb(value);
    }
    return adjusted;
  }

  process(result, options) {
    if (!options) {
      return result;
    }
    if (result.length === 0) {
      if (options.result === 'object' || options.result === 'value') {
        return undefined;
      }
      return result;
    }
    let mapper;
    if (options.result === 'object' || options.result === 'value') {
      mapper = mapOne;
    }
    else {
      mapper = mapMany;
    }
    if (options.result === 'value' || options.result === 'values') {
      if (options.parse) {
        const parsed = parse(result, options.types);
        const values = toValues(parsed);
        if (options.result === 'value') {
          return values[0];
        }
        return values;
      }
      const values = toValues(result);
      if (options.result === 'value') {
        return values[0];
      }
      return values;
    }
    if (options.parse && !options.map) {
      const parsed = parse(result, options.types);
      if (options.result === 'object') {
        return parsed[0];
      }
      return parsed;
    }
    if (options.map) {
      return mapper(this, result, options.columns, options.types);
    }
    return result;
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
    this.statements.clear();
    this.db.close();
    this.closed = true;
  }
}

export default Database;
