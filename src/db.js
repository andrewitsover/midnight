import { toValues } from './utils.js';
import { parse } from './parsers.js';
import { mapOne, mapMany } from './map.js';
import { makeClient } from './proxy.js';
import { processQuery } from './symbols.js';
import { process } from './tables.js';

const dbTypes = {
  integer: true,
  int: true,
  real: true,
  text: true,
  blob: true,
  any: true
}

const typeMap = {
  integer: 'number',
  real: 'number',
  text: 'string',
  blob: 'Buffer',
  any: 'number | string | Buffer'
}

class Database {
  constructor() {
    this.read = null;
    this.write = null;
    this.transact = null;
    this.tables = {};
    this.mappers = {};
    this.customTypes = {};
    this.columns = {};
    this.hasJson = {};
    this.computed = {};
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
        tsType: 'boolean',
        dbType: 'integer'
      },
      {
        name: 'date',
        valueTest: (v) => v instanceof Date,
        dbToJs: (v) => new Date(v),
        jsToDb: (v) => v.toISOString(),
        tsType: 'Date',
        dbType: 'text'
      },
      {
        name: 'json',
        valueTest: (v) => Object.getPrototypeOf(v) === Object.prototype || Array.isArray(v),
        dbToJs: (v) => JSON.parse(v),
        jsToDb: (v) => JSON.stringify(v),
        tsType: 'Json',
        dbType: 'blob'
      }
    ]);
  }

  getClient(schema) {
    const classes = Object.values(schema);
    const tables = [];
    for (const type of classes) {
      const table = process(type, classes);
      tables.push(table);
    }
    this.addTables(tables);
    return makeClient(this);
  }

  subquery(expression) {
    return processQuery(this, expression);
  }

  async query(expression, tx, first) {
    const { sql, params, post } = processQuery(this, expression, first);
    const options = {
      query: sql,
      params,
      tx
    };
    if (tx && tx.isBatch) {
      const result = await this.all(options);
      return {
        statement: result.statement,
        params: result.params,
        post: (meta) => {
          const response = result.post(meta);
          return post(response);
        }
      }
    }
    const rows = await this.all(options);
    return post(rows);
  }

  async runMigration() {
    return;
  }

  addTables(tables) {
    for (const table of tables) {
      if (table.type === 'virtual') {
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
      if (options.dbType && !options.tsType) {
        options.tsType = typeMap[options.dbType];
      }
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
    const adjusted = {};
    for (let [key, value] of Object.entries(params)) {
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

  async basicRun() {
    return;
  }

  async basicAll() {
    return;
  }

  async prepare() {
    return;
  }

  async run() {
    return;
  }

  async all() {
    return;
  }

  async exec() {
    return;
  }

  async close() {
    return;
  }
}

export default Database;
