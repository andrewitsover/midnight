import { 
  getPlaceholder, 
  expressionHandler, 
  jsonSelector,
  nameToSql
} from './utils.js';
import { compareOperators } from './methods.js';

const getConditions = (column, query, params) => {
  const operatorHandler = {
    get: function(target, property) {
      target.push(property);
      if (compareOperators.has(property)) {
        return (value) => {
          target.push(value);
          return target;
        }
      }
      return operatorProxy;
    }
  }
  const operatorProxy = new Proxy([], operatorHandler);
  const columnHandler = {
    get: function(target, property) {
      target.name = property;
      return columnProxy;
    }
  }
  const columnTarget = {};
  const columnProxy = new Proxy(columnTarget, columnHandler);
  const chain = query(operatorProxy, columnProxy);
  if (columnTarget.name) {
    verify(columnTarget.name);
  }
  const value = chain.pop();
  const method = chain.pop();
  if (!compareOperators.has(method)) {
    throw Error(`invalid operator: ${method}`);
  }
  const path = chain.length === 0 ? null : `$.${chain.join('.')}`;
  const placeholder = getPlaceholder();
  if (path) {
    params[placeholder] = path;
  }
  const selector = path ? `json_extract(${column}, $${placeholder})` : column;
  const conditions = [];
  const expression = columnTarget.name;
  if (method === 'not') {
    if (Array.isArray(value)) {
      const placeholder = getPlaceholder();
      params[placeholder] = value;
      conditions.push(`${selector} not in (select json_each.value from json_each($${placeholder}))`);
    }
    else if (value === null) {
      conditions.push(`${selector} is not null`);
    }
    else if (value === columnProxy) {
      conditions.push(`${selector} != ${expression}`);
    }
    else {
      const placeholder = getPlaceholder();
      params[placeholder] = value;
      conditions.push(`${selector} != $${placeholder}`);
    }
  }
  else {
    const operator = compareOperators.get(method);
    if (value === columnProxy) {
      conditions.push(`${selector} ${operator} ${expression}`);
    }
    else {
      const placeholder = getPlaceholder();
      params[placeholder] = value;
      conditions.push(`${selector} ${operator} $${placeholder}`);
    }
  }
  return conditions;
}

const getPlaceholders = (query, params, columnTypes) => {
  const columns = Object.keys(query);
  return columns.map(columnName => {
    const placeholder = getPlaceholder();
    params[placeholder] = query[columnName];
    if (columnTypes[columnName] === 'json') {
      return `jsonb($${placeholder})`;
    }
    return `$${placeholder}`;
  });
}

const adjust = (db, table, params) => {
  const columnTypes = db.columns[table];
  const adjusted = db.adjust(params);
  const processed = {};
  for (const [name, value] of Object.entries(adjusted)) {
    if (columnTypes[name] === 'json') {
      processed[name] = JSON.stringify(value);
    }
    else {
      processed[name] = value;
    }
  }
  return processed;
}

const makeInsertSql = (db, table, query, params) => {
  const columns = Object.keys(query);
  const columnTypes = db.columns[table];
  const placeholders = getPlaceholders(query, params, columnTypes);
  return `insert into ${table}(${columns.map(c => nameToSql(c)).join(', ')}) values(${placeholders.join(', ')})`;
}

const processBatch = (db, options, post) => {
  const result = db.all(options);
  return {
    statement: result.statement,
    params: result.params,
    post: (meta) => {
      const response = result.post(meta);
      return post(response);
    }
  }
}

const processInsert = (db, sql, params, primaryKey, tx, log) => {
  const options = {
    query: sql,
    params,
    tx,
    adjusted: true
  };
  const post = (result) => result[0][primaryKey];
  if (tx && tx.isBatch) {
    return processBatch(db, options, post);
  }
  const rows = withLog(db, options, log);
  return post(rows);
}

const verify = (columns) => {
  const names = Array.isArray(columns) ? columns : [columns];
  for (const name of names) {
    if (!/^[_a-z][a-z0-9_]+$/i.test(name)) {
      throw Error(`invalid column name: ${name}`);
    }
  }
}

