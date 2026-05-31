import { compareMethods, computeMethods, windowMethods } from './methods.js';
import { processArg, processMethod, toWhere } from './requests.js';
import { addAlias, nameToSql, createPlaceholder, temporal, removeCapital, isColumn } from './utils.js';
import { Table } from './tables.js';
import reserved from './reserved.js';

const dateParsers = temporal.map(type => {
  const key = removeCapital(type.name);
  const parser = (t) => type.from(t);
  return [key, parser];
});

const textParsers = {
  bigInt: (t) => BigInt(t),
  blob: (t) => Uint8Array.fromBase64(t),
  ...Object.fromEntries(dateParsers)
}

const reviver = (key, value) => {
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 1) {
      const key = keys.at(0);
      if (key.startsWith('$') && key.length > 1) {
        const type = key.substring(1);
        const text = value[key];
        const parse = textParsers[type];
        if (parse) {
          return parse(text);
        }
      }
    }
  }
  return value;
}

class Structured {
  constructor(symbol) {
    this.symbol = symbol;
  }
}

const makeProxy = (options) => {
  const {
    db,
    requests,
    subqueries,
    makeAlias
  } = options;
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
        const sql = nameToSql(property, tableAlias);
        let selector;
        if (type === 'json') {
          selector = `json(${sql})`;
        }
        else if (computed === undefined) {
          selector = sql;
        }
        else {
          selector = addAlias(computed, tableAlias);
        }
        const request = {
          category: 'Column',
          table,
          name: property,
          selector,
          type,
          tableAlias
        };
        requests.set(symbol, request);
        if (db.structured[table][property]) {
          return new Structured(symbol);
        }
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
    const tableKey = `${table} ${tableAlias}`;
    requests.set(proxy, { isProxy: true, tableKey });
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
              const original = context.original[property];
              requests.set(symbol, {
                category: 'Column',
                name: property,
                selector: `${tableAlias}.${property}`,
                type,
                original,
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
          for (const key of Object.keys(proxy)) {
            proxy[key];
          }
          return proxy;
        }
      }
      if (property === 'symbol') {
        return (type) => {
          if (type instanceof Structured) {
            return type.symbol;
          }
          else {
            throw Error('Invalid argument to "symbol"');
          }
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
        const symbol = Symbol();
        const proxy = makeTableHandler(property);
        requests.set(symbol, {
          category: 'TableProxy',
          proxy
        });
        return proxy;
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

const getColumns = (where, getRequest) => {
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
    .map(s => getRequest(s))
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

const toKey = (column) => {
  if (column.table) {
    return `${column.table} ${column.tableAlias}`;
  }
  return column.tableAlias;
}

const processQuery = (db, expression, firstResult) => {
  const getPlaceholder = createPlaceholder();
  const requests = new Map();
  const subqueries = [];
  const existing = Object.keys(db.columns);
  const usedAliases = new Set(existing);
  const makeAlias = (table) => {
    let letters;
    if (table) {
      letters = table.at(0).toLowerCase();
      const matches = table.match(/[A-Z]/g);
      if (matches) {
        letters += matches.join('').toLowerCase();
      }
      if (reserved.has(letters)) {
        letters = letters.at(0);
      }
    }
    else {
      letters = 's';
    }
    const letter = table ? table[0].toLowerCase() : 's';
    for (let i = 0; i < 100; i++) {
      const alias = i ? `${letters}${i}` : letters;
      if (!usedAliases.has(alias)) {
        usedAliases.add(alias);
        return alias;
      }
    }
    throw Error('failed to create a unique table alias');
  }
  const proxy = makeProxy({
    db,
    requests,
    subqueries,
    makeAlias
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
  const mapped = requests
    .values()
    .filter(r => r.category === 'TableProxy')
    .map(r => r.proxy);
  const tableProxies = new Set(mapped);
  const getSymbol = (value) => {
    if (tableProxies.has(value)) {
      return proxy.group(value);
    }
    else if (typeof value === 'symbol') {
      return value;
    }
    else if (value instanceof Structured) {
      return value.symbol;
    }
    else if (Array.isArray(value)) {
      return proxy.group(value.at(0));
    }
    else if (typeof value === 'function') {
      const result = value();
      return proxy.object(result);
    }
    else {
      throw Error('invalid arguments');
    }
  }
  const adjust = (select) => {
    if (!select) {
      return select;
    }
    if (typeof select !== 'object') {
      return getSymbol(select);
    }
    const adjusted = {};
    for (const [key, value] of Object.entries(select)) {
      adjusted[key] = getSymbol(value);
    }
    return adjusted;
  }
  const adjusted = {};
  for (const key of ['select', 'distinct', 'maybe', 'certain']) {
    adjusted[key] = adjust(result[key]);
  }
  const properties = Object.values(adjusted).filter(p => p !== undefined);
  const valueReturn = properties.every(p => typeof p === 'symbol');
  let select;
  if (valueReturn) {
    select = { valueReturn: properties.at(0) };
  }
  else {
    select = { ...adjusted.select, ...adjusted.distinct, ...adjusted.maybe, ...adjusted.certain };
  }
  const maybeSymbols = new Set(Object.values(adjusted.maybe || {}));
  const clauses = {};
  const statements = [];
  const parsers = {};
  const columnTypes = {};
  const original = {};
  const includeSubquery = (symbol, join = true) => {
    const request = Table.requests.get(symbol);
    if (request) {
      requests.set(symbol, request);
      request.join = join;
    }
    if (request && request.category === 'SubqueryColumn') {
      const context = request.subquery;
      let subquery = subqueries.find(s => s.context === context);
      if (!subquery) {
        const tableAlias = makeAlias();
        subquery = {
          alias: tableAlias,
          sql: context.sql,
          params: context.params,
          context
        };
        subqueries.push(subquery);
        for (const key of Object.keys(context.columns)) {
          if (key === request.name) {
            continue;
          }
          const symbol = Symbol();
          const type = context.columns[key];
          const original = context.original[key];
          requests.set(symbol, {
            category: 'SubqueryColumn',
            name: key,
            type,
            original,
            subquery: context,
            tableAlias,
            selector: `${tableAlias}.${key}`,
            join
          });
        }
      }
      request.selector = `${subquery.alias}.${request.name}`;
      request.tableAlias = subquery.alias;
      return request;
    }
    else {
      return request;
    }
  }
  const getRequest = (symbol) => {
    let request = requests.get(symbol);
    if (!request) {
      request = includeSubquery(symbol);
    }
    return request;
  }
  for (const [key, symbol] of Object.entries(select)) {
    let parser;
    let type;
    let request = requests.get(symbol);
    if (!request) {
      request = includeSubquery(symbol);
      if (request) {
        statements.push(`${request.selector} as ${nameToSql(key)}`);
        columnTypes[key] = request.type;
        original[key] = request.original || request;
        parser = db.getDbToJsParser(request.type);
      }
    }
    else if (request.category !== 'Column') {
      const left = request.name === 'group' && maybeSymbols.has(symbol);
      const valueArg = processMethod({
        db,
        method: request,
        params,
        requests,
        getPlaceholder,
        left,
        includeSubquery
      });
      request.alias = key;
      request.type = valueArg.type;
      columnTypes[key] = valueArg.type;
      statements.push(`${valueArg.sql} as ${nameToSql(key)}`);
      let revive = false;
      if (valueArg.otherTypes) {
        revive = valueArg
          .otherTypes
          .some(t => t && !['text', 'integer', 'real', 'boolean'].includes(t));
      }
      if (revive && valueArg.type === 'json') {
        parser = (v) => v === null ? null : JSON.parse(v, reviver);
      }
      else {
        parser = db.getDbToJsParser(valueArg.type);
      }
    }
    else {
      const alias = nameToSql(key);
      let statement = request.selector
      if (request.selector.substring(request.tableAlias.length + 1) !== alias) {
        statement += ` as ${alias}`;
      }
      statements.push(statement);
      columnTypes[key] = request.type;
      original[key] = request;
      parser = db.getDbToJsParser(request.type);
    }
    if (parser) {
      parsers[key] = parser;
    }
  }
  const bigInt = Object.values(columnTypes).some(t => t === 'bigInt');
  if (bigInt) {
    for (const [key, value] of Object.entries(columnTypes)) {
      if (value === 'integer') {
        parsers[key] = (v) => v === null ? null : Number(v);
      }
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
      getPlaceholder,
      includeSubquery
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
        getPlaceholder,
        includeSubquery
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
      getPlaceholder,
      includeSubquery
    });
  }
  if (orderBy) {
    const items = Array.isArray(orderBy) ? orderBy : [orderBy];
    const mapped = items
      .map(arg => processArg({
        db,
        arg,
        params,
        requests,
        getPlaceholder,
        includeSubquery
      }))
      .map(arg => {
        if (arg.type === 'zonedDateTime') {
          return `temporal_nanoseconds(${arg.sql})`;
        }
        return arg.sql;
      });
    const clause = mapped.join(', ');
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
      getPlaceholder,
      includeSubquery
    });
    clauses.offset = result.sql;
  }
  if (limit) {
    const result = processArg({
      db,
      arg: limit,
      params,
      requests,
      getPlaceholder,
      includeSubquery
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
          first = getColumns(tuple, getRequest).at(0);
          used.add(toKey(first));
        }
        return tuple;
      }
      const [l, r, type] = tuple;
      const processed = [getRequest(l), getRequest(r), type];
      if (!first) {
        first = processed[0];
        used.add(toKey(first));
      }
      return processed;
    });
  }
  if (result.join) {
    processJoin(result.join);
  }
  else {
    const values = Array.from(requests.values());
    const set = new Set();
    const columns = [];
    for (const value of values) {
      if (isColumn(value)) {
        if (set.has(value.selector)) {
          continue;
        }
        else {
          if (value.join === false) {
            continue;
          }
          columns.push(value);
          set.add(value.selector);
        }
      }
    }
    const used = values.filter(r => r.category === 'UsedColumn');
    const unique = new Set();
    for (const request of columns) {
      const key = toKey(request);
      unique.add(key);
    }
    const tables = Array.from(unique.values());
    const left = new Set();
    if (adjusted.maybe) {
      for (const symbol of Object.values(adjusted.maybe)) {
        const request = requests.get(symbol);
        if (request.category === 'Method') {
          for (const item of used) {
            if (item.method === request) {
              left.add(toKey(item.column));
            }
          }
        }
        else if (request.category === 'Column') {
          left.add(toKey(request));
        }
      }
    }
    const extracted = values.filter(v => v.category === 'Table');
    for (const table of extracted) {
      const key = `${table.name} ${table.alias}`;
      if (!tables.includes(key)) {
        tables.push(key);
        if (adjusted.maybe) {
          left.add(key);
        }
      }
    }
    let firstTable;
    const grouped = used
        .filter(r => r.method.subcategory === 'Window')
        .map(r => r.column.table);
    if (grouped.length > 0) {
      const ungrouped = columns
        .filter(c => !grouped.includes(c.table));
      let base;
      if (select) {
        const first = requests.get(Object.values(select).at(0));
        base = ungrouped.find(c => c === first);
      }
      if (!base) {
        base = ungrouped.at(0);
      }
      if (base) {
        const { tableAlias, table } = base;
        firstTable = `${table} ${tableAlias}`;
        if (!clauses.groupBy) {
          if (ungrouped.length === 1) {
            clauses.groupBy = base.selector;
          }
          else {
            const primaryKey = db.getPrimaryKey(table);
            clauses.groupBy = `${tableAlias}.${nameToSql(primaryKey)}`;
          }
        }
      }
      else {
        const first = Object.values(select)
          .map(s => requests.get(s))
          .filter(s => s.category !== 'Method' || s.subcategory !== 'Window')
          .at(0);
        if (first) {
          if (first.category !== 'Column') {
            const found = used.find(u => u.method === first);
            if (found) {
              firstTable = toKey(found.column);
              clauses.groupBy = found.column.selector;
            }
          }
          else {
            clauses.groupBy = first.selector;
          }
        }
      }
    }
    let ordered;
    const makeKey = (request) => {
      const symbol = Symbol();
      requests.set(symbol, request);
      return symbol;
    }
    if (tables.length === 1) {
      const { tableAlias, table } = columns.at(0);
      clauses.from = `${table} ${tableAlias}`;
    }
    else if (tables.length > 1) {
      const findJoins = (shared, extra) => {
        if (extra) {
          tables.push(extra);
        }
        if (!firstTable) {
          firstTable = tables.at(0);
        }
        ordered = [firstTable, ...tables.filter(t => t !== firstTable)];
        const join = [];
        const joined = new Set();
        for (const tableKey of ordered) {
          const [table, tableAlias] = tableKey.split(' ');
          const process = (relation, otherKey) => {
            const joinKey = [tableKey, otherKey].sort().join(' ');
            if (joined.has(joinKey)) {
              return;
            }
            const [other, otherAlias] = otherKey.split(' ');
            if (relation) {
              const otherColumn = relation.columns.at(0);
              const column = relation.references.column;
              const tableSymbol = makeKey({
                table,
                tableAlias,
                selector: `${tableAlias}.${column}`
              });
              const otherSymbol = makeKey({
                table: other,
                tableAlias: otherAlias,
                selector: `${otherAlias}.${otherColumn}`
              });
              let type;
              if (left.has(tableKey) || left.has(otherKey)) {
                type = 'left';
              }
              joined.add(joinKey);
              join.push([tableSymbol, otherSymbol, type]);
            }
          }
          for (const otherKey of ordered.filter(t => t !== tableKey)) {
            const joinKey = [tableKey, otherKey].sort().join(' ');
            if (joined.has(joinKey)) {
              continue;
            }
            const split = otherKey.split(' ');
            const [other] = split;
            if (split.length === 1) {
              const selected = columns.filter(c => c.tableAlias === other);
              for (const column of selected) {
                const original = column.original;
                if (original && original.table === table) {
                  const primaryKey = db.getPrimaryKey(table);
                  let found = false;
                  if (primaryKey === original.name) {
                    found = true;
                  }
                  else {
                    found = db.foreignKeys[table]
                      .filter(k => k.columns.length === 1)
                      .some(k => k.columns.at(0) === original.name);
                  }
                  if (found) {
                    const otherSymbol = makeKey({
                      tableAlias: other,
                      selector: `${other}.${column.name}`
                    });
                    const tableSymbol = makeKey({
                      table,
                      tableAlias,
                      selector: `${tableAlias}.${nameToSql(primaryKey)}`
                    });
                    let type;
                    if (left.has(tableKey) || left.has(otherKey)) {
                      type = 'left';
                    }
                    joined.add(joinKey);
                    join.push([tableSymbol, otherSymbol, type]);
                  }
                }
                else if (shared && original) {
                  const found = db.foreignKeys[original.table]
                    .filter(k => k.columns.length === 1)
                    .find(k => k.columns.at(0) === original.name);
                  if (found) {
                    const foreignKey = db.foreignKeys[table]
                      .filter(k => k.columns.length === 1)
                      .filter(k => k.references.table === found.references.table)
                      .find(k => k.references.column === found.references.column);
                    if (foreignKey) {
                      const otherSymbol = makeKey({
                        tableAlias: other,
                        selector: `${other}.${column.name}`
                      });
                      const tableSymbol = makeKey({
                        table,
                        tableAlias,
                        selector: `${tableAlias}.${foreignKey.columns.at(0)}`
                      });
                      let type;
                      if (left.has(tableKey) || left.has(otherKey)) {
                        type = 'left';
                      }
                      joined.add(joinKey);
                      join.push([tableSymbol, otherSymbol, type]);
                    }
                  }
                }
              }
            }
            else {
              const foreignKeys = db.foreignKeys[other];
              const relation = foreignKeys
                .filter(k => k.columns.length === 1)
                .find(k => k.references.table === table);
              process(relation, otherKey);
            }
          }
        }
        return join;
      }
      let join = findJoins();
      if (join.length !== tables.length - 1) {
        const message = 'could not join all tables';
        if (subqueries.length > 0) {
          join = findJoins(true);
          if (join.length !== tables.length - 1) {
            throw Error(message);
          }
        }
        else if (tables.length === 2) {
          const names = ordered.map(key => key.split(' ').at(0));
          const found = [];
          for (const [table, relations] of Object.entries(db.foreignKeys)) {
            if (names.includes(table)) {
              continue;
            }
            const exists = relations
              .filter(r => names.includes(r.references.table))
              .length === 2;
            if (exists) {
              found.push(table);
            }
          }
          if (found.length === 1) {
            const table = found.at(0);
            const alias = makeAlias(table);
            const key = `${table} ${alias}`;
            join = findJoins(false, key);
            if (join.length !== tables.length - 1) {
              throw Error(message);
            }
          }
          else {
            throw Error(message);
          }
        }
        else {
          throw Error(message);
        }
      }
      processJoin(join);
    }
  }
  if (join) {
    clauses.from = first.table? `${first.table} ${first.tableAlias}` : first.tableAlias;
    for (const tuple of join) {
      if (!Array.isArray(tuple)) {
        const joinType = tuple.type ? `${tuple.type} join` : 'join';
        const columns = getColumns(tuple, getRequest);
        const { type, ...where } = tuple;
        const whereClause = toWhere({
          db,
          where,
          params,
          requests,
          getPlaceholder,
          includeSubquery
        });
        const from = columns.find(c => !used.has(toKey(c)));
        const table = from.table || from.tableAlias;
        const tableClause = from.table ? `${from.table} ${from.tableAlias}` : from.tableAlias;
        used.add(toKey(from));
        clauses.from += ` ${joinType} ${tableClause} on ${whereClause}`;
      }
      else {
        const [l, r, type] = tuple;
        const joinType = type ? `${type} join` : 'join';
        const [from, to] = used.has(toKey(l)) ? [r, l] : [l, r];
        const table = from.table || from.tableAlias;
        const tableClause = from.table ? `${from.table} ${from.tableAlias}` : from.tableAlias;
        used.add(toKey(from));
        clauses.from += ` ${joinType} ${tableClause} on ${from.selector} = ${to.selector}`;
      }
    }
  }
  if (having && !clauses.groupBy) {
    const columns = Object
      .values(select)
      .map(v => requests.get(v))
      .filter(r => isColumn(r));
    if (columns.length === 1) {
      clauses.groupBy = columns.at(0).selector;
    }
    else if (columns.length > 1) {
      const column = columns
        .filter(c => c.table !== undefined)
        .at(0);
      if (column) {
        const primaryKey = db.getPrimaryKey(column.table);
        clauses.groupBy = `${column.table}.${nameToSql(primaryKey)}`;
      }
    }
    const request = requests.get(Object.values(select).at(0));
    if (isColumn(request)) {
      clauses.groupBy = request.selector;
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
  const adjustedParams = replaceParams(subqueries, sql, params);
  return {
    ...adjustedParams,
    columns: columnTypes,
    log: result.log,
    original,
    bigInt,
    post
  }
}

export default processQuery;
