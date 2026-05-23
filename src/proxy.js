import {
  insert,
  insertMany,
  update,
  upsert,
  exists,
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

const basic = {
  insert: (args) => (values) => insert({ values, ...args }),
  returnInsert: (args) => (values) => insert({ values, ...args, returning: true }),
  insertMany: (args) => (items) => insertMany({ items, ...args }),
  returnInsertMany: (args) => (items) => insertMany({ items, ...args, returning: true }),
  update: (args) => (options) => update({ options, ...args }),
  upsert: (args) => (options) => upsert({ options, ...args }),
  returnUpsert: (args) => (options) => upsert({ options, ...args, returning: true }),
  exists: (args) => (query, config) => exists({ query, ...config, ...args }),
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

const makeOptions = (columns, db) => {
  const columnMap = {};
  let typeMap = null;
  for (const column of columns) {
    columnMap[column.name] = column.name.replace(/^flyweight\d+_/, '');
    const converter = db.getDbToJsParser(column.type);
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

const makeQueryHandler = (options) => {
  const { 
    table,
    db,
    subquery
  } = options;
  return {
    get: function(target, method) {
      if (!target[method]) {
        const makeQuery = basic[method];
        if (!makeQuery) {
          throw Error(`there is no method named: ${method}`);
        }
        const run = makeQuery({ 
          db,
          table,
          subquery
        });
        target[method] = (...args) => {
          return run(...args);
        }
        return target[method];
      }
      return target[method];
    }
  }
}

const makeClient = (db) => {
  const tableHandler = {
    get: function(target, table) {
      if (table === 'query' || table === 'queryValues') {
        return (expression) => db.query(expression);
      }
      if (table === 'first' || table === 'firstValue') {
        return (expression) => db.query(expression, true);
      }
      if (table === 'subquery') {
        return (expression) => db.subquery(expression);
      }
      if (db[table] && ['begin', 'commit', 'rollback'].includes(table)) {
        const method = db[table].bind(db);
        return () => method();
      }
      if (db[table] && table === 'exec') {
        const method = db[table].bind(db);
        return (sql) => method(sql);
      }
      if (db[table] && ['getTransaction', 'diff', 'getSchema', 'migrate'].includes(table)) {
        const method = db[table].bind(db);
        return method;
      }
      if (table === 'use') {
        return (subquery) => {
          return new Proxy({}, makeQueryHandler({ 
            table,
            db,
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
          db
        }));
      }
      return target[table];
    }
  }
  return new Proxy({}, tableHandler);
}

export {
  makeClient,
  makeOptions
}