const upsert = (args) => {
  const { 
    db,
    table,
    options,
    tx
  } = args;
  const { values, target, set, log } = options;
  const params = {};
  const query = adjust(db, table, values);
  let sql = makeInsertSql(db, table, query, params);
  verify(Object.keys(values));
  if (target && set) {
    verify([target]);
    verify(Object.keys(set));
    const query = adjust(db, table, set);
    const setClause = createSetClause(db, table, query, params);
    sql += ` on conflict(${target}) do update set ${setClause}`;
  }
  else {
    sql += ' on conflict do nothing';
  }
  const primaryKey = db.getPrimaryKey(table);
  sql += ` returning ${primaryKey}`;
  return processInsert(db, sql, params, primaryKey, tx, log);
}

const insert = (args) => {
  const { 
    db,
    table,
    values,
    tx
  } = args;
  const columns = Object.keys(values);
  verify(columns);
  const adjusted = adjust(db, table, values);
  const params = {};
  const sql = makeInsertSql(db, table, adjusted, params);
  const primaryKey = db.getPrimaryKey(table);
  const query = `${sql} returning ${primaryKey}`;
  return processInsert(db, query, params, primaryKey, tx);
}

const batchInserts = (tx, db, table, items) => {
  const inserts = [];
  for (const item of items) {
    const params = {};
    const adjusted = adjust(db, table, item);
    const sql = makeInsertSql(db, table, adjusted, params);
    inserts.push({
      query: sql,
      params,
      tx,
      adjusted: true
    });
  }
  if (tx && tx.isBatch) {
    return Promise.all(inserts.map(insert => db.run(insert)));
  }
  db.insertBatch(inserts);
}

const insertMany = (args) => {
  const {
    db,
    table,
    items,
    tx
  } = args;
  if (items.length === 0) {
    return;
  }
  const columnTypes = db.columns[table];
  const sample = items[0];
  const columns = Object.keys(sample);
  verify(columns);
  const hasBlob = db.tables[table].filter(c => columns.includes(c.name)).some(c => c.type === 'blob');
  if (hasBlob) {
    return batchInserts(tx, db, table, items);
  }
  let sql = `insert into ${table}(${columns.join(', ')}) select `;
  const select = columns.map(column => {
    if (columnTypes[column] === 'json') {
      return `jsonb(json_each.value ->> '${column}')`;
    }
    return `json_each.value ->> '${column}'`;
  }).join(', ');
  sql += select;
  sql += ' from json_each($items)';
  const params = {
    items: JSON.stringify(items)
  };
  const options = {
    query: sql,
    params,
    tx
  };
  return db.run(options);
}

const toWhere = (options) => {
  const {
    query,
    params,
    type
  } = options;
  if (!query) {
    return '';
  }
  const entries = Object.entries(query);
  if (entries.length === 0) {
    return '';
  }
  const conditions = [];
  for (const [column, param] of entries) {
    if (param === undefined) {
      continue;
    }
    const adjusted = ['and', 'or'].includes(column) ? column : nameToSql(column);
    if (column === 'and' || column === 'or') {
      if (!Array.isArray(param)) {
        throw Error(`the "${column}" property value must be an array of conditions`);
      }
      const filters = [];
      for (const query of param) {
        const clauses = toWhere({
          query,
          params,
          type: column
        });
        filters.push(clauses);
      }
      conditions.push(`(${filters.join(` ${column} `)})`);
    }
    else if (typeof param === 'function') {
      const result = getConditions(adjusted, param, params);
      conditions.push(...result);
    }
    else if (Array.isArray(param)) {
      const placeholder = getPlaceholder();
      params[placeholder] = param;
      conditions.push(`${adjusted} in (select json_each.value from json_each($${placeholder}))`);
    }
    else if (param === null) {
      conditions.push(`${adjusted} is null`);
    }
    else {
      const placeholder = getPlaceholder();
      params[placeholder] = param;
      conditions.push(`${adjusted} = $${placeholder}`);
    }
  }
  return conditions.join(` ${type || 'and'} `);
}

