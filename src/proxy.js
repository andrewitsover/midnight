import {
  insert,
  insertMany,
  update,
  upsert,
  exists,
  group,
  aggregate,
  match,
  all,
  remove
} from './queries.js';

const methodNames = new Set([
  'exec',
  'begin',
  'commit',
  'rollback',
  'pragma',
  'deferForeignKeys',
  'migrate',
  'getSchema',
  'diff',
  'first',
  'firstValue',
  'query',
  'queryValues',
  'subquery',
  'use'
]);

const groupMethods = (args) => {
  const makeMethod = (method) => {
    return (query) => group({ query, method, ...args });
  }
  const result = {};
  const methods = ['count', 'avg', 'min', 'max', 'sum', 'array'];
  methods.forEach(m => {
    result[m] = makeMethod(m)
  });
  return result;
}

const basic = {
  insert: (args) => (values) => insert({ values, ...args }),
  insertMany: (args) => (items) => insertMany({ items, ...args }),
  update: (args) => (options) => update({ options, ...args }),
  upsert: (args) => (options) => upsert({ options, ...args }),
  exists: (args) => (query, config) => exists({ query, ...config, ...args }),
  groupBy: (args) => (by, config) => groupMethods({ by, ...config, ...args }),
  count: (args) => (query, config) => aggregate({ query, method: 'count', ...config, ...args }),
  avg: (args) => (query, config) => aggregate({ query, method: 'avg', ...config, ...args }),
  min: (args) => (query, config) => aggregate({ query, method: 'min', ...config, ...args }),
  max: (args) => (query, config) => aggregate({ query, method: 'max', ...config, ...args }),
  sum: (args) => (query, config) => aggregate({ query, method: 'sum', ...config, ...args }),
  get: (args) => (query, columns, config) => all({ query, columns, first: true, ...config, ...args }),
  many: (args) => (query, columns, config) => all({ query, columns, ...config, ...args }),
  match: (args) => (query, config) => match({ query, ...config, ...args }),
  query: (args) => (query, config) => all({ query, type: 'complex', ...config, ...args }),
  first: (args) => (query, config) => all({ query, first: true, type: 'complex', ...config, ...args }),
  delete: (args) => (query) => remove({ query, ...args })
}

const getConverters = (key, value, db, converters, keys = [], optional = []) => {
  keys.push(key);
  if (typeof value.type === 'string') {
    optional.push(value.isOptional);
    if (value.functionName && /^json_/i.test(value.functionName)) {
      return;
    }
    const converter = db.getDbToJsConverter(value.type);
    if (converter) {
      converters.push({
        keys: [...keys],
        converter
      });
    }
    return;
  }
  else {
    for (const [k, v] of Object.entries(value.type)) {
      getConverters(k, v, db, converters, [...keys], optional);
    }
  }
}

const allNulls = (item) => {
  if (item === null) {
    return true;
  }
  for (const value of Object.values(item)) {
    if (value === null) {
      continue;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) {
      return false;
    }
    const isNull = allNulls(value);
    if (!isNull) {
      return false;
    }
  }
  return true;
}

const makeOptions = (columns, db) => {
  const columnMap = {};
  let typeMap = null;
  for (const column of columns) {
    columnMap[column.name] = column.name.replace(/^flyweight\d+_/, '');
    const converter = db.getDbToJsConverter(column.type);
    if (converter) {
      if (!typeMap) {
        typeMap = {};
      }
      typeMap[column.name] = converter;
    }
  }
  const options = {
    parse: true,
    map: true
  }
  options.columns = columnMap;
  options.types = typeMap;
  return options;
}

const getResultType = (columns) => {
  if (columns.length === 0) {
    return 'none';
  }
  if (columns.length === 1) {
    return 'values';
  }
  else {
    return 'array';
  }
}

const makeQueryHandler = (options) => {
  const { 
    table,
    db,
    dbClient,
    subquery
  } = options;
  return {
    get: function(target, method) {
      if (method === 'compute') {
        return (args) => db.compute(table, args);
      }
      if (!target[method]) {
        const makeQuery = basic[method];
        if (!makeQuery) {
          throw Error(`there is no method named: ${method}`);
        }
        const run = makeQuery({ 
          db,
          table,
          dbClient,
          subquery
        });
        if (method === 'groupBy') {
          target[method] = (...args) => {
            return run(...args);
          }
        }
        else {
          target[method] = (...args) => {
            return run(...args);
          }
        }
        return target[method];
      }
      return target[method];
    }
  }
}

const makeClient = (db) => {
  const tableHandler = {
    get: function(target, table, dbClient) {
      if (table === 'query' || table === 'queryValues') {
        return (expression) => db.query(expression);
      }
      if (table === 'first' || table === 'firstValue') {
        return (expression) => db.query(expression, true);
      }
      if (table === 'subquery') {
        return (expression) => db.subquery(expression);
      }
      if (db[table] && ['begin', 'commit', 'rollback', 'pragma', 'deferForeignKeys'].includes(table)) {
        db[table] = db[table].bind(db);
        return () => db[table]();
      }
      if (db[table] && table === 'pragma') {
        db[table] = db[table].bind(db);
        return (sql) => db[table](sql);
      }
      if (db[table] && table === 'exec') {
        db[table] = db[table].bind(db);
        return (sql) => db[table](sql);
      }
      if (db[table] && ['getTransaction', 'diff', 'getSchema', 'migrate'].includes(table)) {
        db[table] = db[table].bind(db);
        return db[table];
      }
      if (table === 'use') {
        return (subquery) => {
          return new Proxy({}, makeQueryHandler({ 
            table,
            db,
            dbClient,
            subquery
          }));
        }
      }
      if (!target[table]) {
        if (!db.tables[table] && !methodNames.has(table)) {
          if (table === 'then') {
            return undefined;
          }
          throw Error(`no such table: ${table}`);
        }
        target[table] = new Proxy({}, makeQueryHandler({ 
          table,
          db,
          dbClient
        }));
      }
      return target[table];
    }
  }
  return new Proxy({}, tableHandler);
}

export {
  makeClient,
  makeOptions,
  getResultType
}
