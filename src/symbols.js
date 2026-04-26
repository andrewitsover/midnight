import { compareMethods, computeMethods, windowMethods } from './methods.js';
import { processArg, processMethod, toWhere } from './requests.js';
import { addAlias, nameToSql, createPlaceholder } from './utils.js';

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
    const symbol = Symbol();
    requests.set(symbol, {
      category: 'Table',
      name: table,
      alias: tableAlias
    });
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
      let subcategory;
      if (isCompare) {
        subcategory = 'Compare';
      }
      else if (isCompute) {
        subcategory = 'Compute';
      }
      else if (isWindow) {
        subcategory = 'Window';
      }
      else {
        return makeTableHandler(property);
      }
      const symbol = Symbol();
      const request = {
        category: 'Method',
        subcategory,
        name: property,
        type: null,
        args: null,
        alias: null
      }
      requests.set(symbol, request);
      return (...args) => {
        request.args = args;
        if (['min', 'max'].includes(property) && args.length === 1) {
          request.subcategory = 'Window';
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

const getColumns = (where, requests) => {
  const getSymbols = (clause) => {
    const found = [];
    const symbols = Object.getOwnPropertySymbols(clause);
    found.push(...symbols);
    for (const symbol of symbols) {
      const value = clause[symbol];
      if (typeof value === 'symbol') {
        found.push(value);
      }
    }
    const other = clause.or || clause.and;
    if (other) {
      for (const item of other) {
        found.push(...getSymbols(item));
      }
    }
    return found;
  }
  return getSymbols(where)
    .map(s => requests.get(s))
    .filter(s => s.category === 'Column');
}

const toSql = (clauses) => {
  const keys = [
    'select',
    'from',
    'where',
    'groupBy',
    'having',
    'orderBy',
    'limit',
    'offset'
  ];
  const statements = [];
  for (const key of keys) {
    const adjusted = key.replace('By', ' by');
    const value = clauses[key];
    if (value) {
      statements.push(`${adjusted} ${value}`);
    }
  }
  return statements.join(' ');
}

const processQuery = (db, expression, firstResult) => {
  const getPlaceholder = createPlaceholder();
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
  const properties = [result.select, result.distinct, result.maybe, result.certain].filter(p => p !== undefined);
  const valueReturn = properties.every(p => typeof p === 'symbol');
  let select;
  if (valueReturn) {
    select = { valueReturn: properties.at(0) };
  }
  else {
    select = { ...result.select, ...result.distinct, ...result.maybe, ...result.certain };
  }
  const maybeSymbols = new Set(Object.values(result.maybe || {}));
  const clauses = {};
  const statements = [];
  const parsers = {};
  const columnTypes = {};
  for (const [key, value] of Object.entries(select)) {
    let parser;
    const request = requests.get(value);
    if (request.category !== 'Column') {
      const left = request.name === 'group' && maybeSymbols.has(value);
      const valueArg = processMethod({
        db,
        method: request,
        params,
        requests,
        getPlaceholder,
        left
      });
      request.alias = key;
      request.type = valueArg.type;
      columnTypes[key] = valueArg.type;
      statements.push(`${valueArg.sql} as ${nameToSql(key)}`);
      parser = db.getDbToJsConverter(valueArg.type);
    }
    else {
      statements.push(`${request.selector} as ${nameToSql(key)}`);
      columnTypes[key] = request.type;
      parser = db.getDbToJsConverter(request.type);
    }
    if (parser) {
      parsers[key] = parser;
    }
  }
  const distinct = result.distinct ? 'distinct ' : '';
  clauses.select = `${distinct}${statements.join(', ')}`;
  if (where) {
    clauses.where = toWhere({
      db,
      where,
      params,
      requests,
      getPlaceholder
    });
  }
  if (groupBy) {
    const adjusted = Array.isArray(groupBy) ? groupBy : [groupBy];
    const statements = adjusted
      .map(c => processArg({
        db,
        arg: c,
        params,
        requests,
        getPlaceholder
      }))
      .map(a => a.sql);
    clauses.groupBy = statements.join(', ');
  }
  if (having) {
    clauses.having = toWhere({
      db,
      where: having,
      params,
      requests,
      getPlaceholder
    });
  }
  if (orderBy) {
    const items = Array.isArray(orderBy) ? orderBy : [orderBy];
    const clause = items
      .map(arg => processArg({
        db,
        arg,
        params,
        requests,
        getPlaceholder
      }))
      .map(a => a.sql)
      .join(', ');
    clauses.orderBy = `${clause}${desc ? ' desc' : ''}`;
  }
  if (rank) {
    clauses.orderBy = 'rank';
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
    clauses.orderBy = `bm25(${table}, ${values})`;
  }
  if (offset) {
    const result = processArg({
      db,
      arg: offset,
      params,
      requests,
      getPlaceholder
    });
    clauses.offset = result.sql;
  }
  if (limit) {
    const result = processArg({
      db,
      arg: limit,
      params,
      requests,
      getPlaceholder
    });
    clauses.limit = result.sql;
  }
  if (firstResult && !limit) {
    clauses.limit = '1';
  }
  const used = new Set();
  let first;
  let join;
  const processJoin = (tuples) => {
    if (Array.isArray(tuples[0]) || typeof tuples[0] === 'object') {
      join = tuples;
    }
    else {
      join = [tuples];
    }
    join = join.map(tuple => {
      if (!Array.isArray(tuple)) {
        if (!first) {
          first = getColumns(tuple, requests).at(0);
          used.add(first.table || first.tableAlias);
        }
        return tuple;
      }
      const [l, r, type] = tuple;
      const processed = [requests.get(l), requests.get(r), type];
      if (!first) {
        first = processed[0];
        used.add(first.table || first.tableAlias);
      }
      return processed;
    });
  }
  if (result.join) {
    processJoin(result.join);
  }
  else {
    const values = Array.from(requests.values());
    const columns = values.filter(r => r.category === 'Column');
    const used = values.filter(r => r.category === 'UsedColumn');
    const unique = new Set(columns.map(c => c.table));
    const tables = Array.from(unique.values());
    const extracted = values.filter(v => v.category === 'Table');
    for (const table of extracted) {
      if (!tables.includes(table.name)) {
        tables.push(table.name);
      }
    }
    const left = new Set();
    if (result.maybe) {
      for (const symbol of Object.values(result.maybe)) {
        const request = requests.get(symbol);
        if (request.category === 'Method') {
          for (const item of used) {
            if (item.method === request) {
              left.add(item.column.table);
            }
          }
        }
        else if (request.category === 'Column') {
          left.add(request.table);
        }
      }
    }
    let firstTable;
    if (tables.length === 1) {
      const { tableAlias, table } = columns.at(0);
      clauses.from = `${table} ${tableAlias}`;
    }
    else if (tables.length > 1) {
      const grouped = used
        .filter(r => ['group', 'windowGroup'].includes(r.method.name))
        .map(r => r.column.table);
      if (grouped.length > 0) {
        const base = columns
          .filter(c => !grouped.includes(c.table))
          .at(0);
        const { tableAlias, table } = base;
        firstTable = table;
        const primaryKey = db.getPrimaryKey(table);
        if (!clauses.groupBy) {
          clauses.groupBy = `${tableAlias}.${primaryKey}`;
        }
      }
      if (!firstTable) {
        firstTable = tables.at(0);
      }
      const makeKey = (table, column) => {
        const alias = extracted.find(c => c.name === table).alias;
        const symbol = Symbol();
        const request = {
          table,
          tableAlias: alias,
          selector: `${alias}.${column}`
        };
        requests.set(symbol, request);
        return symbol;
      }
      const ordered = [firstTable, ...tables.filter(t => t !== firstTable)];
      const join = [];
      for (const table of ordered) {
        for (const other of ordered.filter(t => t !== table)) {
          const foreignKeys = db.foreignKeys[other];
          const relation = foreignKeys
            .find(k => k.references.table === table);
          if (relation) {
            const otherColumn = relation.columns.at(0);
            const column = relation.references.column;
            const tableKey = makeKey(table, column);
            const otherKey = makeKey(other, otherColumn);
            let type;
            if (left.has(table) || left.has(other)) {
              type = 'left';
            }
            join.push([tableKey, otherKey, type]);
            break;
          }
        }
      }
      if (join.length !== tables.length - 1) {
        throw Error('Could not join all tables');
      }
      processJoin(join);
    }
  }
  if (join) {
    clauses.from = `${first.table} ${first.tableAlias}`;
    for (const tuple of join) {
      if (!Array.isArray(tuple)) {
        const joinType = tuple.type ? `${tuple.type} join` : 'join';
        const columns = getColumns(tuple, requests);
        const { type, ...where } = tuple;
        const whereClause = toWhere({
          db,
          where,
          params,
          requests,
          getPlaceholder
        });
        const from = columns.find(c => !used.has(c.table || c.tableAlias));
        const table = from.table || from.tableAlias;
        const tableClause = from.table ? `${from.table} ${from.tableAlias}` : from.tableAlias;
        used.add(table);
        clauses.from += ` ${joinType} ${tableClause} on ${whereClause}`;
      }
      else {
        const [l, r, type] = tuple;
        const joinType = type ? `${type} join` : 'join';
        const [from, to] = used.has(l.table || l.tableAlias) ? [r, l] : [l, r];
        const table = from.table || from.tableAlias;
        const tableClause = from.table ? `${from.table} ${from.tableAlias}` : from.tableAlias;
        used.add(table);
        clauses.from += ` ${joinType} ${tableClause} on ${from.selector} = ${to.selector}`;
      }
    }
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
  const sql = toSql(clauses);
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