const createSetClause = (db, table, query, params) => {
  const statements = [];
  const columnTypes = db.columns[table];
  for (const [column, param] of Object.entries(query)) {
    if (typeof param === 'function') {
      const { createClause } = expressionHandler(param);
      const clause = createClause(params);
      statements.push(`${column} = ${clause}`);
      continue;
    }
    const placeholder = getPlaceholder();
    params[placeholder] = param;
    if (columnTypes[column] === 'json') {
      statements.push(`${column} = jsonb($${placeholder})`);
    }
    else {
      statements.push(`${column} = $${placeholder}`);
    }
  }
  return statements.join(', ');
}

const update = (args) => {
  const { 
    db,
    table,
    options,
    tx
  } = args;
  const { where, set, log } = options;
  const keys = Object.keys(set);
  verify(keys);
  const params = {};
  const query = adjust(db, table, set);
  const setString = createSetClause(db, table, query, params);
  let sql = `update ${table} set ${setString}`;
  if (where) {
    const clause = toWhere({
      table,
      query: where,
      params
    });
    if (clause) {
      sql += ` where ${clause}`;
    }
  }
  const runOptions = {
    query: sql,
    params: db.adjust(params),
    tx,
    adjusted: true
  };
  return withLog(db, runOptions, log, 'run');
}

const getOrderBy = (orderBy, params) => {
  if (typeof orderBy === 'function') {
    const { createClause } = expressionHandler(orderBy);
    return createClause(params);
  }
  const columns = Array.isArray(orderBy) ? orderBy : [orderBy];
  return columns.map(c => nameToSql(c)).join(', ');
}

const toKeywords = (keywords, params, table, columns) => {
  let sql = '';
  if (keywords) {
    const { rank, bm25, orderBy, desc, limit, offset } = keywords;
    if (rank) {
      sql += ' order by rank';
    }
    if (bm25) {
      sql += ` order by bm25(${table}, `;
      const values = [];
      for (const column of columns) {
        if (column.name === 'rowid') {
          continue;
        }
        const value = bm25[column.name];
        if (typeof value === 'number') {
          values.push(value);
        }
      }
      sql += values.join(', ');
      sql += ')';
    }
    if (orderBy) {
      const clause = getOrderBy(orderBy, params);
      sql += ` order by ${clause}`;
      if (desc) {
        sql += ' desc';
      }
    }
    if (limit !== undefined) {
      if (Number.isInteger(limit)) {
        const placeholder = getPlaceholder();
        params[placeholder] = limit;
        sql += ` limit $${placeholder}`;
      }
    }
    if (offset !== undefined) {
      if (Number.isInteger(offset)) {
        const placeholder = getPlaceholder();
        params[placeholder] = offset;
        sql += ` offset $${placeholder}`;
      }
    }
  }
  return sql;
}

const exists = (config) => {
  const {
    db,
    table,
    tx,
    subquery,
  } = config;
  const query = config.query || {};
  const params = {};
  const clause = subquery ? `(${subquery.sql})` : table;
  let sql = `select exists(select 1 from ${clause}`;
  sql += addClauses(table, query, params);
  sql += ') as exists_result';
  const options = {
    query: sql,
    params,
    tx
  };
  const post = (results) => {
    if (results.length > 0) {
      return Boolean(results[0].exists_result);
    }
    return undefined;
  }
  if (tx && tx.isBatch) {
    return processBatch(db, options, post);
  }
  const results = db.all(options);
  return post(results);
}

const addClauses = (table, query, params) => {
  let sql = '';
  const where = toWhere(table, query, params);
  if (where) {
    sql += ` where ${where}`;
  }
  return sql;
}

const makeJsonArray = (types, columns) => {
  let sql = `json_group_array(json_object(`;
  const mapped = columns.map(column => {
    let selector = column;
    if (types) {
      selector = jsonSelector(types[column], column);
    }
    return `'${column}', ${selector}`;
  });
  sql += mapped.join(', ');
  sql += `))`;
  return sql;
}

