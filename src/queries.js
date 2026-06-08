import { 
  createPlaceholder, 
  jsonSelector,
  nameToSql
} from './utils.js';
import { compareOperators } from './methods.js';
import { tableRequests } from './tables.js';
import { makeTableProxy } from './symbols.js';
import { processMethod } from './requests.js';

const getConditions = (args) => {
  const {
    column,
    query,
    params,
    getPlaceholder
  } = args;
  const value = query.arg;
  const method = query.method;
  if (!compareOperators.has(method)) {
    throw Error(`invalid operator: ${method}`);
  }
  const selector = column.name;
  const conditions = [];
  if (column.type === 'zonedDateTime') {
    const operator = compareOperators.get(method);
    const placeholder = getPlaceholder();
    params[placeholder] = value;
    const param = `$${placeholder}`;
    const sql = `temporal_compare(${selector}, ${param}) ${operator} 0`;
    conditions.push(sql);
  }
  else if (method === 'not') {
    if (Array.isArray(value)) {
      const placeholder = getPlaceholder();
      params[placeholder] = value;
      conditions.push(`${selector} not in (select json_each.value from json_each($${placeholder}))`);
    }
    else if (value === null) {
      conditions.push(`${selector} is not null`);
    }
    else {
      const placeholder = getPlaceholder();
      params[placeholder] = value;
      conditions.push(`${selector} != $${placeholder}`);
    }
  }
  else if (method === 'like' && value instanceof RegExp) {
    const source = getPlaceholder();
    const flags = getPlaceholder();
    params[source] = value.source;
    params[flags] = value.flags;
    conditions.push(`regex(${selector}, $${source}, $${flags})`);
  }
  else {
    const operator = compareOperators.get(method);
    const placeholder = getPlaceholder();
    params[placeholder] = value;
    conditions.push(`${selector} ${operator} $${placeholder}`);
  }
  return conditions;
}

const adjust = (db, table, params) => {
  const columnTypes = db.columns[table];
  const processed = {};
  for (const [name, value] of Object.entries(params)) {
    if (columnTypes[name] === 'json' && typeof value === 'string') {
      processed[name] = JSON.stringify(value);
    }
    else {
      processed[name] = value;
    }
  }
  return db.adjust(processed);
}

const makeInsertSql = (args) => {
  const {
    db,
    table,
    query,
    params,
    getPlaceholder
  } = args;
  const columns = Object.keys(query);
  const columnTypes = db.columns[table];
  const placeholders = columns.map(columnName => {
    const placeholder = getPlaceholder();
    params[placeholder] = query[columnName];
    if (columnTypes[columnName] === 'json') {
      return `jsonb($${placeholder})`;
    }
    return `$${placeholder}`;
  });
  return `insert into ${table}(${columns.map(c => nameToSql(c)).join(', ')}) values(${placeholders.join(', ')})`;
}

const processInsert = (args) => {
  const { db, table, sql, params, returning, log } = args;
  const primaryKey = db.getPrimaryKey(table);
  const types = db.columns[table];
  let query = sql;
  let result;
  if (returning) {
    result = getParser(db, types);
    const expanded = expandStar(types);
    query += ` returning ${expanded.clause}`;
  }
  else {
    result = getParser(db, types, [primaryKey]);
    query += ` returning ${nameToSql(primaryKey)}`;
  }
  const options = {
    query,
    params,
    adjusted: true,
    bigInt: result.bigInt
  };
  const row = withLog(db, options, log).at(0);
  if (result.parse) {
    result.parse(row);
  }
  if (returning) {
    return row;
  }
  return row[primaryKey];
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
    returning
  } = args;
  const getPlaceholder = createPlaceholder();
  const { values, target, set, log } = options;
  const params = {};
  const columns = Object.keys(values);
  const query = adjust(db, table, values);
  let sql = makeInsertSql({
    db,
    table,
    query,
    params,
    getPlaceholder
  });
  verify(Object.keys(values));
  if (target && set) {
    verify([target]);
    verify(Object.keys(set));
    const query = adjust(db, table, set);
    const setClause = createSetClause({
      db,
      table,
      query,
      params,
      getPlaceholder
    });
    sql += ` on conflict(${target}) do update set ${setClause}`;
  }
  else {
    sql += ' on conflict do nothing';
  }
  return processInsert({
    db,
    sql,
    table,
    params,
    returning,
    log
  });
}

