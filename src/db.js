import { toValues } from './utils.js';
import { parse } from './parsers.js';
import { mapOne, mapMany } from './map.js';
import { makeClient } from './proxy.js';
import { processQuery } from './symbols.js';
import { process, toSql } from './tables.js';
import toMigration from './migrate.js';

const dbTypes = {
  integer: true,
  int: true,
  real: true,
  text: true,
  blob: true,
  any: true
}

class Database {
  constructor() {
    this.write = null;
    this.tables = {};
    this.mappers = {};
    this.customTypes = {};
    this.columns = {};
    this.hasJson = {};
    this.computed = {};
    this.schema = [];
    this.statements = new Map();
    this.virtualSet = new Set();
    this.closed = false;
    this.initialized = false;
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
        name: 'date',
        valueTest: (v) => v instanceof Date,
        dbToJs: (v) => new Date(v),
        jsToDb: (v) => v.toISOString(),
        dbType: 'text'
      },
      {
        name: 'json',
        valueTest: (v) => Object.getPrototypeOf(v) === Object.prototype || Array.isArray(v),
        dbToJs: (v) => JSON.parse(v),
        jsToDb: (v) => JSON.stringify(v),
        dbType: 'blob'
      }
    ]);
  }

  getClient(schema) {
    const classes = Object.values(schema);
    for (const type of classes) {
      const table = process(type);
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

  migrate() {
    return;
  }

  addTables() {
    for (const table of this.schema) {
      if (table.type === 'fts5') {
        this.virtualSet.add(table.name);
      }
      this.tables[table.name] = table.columns;
      this.columns[table.name] = {};
      this.computed[table.name] = {};
      this.hasJson[table.name] = false;
      const columns = [...table.columns, ...table.computed];
      for (const column of columns) {
        this.columns[table.name][column.name] = column.type;
        if (column.type === 'json') {
          this.hasJson[table.name] = true;
        }
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

  needsParsing(table, keys) {
    if (typeof keys === 'string') {
      keys = [keys];
    }
    for (const key of keys) {
      const type = this.columns[table][key];
      if (!dbTypes[type]) {
        return true;
      }
    }
    return false;
  }

  getPrimaryKey(table) {
    const primaryKey = this.tables[table].find(c => c.primaryKey);
    return primaryKey.name;
  }

  convertToJs(table, column, value, customFields) {
    if (value === null) {
      return value;
    }
    let type;
    if (customFields && customFields[column]) {
      type = customFields[column];
    }
    else {
      type = this.columns[table][column];
    }
    if (dbTypes[type]) {
      return value;
    }
    const customType = this.customTypes[type];
    if (customType.dbToJs) {
      return customType.dbToJs(value);
    }
    return value;
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

  basicRun() {
    return;
  }

  prepare() {
    return;
  }

  run() {
    return;
  }

  all() {
    return;
  }

  exec() {
    return;
  }

  close() {
    return;
  }
}

export default Database;