const group = (config) => {
  const {
    db,
    table,
    method,
    query,
    tx,
    subquery
  } = config;
  const { select, column, distinct, where, log, ...keywords } = query;
  const alias = Object.keys(select || column || distinct).at(0);
  verify(alias);
  let having;
  let adjustedWhere = where;
  const whereKeys = where ? Object.keys(where) : [];
  if (whereKeys.includes(method)) {
    having = {
      [method]: where[method]
    };
    adjustedWhere = {};
    for (const [key, value] of Object.entries(where)) {
      if (key === method) {
        continue;
      }
      adjustedWhere[key] = value;
    }
    if (whereKeys.length === 1) {
      adjustedWhere = null;
    }
  }
  const hasKeywords = Object.keys(keywords).length > 0;
  const by = Array.isArray(config.by) ? config.by : [config.by];
  const params = {};
  const computed = subquery ? null : db.computed[table][alias];
  if (computed) {
    throw Error(`the alias cannot have the same name as a computed field.`);
  }
  const columnTypes = db.columns[table];
  const byClause = by.map(c => nameToSql(c)).join(', ');
  const tableClause = subquery ? `(${subquery.sql})` : table;
  let sql = `select ${byClause}, `;
  if (method !== 'array') {
    const options = column || distinct;
    const field = nameToSql(options[alias]);
    let body = '';
    if (distinct) {
      body += 'distinct ';
    }
    if (field === true) {
      body += '*';
    }
    else {
      body += field;
    }
    const actualMethod = method === 'sum' ? 'total' : method;
    sql += `${actualMethod}(${body}) as ${method} from ${tableClause}`;
  }
  else {
    const fields = select[alias];
    if (fields === true) {
      const columns = Object.keys(db.columns[table]);
      sql += makeJsonArray(columnTypes, columns);
    }
    else {
      sql += `json_group_array(${nameToSql(fields)})`;
    }
    sql += ` as ${method} from ${tableClause}`;
  }
  if (adjustedWhere) {
    const clause = toWhere({
      table,
      query: adjustedWhere,
      params
    });
    if (clause) {
      sql += ` where ${clause}`;
    }
  }
  sql += ` group by ${byClause}`;
  if (having) {
    const clauses = toWhere({
      query: having,
      params
    });
    if (clauses) {
      sql += ` having ${clauses}`;
    }
  }
  if (hasKeywords) {
    sql += toKeywords(keywords, params);
  }
  const withTable = 'flyweight_alias';
  sql = `with ${withTable} as (${sql}) select ${by.map(c => nameToSql(c)).join(', ')}, ${method} as ${alias} from ${withTable}`;
  const options = {
    query: sql,
    params: db.adjust(params),
    tx,
    adjusted: true
  };
  const post = (rows) => {
    if (rows.length === 0) {
      return rows;
    }
    let byParser;
    if (subquery) {
      byParser = db.getDbToJsConverter(subquery.columns[by]);
    }
    else {
      byParser = db.getDbToJsConverter(db.columns[table][by]);
    }
    const selectColumn = select ? Object.keys(select).at(0) : null;
    if (!byParser && !selectColumn) {
      return rows;
    }
    const parser = db.getDbToJsConverter('json');
    for (let i = 0; i < rows.length; i++) {
      if (byParser) {
        rows[i][by] = byParser(rows[i][by]);
      }
      if (selectColumn) {
        rows[i][selectColumn] = parser(rows[i][selectColumn]);
      }
    }
    return rows;
  }
  if (tx && tx.isBatch) {
    return processBatch(db, options, post);
  }
  const rows = withLog(db, options, log);
  return post(rows);
}