const insert = (args) => {
  const { 
    db,
    table,
    values,
    returning
  } = args;
  const getPlaceholder = createPlaceholder();
  const columns = Object.keys(values);
  verify(columns);
  const adjusted = adjust(db, table, values);
  const params = {};
  const sql = makeInsertSql({
    db,
    table,
    query: adjusted,
    params,
    getPlaceholder
  });
  return processInsert({
    db,
    sql,
    table,
    params,
    returning
  });
}

const batchInserts = (args) => {
  const {
    db,
    table,
    items,
    bigInt,
    returning
  } = args;
  const getPlaceholder = createPlaceholder();
  const inserts = [];
  const returned = [];
  for (const item of items) {
    const params = {};
    const adjusted = adjust(db, table, item);
    let sql = makeInsertSql({
      db,
      table,
      query: adjusted,
      params,
      getPlaceholder
    });
    if (returning) {
      const result = expandStar(db.columns[table]);
      sql += ` returning ${result.clause}`;
    }
    inserts.push({
      query: sql,
      params,
      adjusted: true,
      bigInt
    });
  }
  const method = returning ? 'all' : 'run';
  const insert = () => {
    for (const insert of inserts) {
      const result = db[method](insert);
      if (returning) {
        returned.push(result);
      }
    }
  }
  if (db.inTransaction) {
    insert();
  }
  else {
    try {
      db.begin();
      insert();
      db.commit();
    }
    catch (e) {
      db.rollback();
      throw e;
    }
  }
  if (returning) {
    return returned;
  }
}

const shapes = (items) => {
  const map = new Map();
  for (const item of items) {
    const key = Object.keys(item).join(' ');
    const existing = map.get(key);
    if (existing) {
      existing.push(item);
    }
    else {
      map.set(key, [item]);
    }
  }
  return map.values();
}

const insertMany = (args) => {
  const {
    db,
    table,
    items,
    returning
  } = args;
  if (items.length === 0) {
    return;
  }
  const columnTypes = db.columns[table];
  const result = shapes(items);
  const returned = [];
  for (const items of result) {
    const first = items.at(0);
    const columns = Object.keys(first);
    verify(columns);
    const types = db.tables[table]
      .filter(c => columns.includes(c.name));
    const hasBlob = types.some(c => c.type === 'blob');
    const { parse, bigInt } = getParser(db, columnTypes);
    if (hasBlob) {
      const rows = batchInserts({
        db,
        table,
        items,
        bigInt,
        returning
      });
      if (returning) {
        if (parse) {
          for (const row of rows) {
            parse(row);
          }
        }
        returned.push(...rows);
      }
      continue;
    }
    const mapped = columns
      .map(c => nameToSql(c))
      .join(', ');
    let sql = `insert into ${table}(${mapped}) select `;
    const select = columns.map(column => {
      if (columnTypes[column] === 'json') {
        return `jsonb(json_each.value ->> '${column}')`;
      }
      if (columnTypes[column] === 'bigInt') {
        return `cast(json_each.value ->> '${column}' as integer)`;
      }
      return `json_each.value ->> '${column}'`;
    }).join(', ');
    sql += select;
    sql += ' from json_each($items)';
    let adjusted;
    if (bigInt) {
      const replacer = (key, value) => {
        return typeof value === 'bigint' ? value.toString() : value;
      };
      adjusted = JSON.stringify(items, replacer);
    }
    else {
      adjusted = JSON.stringify(items);
    }
    const params = {
      items: adjusted
    };
    if (returning) {
      const result = expandStar(columnTypes);
      sql += ` returning ${result.clause}`;
    }
    const options = {
      query: sql,
      params,
      bigInt
    };
    if (!returning) {
      db.run(options);
    }
    else {
      const rows = db.all(options);
      if (parse) {
        for (const row of rows) {
          parse(row);
        }
      }
      returned.push(...rows);
    }
  }
  return returned;
}

