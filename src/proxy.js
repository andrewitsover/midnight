import { readFileSync } from 'fs';
import {
  insert,
  insertMany,
  update,
  get,
  all,
  remove
} from './queries.js';
import { join } from 'path';
import { parseQuery } from './sqlParsers/queries.js';
import pluralize from 'pluralize';

const queries = {
  insert: (database, table) => async (params) => await insert(database, table, params),
  insertMany: (database, table) => async (items) => await insertMany(database, table, items),
  update: (database, table) => async (params, query) => await update(database, table, params, query),
  get: (database, table) => async (query, columns) => await get(database, table, query, columns),
  all: (database, table) => async (query, columns) => await all(database, table, query, columns),
  remove: (database, table) => async (query) => await remove(database, table, query)
}

const singularQueries = {
  insert: queries.insert,
  update: queries.update,
  get: queries.get,
  remove: queries.remove
}

const multipleQueries = {
  insert: queries.insertMany,
  update: queries.update,
  get: queries.all,
  remove: queries.remove
}

const getPrefixes = (columns) => {
  let prefixes = null;
  let prefix;
  let foreign;
  let keys = [];
  for (const column of columns) {
    if (column.foreign) {
      if (prefix) {
        if (!prefixes) {
          prefixes = {};
        }
        prefixes[prefix] = [...keys];
        keys = [];
        prefix = undefined;
        foreign = undefined;
      }
      prefix = column.name.split(/[A-Z]/)[0];
      keys.push(column.name);
      foreign = column.foreign;
      continue;
    }
    if (prefix) {
      if (column.name.split(/[A-Z]/)[0] === prefix && column.tableName === foreign) {
        keys.push(column.name);
      }
      else {
        if (!prefixes) {
          prefixes = {};
        }
        prefixes[prefix] = [...keys];
        keys = [];
        prefix = undefined;
        foreign = undefined;
      }
    }
  }
  if (prefix) {
    if (!prefixes) {
      prefixes = {};
    }
    prefixes[prefix] = [...keys];
  }
  if (!prefixes) {
    return null;
  }
  const result = {};
  for (const [key, value] of Object.entries(prefixes)) {
    if (value.length > 1) {
      result[key] = value;
    }
  }
  if (Object.keys(result).length === 0) {
    return null;
  }
  return result;
}

const makeOptions = (columns, db) => {
  const prefixes = getPrefixes(columns);
  const columnMap = {};
  let typeMap = null;
  const primaryKeys = [];
  let i = 0;
  let revertMap = {};
  const primaryKeyCount = new Set(columns.filter(c => c.primaryKey).map(c => c.tableName)).size;
  let lastPrimaryKey;
  for (const column of columns) {
    const rename = column.rename && primaryKeyCount > 1 && column.originalName.length < column.name.length;
    const columnName = rename ? column.originalName : column.name;
    columnMap[column.name] = rename ? column.originalName : column.name;
    const converter = db.getDbToJsConverter(column.type);
    let actualConverter = converter;
    if (converter) {
      if (!typeMap) {
        typeMap = {};
      }
      const structured = column.structuredType;
      if (structured) {
        if (Array.isArray(structured)) {
          const structuredType = structured[0].type;
          if (typeof structuredType === 'string') {
            const structuredConverter = db.getDbToJsConverter(structuredType);
            if (structuredConverter) {
              actualConverter = (v) => {
                return converter(v).map(i => structuredConverter(i));
              }
            }
          }
        }
      }
      typeMap[column.name] = actualConverter;
    }
    if (column.primaryKey) {
      if (lastPrimaryKey) {
        if (lastPrimaryKey.index === i - 1 && lastPrimaryKey.tableName === column.tableName) {
          lastPrimaryKey.index = i;
          i++;
          continue;
        }
      }
      lastPrimaryKey = {
        tableName: column.tableName,
        index: i
      };
      primaryKeys.push({
        name: column.name,
        index: i
      });
      revertMap = {};
      revertMap[columnName] = column.name;
    }
    else {
      const revert = revertMap[columnName];
      if (revert) {
        columnMap[revert] = revert;
        columnMap[column.name] = column.name;
      }
      else {
        revertMap[columnName] = column.name;
      }
    }
    i++;
  }
  const options = {
    parse: true,
    map: true
  }
  options.columns = columnMap;
  options.types = typeMap;
  options.primaryKeys = primaryKeys;
  options.prefixes = prefixes;
  return options;
}

const getResultType = (columns, isSingular) => {
  if (columns.length === 0) {
    return 'none';
  }
  else if (isSingular) {
    if (columns.length === 1) {
      return 'value';
    }
    else {
      return 'object';
    }
  }
  else {
    if (columns.length === 1) {
      return 'values';
    }
    else {
      return 'array';
    }
  }
}

const makeQueryHandler = (table, db, sqlDir) => {
  let isSingular;
  let queries;
  if (pluralize.isSingular(table)) {
    isSingular = true;
    table = pluralize.plural(table);
    queries = singularQueries;
  }
  else {
    isSingular = false;
    queries = multipleQueries;
  }
  return {
    get: function(target, query, receiver) {
      if (!target[query]) {
        if (!sqlDir) {
          if (!queries[query]) {
            throw Error(`Query ${query} of table ${table} not found`);
          }
          else {
            target[query] = queries[query](db, table);
          }
        }
        else {
          const path = join(sqlDir, table, `${query}.sql`);
          let sql;
          try {
            sql = readFileSync(path, 'utf8');
          }
          catch (e) {
            const makeQuery = isSingular ? singularQueries[query] : multipleQueries[query];
            if (makeQuery) {
              target[query] = makeQuery(db, table);
              return target[query];
            }
            else {
              throw e;
            }
          }
          try {
            const columns = parseQuery(sql, db.tables);
            const options = makeOptions(columns, db);
            options.result = getResultType(columns, isSingular);
            let run;
            if (options.result === 'none') {
              run = db.run;
            }
            else {
              run = db.all;
            }
            run = run.bind(db);
            options.cacheName = `${table}.${query}`;
            target[query] = async (params) => {
              return await run(sql, params, options);
            }
          }
          catch {
            target[query] = async (params) => {
              return await db.all(sql, params);
            }
          }
        }
      }
      return target[query];
    }
  }
}

const makeClient = (db, sqlDir) => {
  const tableHandler = {
    get: function(target, table, receiver) {
      if (['begin', 'commit', 'rollback'].includes(table)) {
        db[table] = db[table].bind(db);
        return db[table];
      }
      if (!target[table]) {
        target[table] = new Proxy({}, makeQueryHandler(table, db, sqlDir));
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
