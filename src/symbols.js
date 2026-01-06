import { compareMethods, computeMethods, windowMethods } from './methods.js';
import { processArg, processMethod, toWhere } from './requests.js';
import { addAlias, nameToSql } from './utils.js';

const makeProxy = (options) => {
  const {
    db,
    requests,
    subqueries
  } = options;
  const existing = Object.keys(db.columns);
  const usedAliases = new Set(existing);
  const makeAlias = (table) => {
    const letter = table ? table[0].toLowerCase() : 's';
    for (let i = 0; i < 100; i++) {
      const alias = i ? `${letter}${i}` : letter;
      if (!usedAliases.has(alias)) {
        usedAliases.add(alias);
        return alias;
      }
    }
    throw Error('failed to create a unique table alias');
  }
  const makeTableHandler = (table) => {
    const tableAlias = makeAlias(table);
    const keys = Object.keys(db.columns[table]);
    const handler = {
      get: function(target, property) {
        const isVirtualColumn = db.virtualSet.has(table) && property === `${table[0].toLowerCase()}${table.substring(1)}`;
        if ((!db.tables[table] || !db.columns[table][property]) && !isVirtualColumn) {
          throw Error(`table or column does not exist: ${table}.${property}`);
        }
        const symbol = Symbol();
        const type = db.columns[table][property];
        const computed = db.computed[table][property];
        let selector = nameToSql(property, tableAlias);
        if (computed !== undefined) {
          selector = addAlias(computed, tableAlias);
        }
        requests.set(symbol, {
          category: 'Column',
          table,
          name: property,
          selector,
          type,
          tableAlias
        });
        return symbol;
      },
      ownKeys: function(target) {
        return keys;
      },
      getOwnPropertyDescriptor: function(target, property) {
        if (keys.includes(property)) {
          return {
            enumerable: true,
            configurable: true
          };
        }
        return undefined;
      }
    };
    const proxy = new Proxy({}, handler);
    requests.set(proxy, { isProxy: true });
    return proxy;
  }
  const handler = {
    get: function(target, property) {
      if (property === 'use') {
        return (context) => {
          const keys = Object.keys(context.columns);
          const tableAlias = makeAlias();
          subqueries.push({
            alias: tableAlias,
            sql: context.sql,
            params: context.params
          });
          const handler = {
            get: function(target, property) {
              const symbol = Symbol();
              const type = context.columns[property];
              requests.set(symbol, {
                category: 'Column',
                name: property,
                selector: `${tableAlias}.${property}`,
                type,
                tableAlias
              });
              return symbol;
            },
            ownKeys: function(target) {
              return keys;
            },
            getOwnPropertyDescriptor: function(target, property) {
              if (keys.includes(property)) {
                return {
                  enumerable: true,
                  configurable: true
                };
              }
              return undefined;
            }
          }
          const proxy = new Proxy({}, handler);
          requests.set(proxy, { isProxy: true });
          return proxy;
        }
      }
      const isCompare = compareMethods.includes(property);
      const isCompute = computeMethods.includes(property);
      const isWindow = windowMethods.includes(property);
      let type;
      if (isCompare) {
        type = 'Compare';
      }
      else if (isCompute) {
        type = 'Compute';
      }
      else if (isWindow) {
        type = 'Window';
      }
      else {
        return makeTableHandler(property);
      }
      const symbol = Symbol();
      const request = {
        category: 'Method',
        type,
        name: property,
        args: null,
        alias: null
      }
      requests.set(symbol, request);
      return (...args) => {
        request.args = args;
        if (['min', 'max'].includes(property) && args.length === 1) {
          request.type = 'Window';
        }
        return symbol;
      }
    }
  }
  return new Proxy({}, handler);
}

const replaceParams = (subqueries, sql, params) => {
  if (subqueries.length === 0) {
    return {
      sql,
      params
    }
  }
  let i = 1;
  const combined = {};
  const statements = [];
  const replace = (sql, params) => {
    return sql.replaceAll(/\$p_\d+/gmi, (m) => {
      const updated = `p_${i}`;
      i++;
      const existing = m.substring(1);
      combined[updated] = params[existing];
      return `$${updated}`;
    });
  }
  for (const query of subqueries) {
    const { alias, sql, params } = query;
    const adjusted = replace(sql, params);
    statements.push(`${alias} as (${adjusted})`);
  }
  const adjusted = replace(sql, params);
  const statement = `with ${statements.join(', ')} ${adjusted}`;
  return {
    sql: statement,
    params: combined
  }
}