const toWhere = (options) => {
  const {
    query,
    params,
    logic,
    getPlaceholder,
    columnTypes,
    internal
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
    const isLogic = ['and', 'or'].includes(column);
    const adjusted = isLogic ? column : nameToSql(column);
    if (isLogic) {
      if (!Array.isArray(param)) {
        throw Error(`the "${column}" property value must be an array of conditions`);
      }
      const filters = [];
      for (const query of param) {
        const clauses = toWhere({
          query,
          params,
          logic: column,
          getPlaceholder,
          columnTypes,
          internal: true
        });
        filters.push(clauses);
      }
      conditions.push(`(${filters.join(` ${column} `)})`);
    }
    else if (typeof param === 'symbol') {
      const request = tableRequests.get(param);
      tableRequests.delete(param);
      const query = {
        method: request.name,
        arg: request.args.at(0)
      };
      const result = getConditions({
        column: {
          name: adjusted,
          type: columnTypes[column]
        },
        query,
        params,
        getPlaceholder
      });
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
      if (columnTypes[column] === 'zonedDateTime') {
        conditions.push(`temporal_compare(${adjusted}, $${placeholder}) = 0`);
      }
      else {
        conditions.push(`${adjusted} = $${placeholder}`);
      }
    }
  }
  const sql = conditions.join(` ${logic || 'and'} `);
  if (!internal && sql.startsWith('(')) {
    return sql.slice(1, -1);
  }
  return sql;
}

const processFunction = (args) => {
  const {
    db,
    table,
    params,
    getPlaceholder,
    lambda
  } = args;
  const requests = new Map();
  const proxy = makeTableProxy({
    db,
    table,
    requests
  });
  const symbol = lambda(proxy);
  const request = tableRequests.get(symbol);
  tableRequests.delete(symbol);
  const getRequest = (symbol) => {
    let request = requests.get(symbol);
    if (!request) {
      request = tableRequests.get(symbol);
      tableRequests.delete(symbol);
    }
    return request;
  }
  const result = processMethod({
    db,
    method: request,
    params,
    requests,
    getRequest,
    getPlaceholder
  });
  return result.sql;
}

