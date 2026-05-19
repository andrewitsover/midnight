import { makeClient } from './proxy.js';
import { temporal, removeCapital } from './utils.js';
import { parse } from './parsers.js';
import { processQuery } from './symbols.js';
import { process, toSql, toHash, Table } from './tables.js';
import toMigration from './migrate.js';
import { DatabaseSync } from 'node:sqlite';
import functions from './functions.js';

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
    this.lambdas = {};
    this.columns = {};
    this.computed = {};
    this.notNull = {};
    this.foreignKeys = {};
    this.schema = [];
    this.statements = new Map();
    this.virtualSet = new Set();
    this.closed = false;
    const dateTypes = temporal.map(type => {
      return {
        name: removeCapital(type.name),
        valueTest: (v) => v instanceof type,
        dbToJs: (v) => type.from(v),
        jsToDb: (v) => v.toString(),
        dbType: 'text'
      }
    });
    this.registerTypes([
      {
        name: 'boolean',
        valueTest: (v) => typeof v === 'boolean',
        makeConstraint: (column) => `check (${column} in (0, 1))`,
        dbToJs: (v) => Boolean(v),
        jsToDb: (v) => v === true ? 1 : 0,
        dbType: 'integer'
      },
      {
        name: 'json',
        valueTest: (v) => Object.getPrototypeOf(v) === Object.prototype || Array.isArray(v),
        dbToJs: (v) => JSON.parse(v),
        jsToDb: (v) => JSON.stringify(v),
        dbType: 'blob'
      },
      {
        name: 'bigInt',
        dbType: 'integer'
      },
      ...dateTypes
    ]);
    if (path) {
      this.db = new DatabaseSync(path, options);
      for (const item of functions) {
        this.db.function(item.name, { deterministic: true }, item.lambda);
      }
    }
  }

  get inTransaction() {
    return this.db.isTransaction;
  }

  createFunction(args) {
    const { returnType, options, lambda } = args;
    const name = toHash('function', lambda.toString());
    if (options) {
      this.db.function(name, options, lambda);
    }
    else {
      this.db.function(name, lambda);
    }
    const column = Table.requests.get(returnType);
    return (...args) => {
      const request = {
        category: 'Method',
        subcategory: 'User-Defined Function',
        name,
        type: column.type,
        args,
        alias: null,
        column
      };
      const symbol = Symbol();
      Table.requests.set(symbol, request);
      return symbol;
    }
  }

  getClient(schema) {
    const classTable = {};
    const entries = Object.entries(schema);
    for (const [key, type] of entries) {
      classTable[type.name] = removeCapital(key);
    }
    for (const [key, type] of entries) {
      const result = process(type, key, classTable);
      const { lambdas, ...table } = result;
      this.lambdas[table.name] = lambdas;
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
    const { sql, params, log, bigInt, post } = processQuery(this, expression, first);
    const options = {
      query: sql,
      params: this.adjust(params),
      adjusted: true,
      bigInt
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
      const { name, ...rest } = customType;
      const options = {};
      for (const key of Object.keys(rest)) {
        if (['dbToJs', 'jsToDb'].includes(key)) {
          options[key] = (v) => v === null ? null : rest[key](v);
        }
        else {
          options[key] = rest[key];
        }
      }
      this.customTypes[name] = options;
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
    if (value === undefined || value === null) {
      return { value: null };
    }
    const type = typeof value;
    if (type === 'string') {
      return {
        type: 'text',
        value
      }
    }
    if (type === 'number') {
      return {
        type: 'integer',
        value
      }
    }
    if (type === 'bigint') {
      return {
        type: 'bigint',
        value
      }
    }
    if (value instanceof Uint8Array) {
      return {
        type: 'blob',
        value
      }
    }
    else {
      for (const customType of Object.values(this.customTypes)) {
        if (customType.valueTest && customType.valueTest(value)) {
          return {
            type: customType.name,
            value: customType.jsToDb(value)
          }
        }
      }
    }
    return { value };
  }

  adjust(params) {
    if (!params) {
      return params;
    }
    const adjusted = {};
    for (const [key, value] of Object.entries(params)) {
      const result = this.jsToDb(value);
      adjusted[key] = result.value;
    }
    return adjusted;
  }

  migrate(sql) {
    this.begin();
    try {
      this.exec('pragma defer_foreign_keys = true');
      this.exec(sql);
      this.commit();
    }
    catch (e) {
      this.rollback();
      throw e;
    }
  }

  begin(type) {
    if (type && !['deferred', 'immediate'].includes(type)) {
      throw Error(`invalid transaction type: ${type}`);
    }
    const sql = type ? `begin ${type}` : 'begin';
    this.db.exec(sql);
  }

  commit() {
    this.db.exec('commit');
  }

  rollback() {
    this.db.exec('rollback');
  }

  getError(sql) {
    return this.db.prepare(sql);
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

  cache(query, bigInt) {
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
      if (bigInt) {
        statement.setReadBigInts(true);
      }
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
    let { query, params, adjusted, bigInt } = props;
    if (params === null) {
      params = undefined;
    }
    if (!adjusted) {
      params = this.adjust(params);
    }
    const statement = this.cache(query, bigInt);
    return isEmpty(params) ? statement.all() : statement.all(params);
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
