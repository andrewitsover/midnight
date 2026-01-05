import { compareMethods, computeMethods } from './methods.js';
import { processArg, processMethod, toWhere } from './requests.js';

const types = ['Int', 'Real', 'Text', 'Blob', 'Json', 'Date', 'Bool'];
const modifiers = [
  ['', {}],
  ['Primary', { primaryKey: true }]
];

const removeCapital = (name) => {
  return name.at(0).toLowerCase() + name.substring(1);
}

const addCapital = (name) => {
  return name.at(0).toUpperCase() + name.substring(1);
}

const sanitize = (s) => s.replaceAll(/'/gmi, '\'\'');

const toColumn = (literal) => {
  const instance = new Table();
  const type = typeof literal;
  let symbol;
  if (type === 'string') {
    symbol = instance.Text;
  }
  else if (type === 'number') {
    if (Number.isInteger(literal)) {
      symbol = instance.Int;
    }
    else {
      symbol = instance.Real;
    }
  }
  else if (type === 'boolean') {
    symbol = instance.Bool;
  }
  else if (symbol instanceof Date) {
    symbol = instance.Date;
  }
  else {
    throw Error(`Invalid default value ${literal}`);
  }
  const column = Table.requests.get(symbol);
  column.default = literal;
  return {
    symbol,
    column
  };
}