const createSetClause = (args) => {
  const {
    db, 
    table, 
    query, 
    params, 
    getPlaceholder
  } = args;
  const statements = [];
  const columnTypes = db.columns[table];
  for (const [column, param] of Object.entries(query)) {
    if (typeof param === 'function') {
      const sql = processFunction({
        db,
        table,
        params,
        getPlaceholder,
        lambda: param
      });
      statements.push(`${column} = ${sql}`);
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
    options
  } = args;
  const getPlaceholder = createPlaceholder();
  const { where, set, log } = options;
  const keys = Object.keys(set);
  verify(keys);
  const params = {};
  const query = adjust(db, table, set);
  const setString = createSetClause({
    db, 
    table, 
    query, 
    params, 
    getPlaceholder
  });
  let sql = `update ${table} set ${setString}`;
  if (where) {
    const clause = toWhere({
      query: where,
      params,
      getPlaceholder,
      columnTypes: db.columns[table]
    });
    if (clause) {
      sql += ` where ${clause}`;
    }
  }
  const runOptions = {
    query: sql,
    params: db.adjust(params),
    adjusted: true
  };
  return withLog(db, runOptions, log, 'run');
}

const toKeywords = (args) => {
  const {
    db,
    keywords,
    params,
    table,
    columns,
    getPlaceholder,
    columnTypes
  } = args;
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
      let clause;
      if (typeof orderBy === 'function') {
        clause = processFunction({
          db,
          table,
          params,
          getPlaceholder,
          lambda: orderBy
        });
      }
      else {
        const columns = Array.isArray(orderBy) ? orderBy : [orderBy];
        const mapped = columns.map(column => {
          const name = nameToSql(column);
          if (columnTypes[column] === 'zonedDateTime') {
            return `temporal_nanoseconds(${name})`;
          }
          return name;
        });
        clause = mapped.join(', ');
      }
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
    subquery,
  } = config;
  const getPlaceholder = createPlaceholder();
  const query = config.query || {};
  const params = {};
  const clause = subquery ? `(${subquery.sql})` : table;
  let sql = `select exists(select 1 from ${clause}`;
  const columnTypes = subquery ? subquery.columns : db.columns[table];
  const where = toWhere({
    query,
    params,
    getPlaceholder,
    columnTypes
  });
  if (where) {
    sql += ` where ${where}`;
  }
  sql += ') as exists_result';
  const options = {
    query: sql,
    params
  };
  const results = db.all(options);
  if (results.length > 0) {
    return Boolean(results[0].exists_result);
  }
  return undefined;
}

const aggregate = (config) => {
  const {
    db,
    table,
    method,
    subquery
  } = config;
  const getPlaceholder = createPlaceholder();
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
  const columnTypes = subquery ? subquery.columns : db.columns[table];
  const whereClause = toWhere({
    query: where,
    params,
    getPlaceholder,
    columnTypes
  });
  const tableClause = subquery ? `(${subquery.sql})` : table;
  sql = `select ${expression} from ${tableClause}`;
  if (whereClause) {
    sql += ` where ${whereClause}`;
  }
  let bigInt;
  if (method !== 'count') {
    bigInt = db.columns[table][distinct || column];
  }
  const options = {
    query: sql,
    params: db.adjust(params),
    adjusted: true,
    bigInt
  };
  const rows = withLog(db, options, log);
  if (rows.length > 0) {
    const value = rows[0][`${method}_result`];
    if (method == 'min' || method === 'max') {
      const type = db.columns[table][distinct || column];
      const converter = db.getDbToJsParser(type);
      return converter ? converter(value) : value;
    }
    return value;
  }
  return undefined;
}

