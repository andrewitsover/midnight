import { compareMethods, computeMethods } from './methods.js';
import { processArg, processMethod, toWhere } from './requests.js';
import { nameToSql, temporal, removeCapital, toLiteral } from './utils.js';
import { createHash } from 'node:crypto';

const toHash = (table, sql) => {
  table = table.replaceAll(/([a-z])([A-Z])/gm, '$1_$2').toLowerCase();
  if (typeof sql === 'object') {
    sql = Object
      .values(sql)
      .filter(v => v !== undefined)
      .join('_');
  }
  const hash = createHash('sha256')
    .update(sql)
    .digest('hex')
    .slice(0, 8);
  return `${table}_${hash}`;
}

const types = [
  'int',
  'bigInt',
  'real',
  'text',
  'blob',
  'json',
  'bool',
  ...temporal.map(t => removeCapital(t.name))
];
const modifiers = [
  ['', {}],
  ['Primary', { notNull: true, primaryKey: true }]
];

const addCapital = (name) => {
  return name.at(0).toUpperCase() + name.substring(1);
}

const toColumn = (literal) => {
  const type = typeof literal;
  let symbol;
  if (type === 'string') {
    symbol = symbols.text;
  }
  else if (type === 'number') {
    if (Number.isInteger(literal)) {
      symbol = symbols.int;
    }
    else {
      symbol = symbols.real;
    }
  }
  else if (type === 'boolean') {
    symbol = symbols.bool;
  }
  else {
    const type = temporal.find(type => literal instanceof type);
    if (type) {
      const name = removeCapital(type.name);
      symbol = symbols[name];
    }
    else {
      throw Error(`invalid default value: ${literal}`);
    }
  }
  const request = { ...tableRequests.get(symbol) };
  request.default = toLiteral(literal);
  const updated = Symbol();
  tableRequests.set(updated, request);
  return {
    symbol: updated,
    column: request
  }
}

class Unicode61 {
  name = 'unicode61';
  constructor(options) {
    if (options) {
      this.removeDiacritics = options.removeDiacritics;
      this.categories = options.categories;
      this.tokenChars = options.tokenChars;
      this.separators = options.separators;
      this.porter = options.porter;
    }
  }
}

class Ascii {
  name = 'ascii';
  constructor(options) {
    if (options) {
      this.categories = options.categories;
      this.tokenChars = options.tokenChars;
      this.separators = options.separators;
      this.porter = options.porter;
    }
  }
}

class Trigram {
  name = 'trigram';
  constructor(options) {
    if (options) {
      this.caseSensitive = options.caseSensitive;
      this.removeDiacritics = options.removeDiacritics;
      this.porter = options.porter;
    }
  }
}

const attributes = Symbol();
const prefix = Symbol();
const tokenizer = Symbol();
const externalRowId = Symbol();
const transform = Symbol();
const hasTransformed = Symbol();

const tableRequests = new WeakMap();
const classes = new WeakMap();

class BaseTable {
  [hasTransformed] = false;

  constructor() {
    return new Proxy(this, {
      get: function(target, property, receiver) {
        if (!target[hasTransformed]) {
          target[transform]();
        }
        return Reflect.get(target, property, receiver);
      }
    });
  }

  [transform]() {
    this[hasTransformed] = true;
    for (const [key, value] of Object.entries(this)) {
      if (typeof value === 'function') {
        continue;
      }
      let adjusted = value;
      if (typeof value !== 'symbol') {
        adjusted = symbols.default(value);
      }
      const request = tableRequests.get(adjusted);
      const symbol = Symbol();
      const updated = { ...request };
      this[key] = symbol;
      tableRequests.set(symbol, updated);
      classes.set(symbol, this.constructor);
    }
  }
}

const symbols = {
  nil: {
    now: {}
  },
  primary: {},
  now: {}
};

symbols.attributes = attributes;
symbols.prefix = prefix;
symbols.tokenizer = tokenizer;
symbols.externalRowId = externalRowId;

const addTypes = (target, props) => {
  for (const type of types) {
    let dbType = type;
    if (dbType === 'bool') {
      dbType = 'boolean';
    }
    else if (dbType === 'int') {
      dbType = 'integer';
    }
    const request = {
      category: 'Column',
      type: dbType,
      notNull: true,
      primaryKey: false,
      ...props
    };
    const symbol = Symbol();
    target[type] = symbol;
    tableRequests.set(symbol, request);
  }
}