const aggregate = (config) => {
  const {
    db,
    table,
    tx,
    method,
    subquery,
  } = config;
  const params = {};
  const query = config.query || {};
  const { where, column, distinct, log } = query;
  const alias = `${method}_result`;
  const actualMethod = method === 'sum' ? 'total' : method;
  let expression;
  if (!column && !distinct) {
    if (method !== 'count') {
      throw Error('aggregate needs to specify a column');
    }
    expression = `count(*) as ${alias}`;
  }
  else {
    const field = nameToSql(column || distinct);
    const before = distinct === undefined ? '' : 'distinct ';
    expression = `${actualMethod}(${before}${field}) as ${alias}`;
  }
  let sql;
  const whereClause = toWhere({
    query: where,
    params
  });
  const tableClause = subquery ? `(${subquery.sql})` : table;
  sql = `select ${expression} from ${tableClause}`;
  if (whereClause) {
    sql += ` where ${whereClause}`;
  }
  const options = {
    query: sql,
    params: db.adjust(params),
    tx,
    adjusted: true
  };
  const post = (results) => {
    if (results.length > 0) {
      const value = results[0][`${method}_result`];
      if (method == 'min' || method === 'max') {
        const field = distinct || column;
        return db.convertToJs(table, field, value);
      }
      return value;
    }
    return undefined;
  };
  if (tx && tx.isBatch) {
    return processBatch(db, options, post);
  }
  const rows = withLog(db, options, log);
  return post(rows);
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

const invertOmit = (all, omit) => {
  const remove = typeof omit === 'string' ? [omit] : omit;
  return all.filter(t => !remove.includes(t));
}

const expandStar = (types, computed) => {
  const names = Object.keys(types);
  const statements = [];
  for (const [column, type] of Object.entries(types)) {
    const adjusted = nameToSql(column);
    const sql = computed[column];
    if (sql) {
      statements.push(`${sql} as ${column}`);
      continue;
    }
    else if (type === 'json') {
      statements.push(`json(${adjusted}) as ${adjusted}`);
    }
    else {
      statements.push(adjusted);
    }
  }
  return {
    names,
    clause: statements.join(', ')
  }
}

const toSelect = (args) => {
  const { 
    columns,
    types,
    computed
  } = args;
  const toSql = (column) => {
    verify(column);
    const adjusted = nameToSql(column);
    const sql = computed[column];
    if (sql) {
      return `${sql} as ${column}`;
    }
    else if (types[column] === 'json') {
      return `json(${adjusted}) as ${adjusted}`;
    }
    return adjusted;
  }
  if (columns) {
    if (typeof columns === 'string') {
      const clause = toSql(columns);
      return {
        names: [columns],
        clause
      }
    }
    else if (Array.isArray(columns) && columns.length > 0) {
      const names = [];
      const statements = [];
      for (const column of columns) {
        if (typeof column === 'string') {
          const clause = toSql(column);
          names.push(column);
          statements.push(clause);
        }
      }
      return {
        names,
        clause: statements.join(', ')
      }
    }
    else if (Array.isArray(columns) && columns.length === 0) {
      throw Error('the select argument cannot be an empty array');
    }
    return expandStar(types, computed);
  }
  return expandStar(types, computed);
}

const getVirtualSelect = (keywords, table, columns, params) => {
  const { highlight, snippet } = keywords;
  const keys = Object.keys(columns).filter(k => k !== 'rowid');
  if (highlight) {
    verify(highlight.column);
    const i = getPlaceholder();
    const s = getPlaceholder();
    const e = getPlaceholder();
    params[i] = keys.findIndex(name => name === highlight.column);
    params[s] = highlight.tags[0];
    params[e] = highlight.tags[1];
    return {
      clause: `rowid as id, highlight(${table}, $${i}, $${s}, $${e}) as highlight`,
      names: ['highlight']
    }
  }
  if (snippet) {
    verify(snippet.column);
    const i = getPlaceholder();
    const s = getPlaceholder();
    const e = getPlaceholder();
    const tr = getPlaceholder();
    const to = getPlaceholder();
    params[i] = keys.findIndex(name => name === snippet.column);
    params[s] = snippet.tags[0];
    params[e] = snippet.tags[1];
    params[tr] = snippet.trailing;
    params[to] = snippet.tokens;
    return {
      clause: `rowid as id, snippet(${table}, $${i}, $${s}, $${e}, $${tr}, $${to}) as snippet`,
      names: ['snippet']
    }
  }
}

const escape = (phrase) => {
  return `"${phrase.replaceAll(/"/g, '""')}"`;
}

const toSql = (phrases, type) => {
  if (typeof phrases === 'string') {
    const phrase = escape(phrases);
    const logic = type ? 'NOT ' : '';
    return `${logic}${phrase}`;
  }
  else if (Array.isArray(phrases)) {
    if (type === 'NOT') {
      const joined = phrases
        .map(p => escape(p))
        .join(' OR ');
      return `NOT (${joined})`;
    }
    else {
      let sql = '(';
      for (const phrase of phrases) {
        if (typeof phrase === 'string') {
          sql += escape(phrase);
        }
        else {
          const key = Object.keys(phrase).at(0);
          let subType;
          if (['and', 'or', 'not'].includes(key)) {
            subType = key.toUpperCase();
          }
          if (subType === 'NOT') {
            if (sql.endsWith(` ${type} `)) {
              sql = sql.slice(0, -(type.length + 1));
            }
          }
          const value = subType ? Object.values(phrase).at(0) : phrase;
          sql += toSql(value, subType);
        }
        sql += ` ${type} `;
      }
      sql = sql.slice(0, -(type.length + 2));
      sql += ')';
      return sql;
    }
  }
  else {
    const key = Object.keys(phrases).at(0);
    const value = Object.values(phrases).at(0);
    if (key === 'startsWith') {
      return `^ ${toSql(value)}`;
    }
    return `${toSql(value)} *`;
  }
}

const parse = (query) => {
  if (typeof query === 'string') {
    return toSql(query);
  }
  const { 
    phrase,
    near,
    startsWith,
    prefix,
  } = query;
  if (phrase) {
    return toSql(phrase);
  }
  const key = Object
    .keys(query)
    .filter(k => ['and', 'or', 'not'].includes(k))
    .at(0);
  if (key) {
    const type = key.toUpperCase();
    const phrases = query[key];
    return toSql(phrases, type);
  }
  if (near) {
    const clone = [...near];
    const distance = clone.pop();
    if (typeof distance !== 'number') {
      throw Error(`Invalid distance for near: ${distance}`);
    }
    return `NEAR(${clone.map(p => toSql(p)).join(' ')}, ${distance})`;
  }
  if (startsWith !== undefined) {
    return toSql({ startsWith });
  }
  if (prefix !== undefined) {
    return toSql({ prefix });
  }
}

const withLog = (db, options, log, type = 'all') => {
  let rows;
  let error;
  if (log) {
    const start = Date.now();
    try {
      rows = db[type](options);
    }
    catch (e) {
      error = e;
    }
    const data = {
      sql: options.query,
      params: options.params,
      durationMs: Date.now() - start
    };
    if (typeof log === 'boolean') {
      console.log(data);
    }
    else {
      log(data);
    }
  }
  else {
    try {
      rows = db[type](options);
    }
    catch (e) {
      error = e;
    }
  }
  if (error) {
    throw error;
  }
  return rows;
}

const match = (config) => {
  const {
    db,
    table,
    query,
    tx
  } = config;
  let sql;
  const params = {};
  let select = '*';
  if (query.select) {
    select = query
      .select
      .map(c => {
        verify(c);
        return nameToSql(c);
      })
      .join(', ');
  }
  else if (query.return) {
    verify(query.return);
    select = nameToSql(query.return);
  }
  if (query.where) {
    const statements = [];
    for (const [key, value] of Object.entries(query.where)) {
      verify(key);
      const placeholder = getPlaceholder();
      params[placeholder] = parse(value);
      statements.push(`${nameToSql(key)} match $${placeholder}`);
    }
    sql = `select ${select} from ${table} where ${statements.join(' and ')}`;
  }
  else {
    const placeholder = getPlaceholder();
    sql = `select ${select} from ${table} where ${table} match $${placeholder}`;
    params[placeholder] = parse(query);
  }
  sql += toKeywords(query, params);
  const options = {
    query: sql,
    params: db.adjust(params),
    tx,
    adjusted: true
  };
  const rows = withLog(db, options, query.log);
  if (query.return) {
    return rows.map(r => r[query.return]);
  }
  return rows;
}

const all = (config) => {
  const {
    db,
    table,
    first,
    tx,
    subquery,
    type
  } = config;
  const params = {};
  let query = config.query || {};
  let columns = config.columns;
  let keywords;
  const log = query.log;
  if (type === 'complex') {
    const { where, select, return: returning, omit, ...rest } = query;
    if (select && !Array.isArray(select)) {
      throw Error('the select argument should be an array');
    }
    query = where || {};
    if (omit) {
      const all = Object.keys(db.columns[table]);
      columns = invertOmit(all, omit);
    }
    else {
      columns = select || returning;
    }
    keywords = rest;
  }
  const returnValue = typeof columns === 'string';
  const types = subquery ? subquery.columns : db.columns[table];
  let select;
  if (keywords && (keywords.highlight || keywords.snippet)) {
    select = getVirtualSelect(keywords, table, types, params);
  }
  else {
    select = toSelect({ 
      columns,
      types,
      computed: db.computed[table] || {}
    });
  }
  let sql = 'select ';
  if (keywords && keywords.distinct) {
    sql += 'distinct ';
  }
  const tableClause = subquery ? `(${subquery.sql})` : table;
  sql += `${select.clause} from ${tableClause}`;
  const clause = toWhere({
    query,
    params
  });
  if (clause) {
    sql += ` where ${clause}`;
  }
  sql += toKeywords(keywords, params, table, db.tables[table]);
  if (first) {
    sql += ' limit 1';
  }
  const options = {
    query: sql,
    params: db.adjust(params),
    tx,
    adjusted: true
  };
  const post = (rows) => {
    if (rows.length === 0) {
      if (first) {
        return undefined;
      }
      return rows;
    }
    const sample = rows[0];
    const keys = Object.keys(sample);
    let parsers;
    if (subquery) {
      parsers = keys
        .map(key => {
          const type = subquery.columns[key];
          const converter = db.getDbToJsConverter(type);
          return [key, converter];
        })
        .filter(item => item[1] !== null);
    }
    else {
      parsers = keys
        .map(key => [key, db.getDbToJsConverter(db.columns[table][key])])
        .filter(item => item[1] !== null);
    }
    if (parsers.length > 0) {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        for (const [key, parser] of parsers) {
          row[key] = parser(row[key]);
        }
      }
    }
    if (returnValue) {
      const key = keys[0];
      const mapped = rows.map(item => item[key]);
      if (first) {
        if (mapped.length > 0) {
          return mapped.at(0);
        }
        return undefined;
      }
      return mapped;
    }
    if (first) {
      if (rows.length > 0) {
        return rows.at(0);
      }
      return undefined;
    }
    return rows;
  };
  if (tx && tx.isBatch) {
    return processBatch(db, options, post);
  }
  const rows = withLog(db, options, log);
  return post(rows);
}

const remove = (args) => {
  const { 
    db,
    table,
    query,
    tx
  } = args;
  let sql = `delete from ${table}`;
  const params = {};
  if (query) {
    if (typeof query !== 'object') {
      throw Error(`invalid argument to delete: ${query}`);
    }
    else {
      const key = Object.keys(query).at(0);
      if (!key || !Object.keys(db.columns[table]).includes(key)) {
        throw Error(`table ${table} has no column: ${key}`);
      }
    }
  }
  const clause = toWhere({
    table,
    query,
    params
  });
  if (clause) {
    sql += ` where ${clause}`;
  }
  const options = {
    query: sql,
    params,
    tx
  };
  return db.run(options);
}

export {
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
}
