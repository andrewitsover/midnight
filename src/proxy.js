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
  'batch',
  'sync',
  'first',
  'firstValue',
  'query',
  'queryValues',
  'subquery',
  'use'
]);

const groupMethods = (args) => {
  const makeMethod = (method) => {
    return async (query) => await group({ query, method, ...args });
  }
  const result = {};
  const methods = ['count', 'avg', 'min', 'max', 'sum', 'array'];
  methods.forEach(m => {
    result[m] = makeMethod(m)
  });
  return result;
}

const basic = {
  insert: (args) => async (values) => await insert({ values, ...args }),
  insertMany: (args) => async (items) => await insertMany({ items, ...args }),
  update: (args) => async (options) => await update({ options, ...args }),
  upsert: (args) => async (options) => await upsert({ options, ...args }),
  exists: (args) => async (query, config) => await exists({ query, ...config, ...args }),
  groupBy: (args) => (by, config) => groupMethods({ by, ...config, ...args }),
  count: (args) => async (query, config) => await aggregate({ query, method: 'count', ...config, ...args }),
  avg: (args) => async (query, config) => await aggregate({ query, method: 'avg', ...config, ...args }),
  min: (args) => async (query, config) => await aggregate({ query, method: 'min', ...config, ...args }),
  max: (args) => async (query, config) => await aggregate({ query, method: 'max', ...config, ...args }),
  sum: (args) => async (query, config) => await aggregate({ query, method: 'sum', ...config, ...args }),
  get: (args) => async (query, columns, config) => await all({ query, columns, first: true, ...config, ...args }),
  many: (args) => async (query, columns, config) => await all({ query, columns, ...config, ...args }),
  match: (args) => async (query, config) => await match({ query, ...config, ...args }),
  query: (args) => async (query, config) => await all({ query, type: 'complex', ...config, ...args }),
  first: (args) => async (query, config) => await all({ query, first: true, type: 'complex', ...config, ...args }),
  delete: (args) => async (query) => await remove({ query, ...args })
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
    tx,
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
        const run = makeQuery({ 
          db,
          table,
          tx,
          dbClient,
          subquery
        });
        if (method === 'groupBy') {
          target[method] = (...args) => {
            return run(...args);
          }
        }
        else {
          target[method] = async (...args) => {
            return await run(...args);
          }
        }
        return target[method];
      }
      return target[method];
    }
  }
}

const makeClient = (db, tx) => {
  const tableHandler = {
    get: function(target, table, dbClient) {
      if (table === 'query' || table === 'queryValues') {
        return (expression) => db.query(expression, tx);
      }
      if (table === 'first' || table === 'firstValue') {
        return (expression) => db.query(expression, tx, true);
      }
      if (table === 'subquery') {
        return (expression) => db.subquery(expression);
      }
      if (db[table] && ['begin', 'commit', 'rollback', 'pragma', 'deferForeignKeys'].includes(table)) {
        db[table] = db[table].bind(db);
        return () => db[table](tx);
      }
      if (db[table] && table === 'pragma') {
        db[table] = db[table].bind(db);
        return (sql) => db[table](sql);
      }
      if (db[table] && table === 'exec') {
        db[table] = db[table].bind(db);
        return (sql) => db[table](sql, tx);
      }
      if (db[table] && ['getTransaction', 'batch', 'sync', 'diff', 'getSchema', 'migrate'].includes(table)) {
        db[table] = db[table].bind(db);
        return db[table];
      }
      if (table === 'use') {
        return (subquery) => {
          return new Proxy({}, makeQueryHandler({ 
            table,
            db,
            tx,
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
          tx,
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