const toLiteral = (value) => {
  const type = typeof value;
  if (type === 'string') {
    return `'${sanitize(value)}'`;
  }
  if (type === 'boolean') {
    return value === true ? 1 : 0;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
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

class BaseTable {
  static requests = new Map();
  static classes = new Map();
  Called = [];

  constructor() {
    const cls = this.constructor;
    const methods = [...compareMethods, ...computeMethods];
    for (const method of methods) {
      let name = addCapital(method);
      if (['Date', 'Json'].includes(name)) {
        name = `To${name}`;
      }
      const type = compareMethods.includes(method) ? 'Compare' : 'Compute';
      Object.defineProperty(this, name, {
        get: function() {
          const symbol = Symbol();
          const request = {
            category: 'Method',
            type,
            name: method,
            args: null
          };
          Table.requests.set(symbol, request);
          return (...args) => {
            request.args = args;
            return symbol;
          }
        }
      });
    }
    for (const type of types) {
      for (const modifier of modifiers) {
        const [word, props] = modifier;
        let dbType = type.toLowerCase();
        if (dbType === 'bool') {
          dbType = 'boolean';
        }
        else if (dbType === 'int') {
          dbType = 'integer';
        }
        const key = `${type}${word}`;
        Object.defineProperty(this, key, {
          get: function() {
            const symbol = Symbol();
            Table.classes.set(symbol, cls);
            Table.requests.set(symbol, {
              category: 'Column',
              type: dbType,
              notNull: true,
              ...props
            });
            return symbol;
          }
        });
      }
    }
  }

  get Now() {
    const symbol = Symbol();
    Table.requests.set(symbol, {
      category: 'Column',
      type: 'date',
      notNull: true,
      default: 'now'
    });
    return symbol;
  }

  get True() {
    const symbol = Symbol();
    Table.requests.set(symbol, {
      category: 'Column',
      type: 'boolean',
      notNull: true,
      default: true
    });
    return symbol;
  }

  get False() {
    const symbol = Symbol();
    Table.requests.set(symbol, {
      category: 'Column',
      type: 'boolean',
      notNull: true,
      default: false
    });
    return symbol;
  }

  Default(value) {
    const { symbol, column } = toColumn(value);
    Table.requests.set(symbol, column);
    return symbol;
  }

  get Unindexed() {
    const symbol = this.Text;
    const column = Table.requests.get(symbol);
    column.unindexed = true;
    return symbol;
  }

  ReplaceFields() {
    const keys = Object.getOwnPropertyNames(this).filter(k => /^[a-z]/.test(k));
    for (const key of keys) {
      const symbol = this[key];
      const request = Table.requests.get(symbol);
      Object.defineProperty(this, key, {
        get: function() {
          const symbol = Symbol();
          Table.requests.set(symbol, request);
          return symbol;
        }
      });
    }
  }

  MakeIndex(args, category) {
    const symbol = Symbol();
    const last = args.at(-1);
    let expression;
    let columns = args;
    const type = typeof last;
    const isDate = last instanceof Date;
    const isBuffer = Buffer && Buffer.isBuffer(last);
    if (!isDate && !isBuffer && ['function', 'object'].includes(type)) {
      expression = args.pop();
    }
    Table.requests.set(symbol, {
      category,
      columns,
      expression
    });
    this.Called.push(symbol);
    return symbol;
  }

  Index(...args) {
    return this.MakeIndex(args, 'Index');
  }

  Unique(...args) {
    return this.MakeIndex(args, 'Unique');
  }

  Check(column, ...checks) {
    const symbol = Symbol();
    Table.requests.set(symbol, {
      category: 'Check',
      column,
      checks
    });
    this.Called.push(symbol);
    return symbol;
  }

  Null(value) {
    if (typeof value !== 'symbol') {
      const result = toColumn(value);
      result.column.notNull = false;
      return result.symbol;
    }
    const request = Table.requests.get(value);
    request.notNull = false;
    return value;
  }

  Cascade(instance, options) {
    options = options || {};
    options.onDelete = 'cascade';
    return this.References(instance, options);
  }

  References(instance, options) {
    const { 
      column,
      onDelete,
      onUpdate,
      notNull,
      index
    } = options || {};
    const request = {
      category: 'ForeignKey',
      column: null,
      references: removeCapital(instance.name),
      actions: [],
      index: index === false ? false : true
    };
    const columns = getColumns(instance)
      .filter(c => column ? c.name === column : c.primaryKey);
    if (columns.length !== 1) {
      throw Error('The foreign key options are not valid');
    }
    const target = columns.at(0);
    target.primaryKey = false;
    target.notNull = notNull === false ? false : true;
    request.column = target;
    if (onDelete) {
      request.actions.push(`on delete ${onDelete}`);
    }
    if (onUpdate) {
      request.actions.push(`on update ${onUpdate}`);
    }
    const symbol = Symbol();
    Table.requests.set(symbol, request);
    return symbol;
  }
}

class Table extends BaseTable {
  id = this.IntPrimary;
}

class FTSTable extends BaseTable {
  rowid = this.IntPrimary;
  Tokenizer = new Unicode61({ removeDiacritics: true });
}

class ExternalFTSTable extends FTSTable {
  rowid = this.IntPrimary;
  ExternalRowId = null;
}

const getKeys = (instance) => {
  return Object
    .getOwnPropertyNames(instance)
    .filter(k => /[a-z]/.test(k.at(0)));
}

const getColumns = (constructor) => {
  const instance = new constructor();
  const keys = getKeys(instance);
  return keys.map(key => {
    const value = instance[key];
    let request;
    if (typeof value === 'symbol') {
      request = Table.requests.get(value);
    }
    else if (value === undefined) {
      const symbol = instance.Text;
      request = Table.requests.get(symbol);
    }
    else {
      const result = toColumn(value);
      request = result.column;
    }
    const clone = { ...request };
    clone.name = key;
    return clone;
  });
}

const process = (Custom) => {
  const instance = new Custom();
  const name = removeCapital(Custom.name);
  const type = Custom.prototype instanceof FTSTable ? 'fts5' : 'base';
  const external = Custom.prototype instanceof ExternalFTSTable;
  const table = {
    name,
    type,
    columns: [],
    computed: [],
    indexes: [],
    primaryKeys: [],
    foreignKeys: [],
    checks: []
  };
  if (type === 'fts5') {
    table.tokenizer = toString(instance.Tokenizer);
    if (instance.Prefix !== undefined) {
      table.prefix = instance.Prefix;
    }
  }
  const keys = getKeys(instance);
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
      const constructor = Table.classes.get(instance[keys.at(0)]);
      const parent = new constructor();
      virtualTable = removeCapital(parent.constructor.name);
      const parentKeys = getKeys(parent);
      const mapped = parentKeys
        .map(key => {
          const symbol = parent[key];
          const request = Table.requests.get(symbol);
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
    const sql = column.sql || column.name;
    const statements = [];
    for (const check of checks) {
      if (typeof check === 'symbol') {
        const method = Table.requests.get(check);
        if (method.category === 'Column') {
          statements.push(`${sql} = ${method.name}`);
        }
        else {
          const result = processMethod({
            method,
            requests: Table.requests
          });
          statements.push(`${sql} ${result.sql}`);
        }
      }
      else if (Array.isArray(check)) {
        const clause = check.map(s => toLiteral(s)).join(', ');
        statements.push(`${sql} in (${clause})`);
      }
      else {
        statements.push(`${sql} = ${toLiteral(check)}`);
      }
    }
    table.checks.push(statements.join(' and '));
  }
  const getColumn = (key, value) => {
    if (value === undefined) {
      value = instance.Text;
    }
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
    const request = Table.requests.get(value);
    const category = request.category;
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
          table: references,
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
        throw Error('Multi-column indexes can only be defined in the "Attributes" function');
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
        where = toWhere({
          where: result,
          requests: Table.requests
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
        requests: Table.requests
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
    if (result.category === 'Computed') {
      result.category = 'Column';
      table.computed.push(result);
      Table.requests.set(value, result);
    }
    else if (result.category === 'Literal') {
      table.columns.push(result.column);
      Table.requests.set(result.symbol, result.column);
    }
    else {
      table.columns.push(result);
      Table.requests.set(value, result);
    }
  }
  if (instance.Attributes) {
    instance.ReplaceFields();
    instance.Called = [];
    instance.Attributes();
  }
  for (const symbol of instance.Called) {
    const request = Table.requests.get(symbol);
    const category = request.category;
    if (['Index', 'Unique'].includes(category)) {
      const type = category === 'Unique' ? 'unique' : undefined;
      const on = request
        .columns
        .map(arg => processArg({
          arg,
          requests: Table.requests
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
        where = toWhere({
          where: result,
          requests: Table.requests
        });
      }
      table.indexes.push({
        type,
        on,
        where
      });
    }
    else if (category === 'Check') {
      const column = getColumn(null, request.column);
      addCheck(column, request.checks);
    }
  }
  table.columns = table.columns.map(column => {
    const { category, ...rest } = column;
    return rest;
  });
  return table;
}

const typeMap = {
  date: 'text',
  boolean: 'integer',
  json: 'blob'
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
      names.push(column.name);
      sql += `  ${column.name}${column.unindexed ? ' unindexable' : ''},\n`;
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
    if (column.type === 'date' && column.default === 'now') {
      defaultClause = ` default (date() || 'T' || time() || '.000Z')`;
    }
    else {
      defaultClause = ` default ${toLiteral(column.default)}`;
    }
  }
  return `${column.name} ${dbType}${notNull}${defaultClause}`;
}

const toHash = (index) => {
  const replacers = [
    [/([a-z])([A-Z])/gm, '$1_$2'],
    [/\s+/gm, '_'],
    ['<=', 'lte'],
    ['>=', 'gte'],
    ['=', 'eq'],
    ['>', 'gt'],
    ['<', 'lte'],
    [/[^a-z_0-9]/gmi, '']
  ];
  let hash = Object
    .values(index)
    .filter(v => v !== undefined)
    .join('_');
  for (const replacer of replacers) {
    const [from, to] = replacer;
    hash = hash.replaceAll(from, to);
  }
  return hash.toLowerCase();
}

const indexToSql = (table, index) => {
  const { type, on, where } = index;
  const hash = toHash(index);
  const adjusted = table.replaceAll(/([a-z])([A-Z])/gm, '$1_$2');
  const indexName = `${adjusted}_${hash}`;
  let sql = `create `;
  if (type === 'unique') {
    sql += 'unique ';
  }
  sql += `index ${indexName} on ${table}(${on})`;
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
    sql += `  primary key (${primaryKeys.join(', ')}),\n`;
  }
  if (foreignKeys.length > 0) {
    for (const foreignKey of foreignKeys) {
      const {
        columns,
        references,
        actions
      } = foreignKey;
      const actionClause = actions.length > 0 ? ` ${actions.join(' ')}` : '';
      sql += `  foreign key (${columns.join(', ')}) references ${references.table}(${references.column})${actionClause},\n`;
    }
  }
  if (checks.length > 0) {
    for (const check of checks) {
      sql += `  check (${check}),\n`;
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
  removeCapital
}