addTypes(symbols);
addTypes(symbols.nil, { notNull: false });
addTypes(symbols.primary, { notNull: true, primaryKey: true });

const addNow = (target, props) => {
  const nowTypes = ['instant', 'plainDate', 'plainDateTime', 'plainTime', 'zonedDateTime'];
  for (const type of nowTypes) {
    const symbol = Symbol();
    const adjusted = type.replaceAll(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    const request = {
      category: 'Column',
      type,
      notNull: true,
      primaryKey: false,
      default: `(temporal_now_${adjusted}())`,
      ...props
    };
    tableRequests.set(symbol, request);
    target[type] = symbol;
  }
}

addNow(symbols.now);
addNow(symbols.nil.now, { notNull: false });

symbols.references = (instance, options) => {
  const { 
    column,
    onDelete,
    onUpdate,
    index
  } = options || {};
  const request = {
    category: 'ForeignKey',
    column: null,
    references: instance.name,
    actions: [],
    index: index === false ? false : true
  };
  const columns = getColumns(instance)
    .filter(c => column ? c.name === column : c.primaryKey);
  if (columns.length !== 1) {
    throw Error('the foreign key options are not valid');
  }
  const target = columns.at(0);
  target.primaryKey = false;
  target.notNull = true;
  request.column = target;
  if (onDelete) {
    request.actions.push(`on delete ${onDelete}`);
  }
  if (onUpdate) {
    request.actions.push(`on update ${onUpdate}`);
  }
  const symbol = Symbol();
  tableRequests.set(symbol, request);
  return symbol;
}

symbols.cascade = (instance, options) => {
  return symbols.references(instance, { ...options, onDelete: 'cascade' });
}

const typed = () => {
  const symbol = Symbol();
  const request = {
    category: 'Column',
    type: 'json',
    notNull: true,
    structure: true
  };
  tableRequests.set(symbol, request);
  return symbol;
}

symbols.typedArray = typed;
symbols.typedObject = typed;

symbols.default = (value) => {
  const result = toColumn(value);
  tableRequests.set(result.symbol, result.column);
  return result.symbol;
}

const reflect = ['references', 'cascade', 'typedArray', 'typedObject', 'default'];
for (const key of reflect) {
  symbols.nil[key] = (...args) => {
    const symbol = symbols[key](...args);
    const request = tableRequests.get(symbol);
    if (['references', 'cascade'].includes(key)) {
      request.column.notNull = false;
    }
    else {
      request.notNull = false;
    }
    return symbol;
  }
}

const makeIndex = (args, category) => {
  const symbol = Symbol();
  const last = args.at(-1);
  let expression;
  let columns = args;
  const type = typeof last;
  const isDate = last instanceof Date;
  const isBlob = last instanceof Uint8Array;
  if (!isDate && !isBlob && ['function', 'object'].includes(type)) {
    expression = args.pop();
  }
  tableRequests.set(symbol, {
    category,
    columns,
    expression
  });
  return symbol;
}

symbols.index = (...args) => makeIndex(args, 'Index');
symbols.unique = (...args) => makeIndex(args, 'Unique');

symbols.check = (column, ...checks) => {
  const symbol = Symbol();
  if (typeof column === 'object' && checks.length === 0) {
    tableRequests.set(symbol, {
      category: 'Check',
      checks: column
    });
  }
  else {
    tableRequests.set(symbol, {
      category: 'Check',
      column,
      checks
    });
  }
  return symbol;
}

const makeUnindexed = () => {
  const request = tableRequests.get(symbols.text);
  const updated = { ...request, unindexed: true };
  const symbol = Symbol();
  tableRequests.set(symbol, updated);
  return symbol;
}

symbols.unindexed = makeUnindexed();

class Table extends BaseTable {
  id = symbols.primary.int;
}

class FTSTable extends BaseTable {
  rowid = symbols.primary.int;
  [tokenizer] = new Unicode61({ removeDiacritics: true });
}

class ExternalFTSTable extends FTSTable {
  [externalRowId] = null;

  [transform]() {
    this[hasTransformed] = true;
    const value = this.rowid;
    const request = tableRequests.get(value);
    const symbol = Symbol();
    const updated = { ...request };
    this.rowid = symbol;
    tableRequests.set(symbol, updated);
    classes.set(symbol, this.constructor);
  }
}

const getColumns = (constructor) => {
  const instance = new constructor();
  const columns = [];
  for (const [key, value] of Object.entries(instance)) {
    if (typeof value === 'function') {
      continue;
    }
    let request;
    if (typeof value === 'symbol') {
      request = tableRequests.get(value);
    }
    else {
      const result = toColumn(value);
      request = result.column;
    }
    const clone = { ...request };
    clone.name = key;
    columns.push(clone);
  }
  return columns;
}

const process = (Custom, key, classTable) => {
  const instance = new Custom();
  const name = removeCapital(key);
  const type = Custom.prototype instanceof FTSTable ? 'fts5' : 'base';
  const external = Custom.prototype instanceof ExternalFTSTable;
  const getRequest = (symbol) => tableRequests.get(symbol);
  const table = {
    name,
    type,
    columns: [],
    computed: [],
    indexes: [],
    primaryKeys: [],
    foreignKeys: [],
    checks: [],
    structured: {}
  };
  if (type === 'fts5') {
    table.tokenizer = toString(instance[tokenizer]);
    if (instance[prefix] !== undefined) {
      table.prefix = instance[prefix];
    }
  }
  const keys = [];
  const computedKeys = [];
  for (const [key, value] of Object.entries(instance)) {
    if (typeof value === 'function') {
      computedKeys.push(key);
    }
    else {
      keys.push(key);
    }
  }
  const virtualColumns = new Map();
  let virtualTable;
  if (table.type === 'fts5') {
    if (keys.length === 0) {
      throw Error('FTS5 table needs at least one column');
    }
    const rowId = {
      name: 'rowid',
      type: 'integer',
      notNull: true,
      primaryKey: true
    };
    table.columns.push(rowId);
    if (external) {
      const constructor = keys
        .map(k => classes.get(instance[k]))
        .find(c => c.name !== Custom.name);
      const parent = new constructor();
      virtualTable = removeCapital(parent.constructor.name);
      const parentKeys = Object.keys(parent);
      const mapped = parentKeys
        .map(key => {
          const symbol = parent[key];
          const request = tableRequests.get(symbol);
          const column = { name: key, ...request };
          return {
            key,
            column
          }
        });
      for (const item of mapped) {
        virtualColumns.set(item.key, item.column);
      }
      const primaryKey = mapped.find(m => m.column.primaryKey);
      rowId.original = {
        table: virtualTable,
        name: primaryKey.column.name
      }
    }
  }
  const addCheck = (column, checks) => {
    const sql = column.sql || nameToSql(column.name);
    const statements = [];
    for (const check of checks) {
      if (check.is !== undefined) {
        if (typeof check.is === 'symbol') {
          const method = tableRequests.get(check.is);
          if (method.category === 'Column') {
            statements.push(`${sql} = ${method.name}`);
          }
          else {
            const result = processMethod({
              method,
              requests: tableRequests,
              getRequest
            });
            statements.push(`${sql} ${result.sql}`);
          }
        }
        else {
          statements.push(`${sql} = ${toLiteral(check.is)}`);
        }
      }
      else if (check.in) {
        const clause = check.in.map(s => toLiteral(s)).join(', ');
        statements.push(`${sql} in (${clause})`);
      }
      else {
        throw Error('invalid check constraint');
      }
    }
    const joined = statements.join(' and ');
    table.checks.push({
      name: toHash(table.name, joined),
      sql: joined
    });
  }
  const getColumn = (key, value) => {
    const type = typeof value;
    if (type !== 'symbol') {
      const result = toColumn(value);
      result.column.name = key;
      return {
        category: 'Literal',
        name: key,
        ...result
      };
    }
    const request = tableRequests.get(value);
    const { category, subcategory } = request;
    if (subcategory === 'User-Defined Function') {
      const column = { ...request.column, name: key };
      column.default = `(${request.name}())`;
      return column;
    }
    if (category === 'Column') {
      const column = { ...request, name: key };
      if (external && key !== 'rowid') {
        const virtual = virtualColumns.get(key);
        column.original = {
          table: virtualTable,
          name: virtual.name
        }
      }
      return column;
    }
    else if (category === 'ForeignKey') {
      const { 
        references,
        actions,
        index
      } = request;
      const column = { ...request.column };
      column.name = key;
      table.foreignKeys.push({
        columns: [key],
        references: {
          table: classTable[references],
          column: request.column.name
        },
        actions
      });
      if (index !== false) {
        table.indexes.push({ on: key });
      }
      return column;
    }
    else if (category === 'Check') {
      const column = getColumn(key, request.column);
      addCheck(column, request.checks);
      return column;
    }
    else if (['Index', 'Unique'].includes(category)) {
      const type = category === 'Unique' ? 'unique' : undefined;
      if (request.columns.length > 1) {
        throw Error('multi-column indexes can only be defined in the Attributes function');
      }
      const arg = request.columns.at(0);
      const result = getColumn(key, arg);
      let symbol = arg;
      let column = result;
      if (result.category === 'Literal') {
        symbol = result.symbol;
        column = result.column;
      }
      let where;
      if (request.expression) {
        const result = request.expression(symbol);
        if (!result || !result.where) {
          throw Error('invalid index expression');
        }
        where = toWhere({
          where: result.where,
          requests: tableRequests,
          getRequest
        });
      }
      table.indexes.push({
        type,
        on: column.sql || column.name,
        where
      });
      return column;
    }
    if (category === 'Method') {
      const { type, sql } = processMethod({
        method: request,
        requests: tableRequests,
        getRequest
      });
      return {
        category: 'Computed',
        name: key,
        type,
        sql
      };
    }
  }
  for (const key of keys) {
    const value = instance[key];
    const result = getColumn(key, value);
    if (result.primaryKey) {
      table.primaryKeys.push(result.name);
    }
    if (result.category === 'Literal') {
      table.columns.push(result.column);
      tableRequests.set(result.symbol, result.column);
    }
    else {
      if (result.name !== 'rowid') {
        table.columns.push(result);
        tableRequests.set(value, result);
      }
    }
  }
  for (const key of computedKeys) {
    const value = instance[key]();
    const result = getColumn(key, value);
    result.category = 'Column';
    table.computed.push(result);
    tableRequests.set(value, result);
  }
  const found = [];
  if (instance[attributes]) {
    const result = instance[attributes]();
    if (Array.isArray(result)) {
      found.push(...result);
    }
    else {
      found.push(result);
    }
  }
  for (const symbol of found) {
    const request = tableRequests.get(symbol);
    const category = request.category;
    if (['Index', 'Unique'].includes(category)) {
      const type = category === 'Unique' ? 'unique' : undefined;
      const on = request
        .columns
        .map(arg => processArg({
          arg,
          requests: tableRequests,
          getRequest
        }))
        .map(r => r.sql || r.name)
        .join(', ');
      let where;
      if (request.expression) {
        let result;
        if (typeof request.expression === 'function') {
          result = request.expression(symbol);
        }
        else {
          result = request.expression;
        }
        if (!result || !result.where) {
          throw Error('invalid index expression');
        }
        where = toWhere({
          where: result.where,
          requests: tableRequests,
          getRequest
        });
      }
      table.indexes.push({
        type,
        on,
        where
      });
    }
    else if (category === 'Check') {
      if (!request.column) {
        const where = toWhere({
          where: request.checks,
          requests: tableRequests,
          getRequest
        });
        table.checks.push({
          name: toHash(table.name, where),
          sql: where
        });
      }
      else {
        const column = getColumn(null, request.column);
        addCheck(column, request.checks);
      }
    }
  }
  const columns = [];
  for (const item of table.columns) {
    const { category, structure, ...column } = item;
    if (structure) {
      table.structured[column.name] = structure;
    }
    columns.push(column);
  }
  table.columns = columns;
  return table;
}

const typeMap = {
  boolean: 'integer',
  json: 'blob',
  bigInt: 'integer',
  ...Object.fromEntries(temporal.map(t => [removeCapital(t.name), 'text']))
};

const toString = (tokenizer) => {
  const { 
    removeDiacritics,
    categories,
    tokenChars,
    separators,
    caseSensitive,
    porter
  } = tokenizer;
  let sql = `${porter ? 'porter ' : ''}${tokenizer.name}`;
  if (removeDiacritics !== undefined) {
    let value = 0;
    if (removeDiacritics) {
      value = tokenizer.name === 'unicode61' ? 2 : 1;
    }
    sql += ` remove_diacritics ${value}`;
  }
  if (categories) {
    sql += ` categories '${categories.join(' ')}'`;
  }
  if (tokenChars) {
    sql += ` tokenchars '${tokenChars}'`;
  }
  if (separators) {
    sql += ` separators '${separators}'`;
  }
  if (caseSensitive !== undefined) {
    sql += ` casesensitive ${caseSensitive ? 1 : 0}`;
  }
  return sql;
}

const toVirtual = (table) => {
  const { 
    name,
    columns,
    tokenizer,
    prefix
  } = table;
  let sql = `create virtual table ${name} using fts5 (\n`;
  let rowId;
  let originalTable;
  let contentless = false;
  const names = [];
  for (const column of columns) {
    if (!column.original) {
      contentless = true;
    }
    if (column.name === 'rowid') {
      if (column.original) {
        rowId = column.original.name;
        originalTable = column.original.table;
      }
    }
    else {
      names.push(nameToSql(column.name));
      sql += `  ${nameToSql(column.name)}${column.unindexed ? ' unindexed' : ''},\n`;
    }
  }
  if (!contentless) {
    sql += `  content=${originalTable},\n`;
    sql += `  content_rowid=${rowId},\n`;
  }
  if (prefix !== undefined) {
    sql += '  ';
    if (Array.isArray(prefix)) {
      const prefixes = prefix.map(size => `prefix=${size}`).join(', ');
      sql += prefixes;
    }
    else {
      sql += `prefix=${prefix}`;
    }
    sql += ',\n';
  }
  sql += `  tokenize="${tokenizer}"\n`;
  sql += `);\n`;
  if (!contentless) {
    sql += `
      create trigger ${name}_ai after insert on ${originalTable} begin
        insert into ${name}(rowid, ${names.join(', ')}) values (new.rowid, ${names.map(n => `new.${n}`).join(', ')});
      end;

      create trigger ${name}_ad after delete on ${originalTable} begin
          insert into ${name}(${name}, rowid, ${names.join(', ')}) values ('delete', old.rowid, ${names.map(n => `old.${n}`).join(', ')});
      end;

      create trigger ${name}_au after update on ${originalTable} begin
          insert into ${name}(${name}, rowid, ${names.join(', ')}) values ('delete', old.rowid, ${names.map(n => `old.${n}`).join(', ')});
          insert into ${name}(rowid, ${names.join(', ')}) values (new.rowid, ${names.map(n => `new.${n}`).join(', ')});
      end;`;
  }
  return sql;
}

const columnToSql = (column) => {
  const dbType = typeMap[column.type] || column.type;
  const notNull = column.notNull ? ' not null' : '';
  let defaultClause = '';
  if (column.default !== undefined) {
    defaultClause = ` default ${column.default}`;
  }
  return `${nameToSql(column.name)} ${dbType}${notNull}${defaultClause}`;
}

const indexToSql = (table, index) => {
  const { type, on, where } = index;
  const indexName = toHash(table, index);
  let sql = `create `;
  if (type === 'unique') {
    sql += 'unique ';
  }
  sql += `index ${indexName} on ${table}(${nameToSql(on)})`;
  if (where) {
    sql += ` where ${where}`;
  }
  sql += ';\n';
  return sql;
}

const toSql = (table) => {
  const { 
    name,
    columns,
    indexes,
    primaryKeys,
    foreignKeys,
    checks
  } = table;
  if (table.type === 'fts5') {
    return toVirtual(table);
  }
  let sql = `create table ${name} (\n`;
  for (const column of columns) {
    const clause = columnToSql(column);
    sql += `  ${clause},\n`;
  }
  if (primaryKeys.length > 0) {
    const mapped = primaryKeys.map(k => nameToSql(k));
    sql += `  primary key (${mapped.join(', ')}),\n`;
  }
  if (foreignKeys.length > 0) {
    for (const foreignKey of foreignKeys) {
      const {
        columns,
        references,
        actions
      } = foreignKey;
      const actionClause = actions.length > 0 ? ` ${actions.join(' ')}` : '';
      sql += `  foreign key (${columns.map(c => nameToSql(c)).join(', ')}) references ${references.table}(${nameToSql(references.column)})${actionClause},\n`;
    }
  }
  if (checks.length > 0) {
    for (const check of checks) {
      sql += `  constraint ${check.name} check (${check.sql}),\n`;
    }
  }
  sql = sql.replace(/,(\s+)$/, '$1');
  sql += ') strict;\n\n';
  for (const index of indexes) {
    sql += indexToSql(name, index);
  }
  return sql;
}

export {
  FTSTable,
  BaseTable,
  ExternalFTSTable,
  Unicode61,
  Trigram,
  Ascii,
  Table,
  toSql,
  toHash,
  process,
  indexToSql,
  columnToSql,
  symbols,
  tableRequests
}