const getConverters = (key, value, db, converters, keys = [], optional = []) => {
  keys.push(key);
  if (typeof value.type === 'string') {
    optional.push(value.isOptional);
    if (value.functionName && /^json_/i.test(value.functionName)) {
      return;
    }
    const converter = db.getDbToJsParser(value.type);
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

const invertOmit = (all, omit) => {
  const remove = typeof omit === 'string' ? [omit] : omit;
  return all.filter(t => !remove.includes(t));
}

const expandStar = (types, computed = {}) => {
  const names = Object.keys(types);
  const statements = [];
  for (const [column, type] of Object.entries(types)) {
    const adjusted = nameToSql(column);
    const sql = computed[column];
    if (sql) {
      statements.push(`${sql} as ${adjusted}`);
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
      return `${sql} as ${adjusted}`;
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

const getVirtualSelect = (args) => {
  const {
    keywords,
    table,
    columns,
    params,
    getPlaceholder
  } = args;
  const keys = Object.keys(columns).filter(k => k !== 'rowid');
  const { highlight, snippet } = keywords;
  if (highlight) {
    verify(highlight.column);
    const i = getPlaceholder();
    const s = getPlaceholder();
    const e = getPlaceholder();
    const index = keys.findIndex(name => name === highlight.column);
    if (index === -1) {
      throw Error(`highlight column "${higlight.column}" doesn't exist`);
    }
    params[i] = index;
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
  return `"${phrase.replaceAll('"', '""')}"`;
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
    query
  } = config;
  const getPlaceholder = createPlaceholder();
  let sql;
  const params = {};
  const types = db.columns[table];
  let select = '*';
  if (query.select) {
    select = query
      .select
      .map(c => {
        verify(c);
        const sql = nameToSql(c);
        if (types[c] === 'json') {
          return `json(${sql})`;
        }
        return sql;
      })
      .join(', ');
  }
  else if (query.return) {
    verify(query.return);
    const sql = nameToSql(query.return);
    if (types[query.return] === 'json') {
      select = `json(${sql})`;
    }
    else {
      select = sql;
    }
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
  sql += toKeywords({
    db,
    table,
    keywords: query,
    params,
    getPlaceholder,
    columnTypes: db.columns[table]
  });
  const options = {
    query: sql,
    params: db.adjust(params),
    adjusted: true
  };
  const rows = withLog(db, options, query.log);
  if (query.return) {
    return rows.map(r => r[query.return]);
  }
  return rows;
}

const getParser = (db, types, columns) => {
  const keys = columns ? columns : Object.keys(types);
  const bigInt = keys.some(key => types[key] === 'bigInt');
  const intParser = (v) => v === null ? null : Number(v);
  const parsers = [];
  for (const key of keys) {
    const type = key === 'rowid' ? 'integer' : types[key];
    if (bigInt && type === 'integer') {
      parsers.push([key, intParser]);
    }
    else {
      const parser = db.getDbToJsParser(type);
      if (parser) {
        parsers.push([key, parser]);
      }
    }
  }
  let parse;
  if (parsers.length > 0) {
    parse = (row) => {
      for (const [key, parser] of parsers) {
        row[key] = parser(row[key]);
      }
    }
  }
  return {
    parse,
    bigInt
  }
}

const all = (config) => {
  const {
    db,
    table,
    first,
    subquery,
    type
  } = config;
  const getPlaceholder = createPlaceholder();
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
    select = getVirtualSelect({
      keywords,
      table,
      columns: types,
      params,
      getPlaceholder
    });
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
  const columnTypes = subquery ? subquery.columns : db.columns[table];
  const clause = toWhere({
    query,
    params,
    getPlaceholder,
    columnTypes
  });
  if (clause) {
    sql += ` where ${clause}`;
  }
  sql += toKeywords({
    db,
    keywords,
    params,
    table,
    columns: db.tables[table],
    getPlaceholder,
    columnTypes
  });
  if (first) {
    sql += ' limit 1';
  }
  let keys;
  if (columns) {
    if (!Array.isArray(columns)) {
      keys = [columns];
    }
    else {
      keys = columns;
    }
  }
  else {
    keys = Object.keys(db.columns[table]);
  }
  const { parse, bigInt } = getParser(db, columnTypes, keys);
  const options = {
    query: sql,
    params: db.adjust(params),
    adjusted: true,
    bigInt
  };
  const rows = withLog(db, options, log);
  if (rows.length === 0) {
    if (first) {
      return undefined;
    }
    return rows;
  }
  if (parse) {
    for (const row of rows) {
      parse(row);
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
}

const remove = (args) => {
  const { 
    db,
    table,
    query
  } = args;
  const getPlaceholder = createPlaceholder();
  let sql = `delete from ${table}`;
  const params = {};
  if (query) {
    if (typeof query !== 'object') {
      throw Error(`invalid argument to delete: ${query}`);
    }
  }
  const clause = toWhere({
    query,
    params,
    getPlaceholder,
    columnTypes: db.columns[table]
  });
  if (clause) {
    sql += ` where ${clause}`;
  }
  const options = {
    query: sql,
    params
  };
  return db.run(options);
}

export {
  insert,
  insertMany,
  update,
  upsert,
  exists,
  aggregate,
  match,
  all,
  remove
}