const processQuery = (db, expression, firstResult) => {
  const requests = new Map();
  const subqueries = [];
  const proxy = makeProxy({
    db,
    requests,
    subqueries
  });
  const params = {};
  const result = expression(proxy);
  const {
    where,
    groupBy,
    having,
    orderBy,
    desc,
    bm25,
    rank,
    offset,
    limit
  } = result;
  const properties = [result.select, result.distinct, result.optional].filter(p => p !== undefined);
  const valueReturn = properties.every(p => typeof p === 'symbol');
  let select;
  if (valueReturn) {
    select = { valueReturn: properties.at(0) };
  }
  else {
    select = { ...result.select, ...result.distinct, ...result.optional };
  }
  const used = new Set();
  let first;
  let join;
  if (result.join) {
    if (Array.isArray(result.join[0])) {
      join = result.join;
    }
    else {
      join = [result.join];
    }
    join = join.map(tuple => {
      const [l, r, type] = tuple;
      return [requests.get(l), requests.get(r), type];
    })
  }
  if (join) {
    first = join[0][0];
    used.add(first.table);
  }
  let sql = 'select ';
  if (result.distinct) {
    sql += 'distinct ';
  }
  const statements = [];
  const parsers = {};
  const columnTypes = {};
  for (const [key, value] of Object.entries(select)) {
    let parser;
    const request = requests.get(value);
    if (request.category !== 'Column') {
      const valueArg = processMethod({
        db,
        method: request,
        params,
        requests
      });
      request.alias = key;
      request.type = valueArg.type;
      columnTypes[key] = valueArg.type;
      statements.push(`${valueArg.sql} as ${nameToSql(key)}`);
      parser = db.getDbToJsConverter(valueArg.type);
    }
    else {
      if (!join && request.name === key) {
        statements.push(request.selector);
      }
      else {
        let sql = request.selector;
        if (request.name !== key) {
          sql += ` as ${nameToSql(key)}`;
        }
        statements.push(sql);
      }
      columnTypes[key] = request.type;
      parser = db.getDbToJsConverter(request.type);
    }
    if (parser) {
      parsers[key] = parser;
    }
  }
  sql += statements.join(', ');
  if (join) {
    sql += ` from ${first.table} ${first.tableAlias}`;
    for (const tuple of join) {
      const [l, r, type] = tuple;
      const joinClause = type ? `${type} join` : 'join';
      const [from, to] = used.has(l.table) ? [r, l] : [l, r];
      const table = from.table || from.tableAlias;
      const tableClause = from.table ? `${from.table} ${from.tableAlias}` : from.tableAlias;
      used.add(table);
      sql += ` ${joinClause} ${tableClause} on ${from.selector} = ${to.selector}`;
    }
  }
  else {
    const columns = Array.from(requests.values()).filter(r => r.category === 'Column');
    if (columns.length > 0) {
      const { tableAlias, table } = columns.at(0);
      sql += ` from ${table} ${tableAlias}`;
    }
  }
  if (where) {
    const clause = toWhere({
      db,
      where,
      params,
      requests
    });
    if (clause) {
      sql += ` where ${clause}`;
    }
  }
  if (groupBy) {
    const adjusted = Array.isArray(groupBy) ? groupBy : [groupBy];
    const statements = adjusted
      .map(c => processArg({
        db,
        arg: c,
        params,
        requests
      }))
      .map(a => a.sql);
    sql += ` group by ${statements.join(', ')}`;
  }
  if (having) {
    const clause = toWhere({
      db,
      where: having,
      params,
      requests
    });
    if (clause) {
      sql += ` having ${clause}`;
    }
  }
  if (orderBy) {
    const items = Array.isArray(orderBy) ? orderBy : [orderBy];
    const clause = items
      .map(arg => processArg({
        db,
        arg,
        params,
        requests
      }))
      .map(a => a.sql)
      .join(', ');
    sql += ` order by ${clause}`;
    if (desc) {
      sql += ' desc';
    }
  }
  if (rank) {
    sql += ' order by rank';
  }
  if (bm25) {
    const mapped = Object
      .getOwnPropertySymbols(bm25)
      .map(s => {
        return {
          column: requests.get(s),
          value: bm25[s]
        }
      });
    const table = mapped.at(0).column.table;
    const values = mapped.map(s => s.value).join(', ');
    sql += ` order by bm25(${table}, ${values})`;
  }
  if (offset) {
    const result = processArg({
      db,
      arg: offset,
      params,
      requests
    });
    sql += ` offset ${result.sql}`;
  }
  if (limit) {
    const result = processArg({
      db,
      arg: limit,
      params,
      requests
    });
    sql += ` limit ${result.sql}`;
  }
  if (firstResult && !limit) {
    sql += ` limit 1`;
  }
  const post = (rows) => {
    if (Object.keys(parsers).length > 0) {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        for (const [key, parser] of Object.entries(parsers)) {
          row[key] = parser(row[key]);
        }
      }
    }
    let mapped = rows;
    if (valueReturn) {
      mapped = rows.map(r => r.valueReturn);
    }
    return firstResult ? mapped.at(0) : mapped;
  }
  const adjusted = replaceParams(subqueries, sql, params);
  return {
    ...adjusted,
    columns: columnTypes,
    log: result.log,
    post
  }
}

export {
  processQuery,
  makeProxy
}
