import { parseQuery, isWrite } from './parsers/queries.js';
import { blank } from './parsers/utils.js';
import { getPlaceholder, expressionHandler } from './utils.js';
import methods from './methods.js';

const aggregateMethods = [
  'count',
  'avg',
  'min',
  'max',
  'sum',
  'total'
];

const queryMethods = [
  ...aggregateMethods,
  'first',
  'query',
  'get',
  'many',
  'group',
  'insert',
  'update',
  'upsert',
  'remove'
];

const getConditions = (column, query, params, adjuster) => {
  const operatorHandler = {
    get: function(target, property) {
      target.push(property);
      if (methods.has(property)) {
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
  if (!methods.has(method)) {
    throw Error(`Invalid operator: ${method}`);
  }
  const path = chain.length === 0 ? null : `$.${chain.join('.')}`;
  const placeholder = getPlaceholder();
  if (path) {
    params[placeholder] = path;
  }
  const select = adjuster ? adjuster(column) : column;
  const selector = path ? `json_extract(${select}, $${placeholder})` : select;
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
    const operator = methods.get(method);
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
  return `insert into ${table}(${columns.join(', ')}) values(${placeholders.join(', ')})`;
}

const processBatch = async (db, options, post) => {
  const result = await db.all(options);
  return {
    statement: result.statement,
    params: result.params,
    post: (meta) => {
      const response = result.post(meta);
      return post(response);
    }
  }
}

const processInsert = async (db, sql, params, primaryKey, tx) => {
  const options = {
    query: sql,
    params,
    tx,
    write: true,
    adjusted: true
  };
  const post = (result) => result[0][primaryKey];
  if (tx && tx.isBatch) {
    return await processBatch(db, options, post);
  }
  const result = await db.all(options);
  return post(result);
}

const verify = (columns) => {
  const names = Array.isArray(columns) ? columns : [columns];
  for (const name of names) {
    if (!/^[_a-z][a-z0-9_]+$/i.test(name)) {
      throw Error(`Invalid column name ${name}`);
    }
  }
}

const upsert = async (db, table, options, tx) => {
  if (!db.initialized) {
    await db.initialize();
  }
  const { values, target, set } = options;
  const params = {};
  const query = adjust(db, table, values);
  let sql = makeInsertSql(db, table, query, params);
  verify(Object.keys(values));
  if (target && set) {
    verify([target]);
    verify(Object.keys(set));
    const query = adjust(db, table, set);
    const computed = db.computed.get(table);
    const adjuster = (name) => adjustName({
      column: name,
      params,
      computed
    });
    const setClause = createSetClause(db, table, query, params, adjuster);
    sql += ` on conflict(${target}) do update set ${setClause}`;
  }
  else {
    sql += ' on conflict do nothing';
  }
  const primaryKey = db.getPrimaryKey(table);
  sql += ` returning ${primaryKey}`;
  return await processInsert(db, sql, params, primaryKey, tx);
}

const insert = async (db, table, values, tx) => {
  if (!db.initialized) {
    await db.initialize();
  }
  const columns = Object.keys(values);
  verify(columns);
  const adjusted = adjust(db, table, values);
  const params = {};
  const sql = makeInsertSql(db, table, adjusted, params);
  const primaryKey = db.getPrimaryKey(table);
  const query = `${sql} returning ${primaryKey}`;
  return await processInsert(db, query, params, primaryKey, tx);
}

const batchInserts = async (tx, db, table, items) => {
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
    return await Promise.all(inserts.map(insert => db.run(insert)));
  }
  await db.insertBatch(inserts);
}

const insertMany = async (db, table, items, tx) => {
  if (!db.initialized) {
    await db.initialize();
  }
  if (items.length === 0) {
    return;
  }
  const columnTypes = db.columns[table];
  const sample = items[0];
  const columns = Object.keys(sample);
  verify(columns);
  const hasBlob = db.tables[table].filter(c => columns.includes(c.name)).some(c => c.type === 'blob');
  if (hasBlob) {
    return await batchInserts(tx, db, table, items);
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
  return await db.run(options);
}

const toWhere = (options) => {
  const {
    query, 
    params, 
    type, 
    adjuster 
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
    const selector = adjuster ? adjuster(column) : column;
    if (column === 'and' || column === 'or') {
      if (!Array.isArray(param)) {
        throw Error(`The "${column}" property value must be an array of conditions`);
      }
      const filters = [];
      for (const query of param) {
        const clauses = toWhere({
          query,
          params,
          type: column,
          adjuster
        });
        filters.push(clauses);
      }
      conditions.push(`(${filters.join(` ${column} `)})`);
    }
    else if (typeof param === 'function') {
      const result = getConditions(column, param, params, adjuster);
      conditions.push(...result);
    }
    else if (Array.isArray(param)) {
      const placeholder = getPlaceholder();
      params[placeholder] = param;
      conditions.push(`${selector} in (select json_each.value from json_each($${placeholder}))`);
    }
    else if (param === null) {
      conditions.push(`${selector} is null`);
    }
    else {
      const placeholder = getPlaceholder();
      params[placeholder] = param;
      conditions.push(`${selector} = $${placeholder}`);
    }
  }
  return conditions.join(` ${type || 'and'} `);
}

const createSetClause = (db, table, query, params, adjuster) => {
  const statements = [];
  const columnTypes = db.columns[table];
  for (const [column, param] of Object.entries(query)) {
    if (typeof param === 'function') {
      const { createClause } = expressionHandler(param);
      const clause = createClause({
        params,
        adjuster
      });
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

const update = async (db, table, options, tx) => {
  if (!db.initialized) {
    await db.initialize();
  }
  const { where, set } = options;
  const keys = Object.keys(set);
  verify(keys);
  const params = {};
  const query = adjust(db, table, set);
  const computed = db.computed.get(table);
  const adjuster = (name) => adjustName({
    column: name,
    params,
    computed
  });
  const setString = createSetClause(db, table, query, params, adjuster);
  let sql = `update ${table} set ${setString}`;
  if (where) {
    const clause = toWhere({
      table,
      query: where,
      params,
      adjuster
    });
    if (clause) {
      sql += ` where ${clause}`;
    }
  }
  const runOptions = {
    query: sql,
    params,
    tx
  };
  return await db.run(runOptions);
}

const expandStar = (db, table) => {
  const columnTypes = db.columns[table];
  const names = Object.keys(columnTypes);
  if (!db.hasJson[table]) {
    const clause = names.join(', ');
    return {
      names,
      clause
    }
  }
  const statements = [];
  for (const [column, type] of Object.entries(columnTypes)) {
    if (type === 'json') {
      statements.push(`json(${column}) as ${column}`);
    }
    else {
      statements.push(column);
    }
  }
  return {
    names,
    clause: statements.join(', ')
  }
}

const toSelect = (db, table, columns, types, params) => {
  if (columns) {
    const computed = db.computed.get(table);
    if (typeof columns === 'string') {
      verify(columns);
      let clause;
      if (computed && computed.has(columns)) {
        const item = computed.get(columns);
        clause = item.createClause({
          params,
          alias: columns
        });
      }
      else if (types[columns] === 'json') {
        clause = `json(${columns}) as ${columns}`;
      }
      else {
        clause = columns;
      }
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
          verify(column);
          names.push(column);
          let statement;
          if (computed && computed.has(column)) {
            const item = computed.get(column);
            statement = item.createClause({
              params,
              alias: column
            });
          }
          else if (types[column] === 'json') {
            statement = `json(${column}) as ${column}`;
          }
          else {
            statement = column;
          }
          statements.push(statement);
        }
      }
      return {
        names,
        clause: statements.join(', ')
      }
    }
    return expandStar(db, table);
  }
  return expandStar(db, table);
}

const getOrderBy = (orderBy, params, adjuster) => {
  if (typeof orderBy === 'function') {
    const { createClause } = expressionHandler(orderBy);
    return createClause({
      params,
      adjuster
    });
  }
  const columns = Array.isArray(orderBy) ? orderBy : [orderBy];
  return columns
    .map(column => {
      return adjuster ? adjuster(column) : column;
    })
    .join(', ');
}

const toKeywords = (keywords, params, adjuster) => {
  let sql = '';
  if (keywords) {
    if (keywords.orderBy) {
      const orderBy = getOrderBy(keywords.orderBy, params, adjuster);
      sql += ` order by ${orderBy}`;
      if (keywords.desc) {
        sql += ' desc';
      }
    }
    if (keywords.limit !== undefined) {
      if (Number.isInteger(keywords.limit)) {
        const placeholder = getPlaceholder();
        params[placeholder] = keywords.limit;
        sql += ` limit $${placeholder}`;
      }
    }
    if (keywords.offset !== undefined) {
      if (Number.isInteger(keywords.offset)) {
        const placeholder = getPlaceholder();
        params[placeholder] = keywords.offset;
        sql += ` offset $${placeholder}`;
      }
    }
  }
  return sql;
}

const getVirtual = async (db, table, query, tx, keywords, select, returnValue, once) => {
  if (!db.initialized) {
    await db.initialize();
  }
  let params = {};
  if (keywords && keywords.highlight) {
    const highlight = keywords.highlight;
    verify(highlight.column);
    const index = db.tables[table].map((c, i) => ({ name: c.name, index: i })).find(c => c.name === highlight.column).index - 1;
    const i = getPlaceholder();
    const s = getPlaceholder();
    const e = getPlaceholder();
    params[i] = index;
    params[s] = highlight.tags[0];
    params[e] = highlight.tags[1];
    select = `rowid as id, highlight(${table}, $${i}, $${s}, $${e}) as highlight`;
  }
  if (keywords && keywords.snippet) {
    const snippet = keywords.snippet;
    verify(snippet.column);
    const index = db.tables[table].map((c, i) => ({ name: c.name, index: i })).find(c => c.name === highlight.column).index - 1;
    const i = getPlaceholder();
    const s = getPlaceholder();
    const e = getPlaceholder();
    const tr = getPlaceholder();
    const to = getPlaceholder();
    params[i] = index;
    params[s] = snippet.tags[0];
    params[e] = snippet.tags[1];
    params[tr] = snippet.trailing;
    params[to] = snippet.tokens;
    select = `rowid as id, snippet(${table}, $${i}, $${s}, $${e}, $${tr}, $${to}) as snippet`;
  }
  let sql = `select ${select} from ${table}`;
  if (query) {
    const statements = [];
    for (const [column, param] of Object.entries(query)) {
      verify(column);
      if (typeof param === 'function') {
        const result = getConditions(column, param, params);
        statements.push(...result);
      }
      else {
        const placeholder = getPlaceholder();
        params[placeholder] = param;
        statements.push(`${column} match $${placeholder}`);
      }
    }
    if (statements.length > 0) {
      sql += ` where ${statements.join(' and ')}`;
    }
  }
  if (keywords.rank) {
    sql += ' order by rank';
  }
  if (keywords.bm25) {
    sql += ` order by bm25(${table}, `;
    const values = [];
    for (const column of db.tables[table]) {
      if (column.name === 'rowid') {
        continue;
      }
      const value = keywords.bm25[column.name];
      if (typeof value === 'number') {
        values.push(value);
      }
    }
    sql += values.join(', ');
    sql += ')';
  }
  sql += toKeywords(keywords, params);
  const options = {
    query: sql,
    params,
    tx
  };
  const post = (results) => {
    if (once) {
      if (results.length === 0) {
        return undefined;
      }
      if (returnValue) {
        const result = results[0];
        const key = Object.keys(result)[0];
        return result[key];
      }
      return results[0];
    }
    if (results.length === 0) {
      return results;
    }
    if (returnValue) {
      const key = Object.keys(results[0])[0];
      return results.map(r => r[key]);
    }
    return results;
  }
  if (tx && tx.isBatch) {
    return await processBatch(db, options, post);
  }
  const results = await db.all(options);
  return post(results);
}

const exists = async (config) => {
  const {
    db,
    table,
    tx,
    groupKeys,
    debugResult
  } = config;
  if (!db.initialized) {
    await db.initialize();
  }
  const query = config.query || {};
  if (groupKeys.length > 0) {
    const result = await aggregate({ db, table, query, tx, method: 'count', groupKeys });
    return result.map(r => {
      const adjusted = {
        result: r.countResult > 0
      };
      for (const key of groupKeys) {
        adjusted[key] = r[key];
      }
    });
  }
  const params = {};
  const clause = db.getTableClause(table);
  let sql = `select exists(select 1 from ${clause}`;
  sql += addClauses(table, query, params);
  sql += ') as exists_result';
  const options = {
    query: sql,
    params,
    tx
  };
  if (debugResult) {
    debugResult.queries.push({
      sql,
      params
    });
  }
  const post = (results) => {
    if (results.length > 0) {
      return Boolean(results[0].exists_result);
    }
    return undefined;
  }
  if (tx && tx.isBatch) {
    return await processBatch(db, options, post);
  }
  const results = await db.all(options);
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
    let selector;
    if (types && types[column] === 'json') {
      selector = `json(${column})`;
    }
    else {
      selector = column;
    }
    return `'${column}', ${selector}`;
  });
  sql += mapped.join(', ');
  sql += `))`;
  return sql;
}

const adjustName = (options) => {
  const {
    column,
    withAlias,
    selectColumns,
    params,
    computed 
  } = options;
  if (!/^[_a-z][a-z0-9_]+$/i.test(column)) {
    throw Error(`Invalid column name ${column}`);
  }
  if (!computed) {
    return column;
  }
  const item = computed.get(column);
  if (!item) {
    return column;
  }
  if (withAlias) {
    return item.createClause({
      params,
      alias: column
    });
  }
  else {
    if (selectColumns && selectColumns.includes(column)) {
      return column;
    }
    return item.createClause({
      params,
      getPlaceholder
    });
  }
}

const group = async (config) => {
  const {
    db,
    table,
    method,
    query,
    tx,
    dbClient,
    partitionBy
  } = config;
  if (!db.initialized) {
    await db.initialize();
  }
  const { select, column, distinct, where, include, debug, ...keywords } = query;
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
  const rawBy = Array.isArray(config.by) ? config.by : [config.by];
  const params = {};
  const computed = db.computed.get(table);
  if (computed && computed.has(alias)) {
    throw Error(`The alias cannot have the same name as a computed field.`);
  }
  const by = rawBy.map(column => adjustName({
    table,
    column,
    withAlias: true,
    params,
    computed
  }));
  let debugResult;
  if (debug) {
    debugResult = {
      result: undefined,
      queries: []
    };
  }
  const debugReturn = (result) => {
    if (config.debugResult) {
      config.debugResult.queries.push({
        sql,
        params
      });
    }
    if (debugResult) {
      debugResult.queries.push({
        sql,
        params
      });
      debugResult.result = result;
      return debugResult;
    }
    return result;
  }
  const includeResults = [];
  if (include) {
    for (const [column, handler] of Object.entries(include)) {
      if (computed && computed.has(column)) {
        throw Error(`Includes cannot have the same name as computed fields.`);
      }
      const result = processInclude(column, handler, null, null, debugResult);
      includeResults.push({ column, result });
    }
  }
  const needsParsing = new Map();
  const columnTypes = db.columns[table];
  const byClause = by.join(', ');
  for (const column of rawBy) {
    if (db.needsParsing(table, column)) {
      needsParsing.set(column, { type: 'value' });
    }
  }
  let sql = `select ${byClause}, `;
  if (method !== 'array') {
    const options = column || distinct;
    const field = options[alias];
    let body = '';
    if (distinct) {
      body += 'distinct ';
    }
    if (field === true) {
      body += '*';
    }
    else {
      body += adjustName({
        table,
        column: field,
        params,
        computed
      });
    }
    const actualMethod = method === 'sum' ? 'total' : method;
    const clause = db.getTableClause(table);
    sql += `${actualMethod}(${body}) as ${method} from ${clause}`;
  }
  else {
    const types = db.columns[table];
    let columns;
    let rawColumns;
    const fields = select[alias];
    if (fields === true) {
      columns = Object.keys(db.columns[table]);
      rawColumns = columns;
    }
    else if (Array.isArray(fields)) {
      columns = fields.map(column => adjustName({
        table,
        column,
        params,
        computed
      }));
      rawColumns = select;
    }
    if (columns) {
      sql += makeJsonArray(columnTypes, columns);
      const fields = new Map();
      for (const column of rawColumns) {
        if (db.needsParsing(table, column) && types[column] !== 'json') {
          fields.set(column, true);
        }
      }
      needsParsing.set(alias, { jsonParse: true, fields });
    }
    else {
      const column = fields;
      const name = adjustName({
        table,
        column,
        params,
        computed
      });
      sql += `json_group_array(${name})`;
      let field;
      if (db.needsParsing(table, column) && types[column] !== 'json') {
        field = column;
      }
      needsParsing.set(alias, { jsonParse: true, field });
    }
    const clause = db.getTableClause(table);
    sql += ` as ${method} from ${clause}`;
  }
  if (adjustedWhere) {
    const adjuster = (name) => adjustName({
      table,
      column: name,
      selectColumns: rawBy,
      params,
      computed
    });
    const clause = toWhere({
      table,
      query: adjustedWhere,
      params,
      adjuster
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
  if (hasKeywords && !partitionBy) {
    const adjuster = (name) => adjustName({
      column: name,
      selectColumns: rawBy,
      params,
      computed
    });
    sql += toKeywords(null, keywords, params, adjuster);
  }
  else if (partitionBy) {
    const withTable = 'flyweight_wrapped';
    sql = `with ${withTable} as (${sql})`;
    const selectColumns = [alias, ...by];
    let orderBy;
    if (keywords.orderBy) {
      const adjuster = (name) => adjustName({
        table: withTable,
        column: name,
        selectColumns: rawBy,
        params,
        computed
      });
      orderBy = getOrderBy(keywords.orderBy, params, adjuster);
    }
    else {
      orderBy = `${withTable}.${db.getPrimaryKey(table)}`;
    }
    let desc = '';
    if (keywords.desc) {
      desc = ' desc';
    }
    let i = 1;
    let rankAlias = 'rn';
    while (selectColumns.includes(rankAlias)) {
      i++;
      rankAlias = `rn${i}`;
    }
    sql += ` select ${selectColumns.join(', ')}, row_number() over (partition by ${withTable}.${partitionBy} order by ${orderBy}${desc}) as ${rankAlias} from ${withTable}`;
    const rankedTable = `flyweight_ranked`;
    sql = `with ${rankedTable} as (${sql}) select ${selectColumns.join(', ')} from ${rankedTable} where ${rankAlias}`;
    const hasOffset = keywords.offset !== undefined && Number.isInteger(keywords.offset);
    const hasLimit = keywords.limit !== undefined && Number.isInteger(keywords.limit);
    if (hasOffset && hasLimit) {
      const start = keywords.offset;
      const end = keywords.offset + keywords.limit;
      const startPlaceholder = getPlaceholder();
      const endPlaceholder = getPlaceholder();
      params[startPlaceholder] = start;
      params[endPlaceholder] = end;
      sql += ` > $${startPlaceholder} and ${alias} <= $${endPlaceholder}`;
    }
    else if (hasLimit && !hasOffset) {
      const placeholder = getPlaceholder();
      params[placeholder] = keywords.limit;
      sql += ` <= $${placeholder}`;
    }
    else if (hasOffset && !hasLimit) {
      const placeholder = getPlaceholder();
      params[placeholder] = keywords.limit;
      sql += ` > $${placeholder}`;
    }
  }
  const withTable = 'flyweight_alias';
  sql = `with ${withTable} as (${sql}) select ${by.join(', ')}, ${method} as ${alias} from ${withTable}`;
  const options = {
    query: sql,
    params,
    tx
  };
  if (debugResult) {
    debugResult.queries.push({
      sql,
      params
    });
  }
  const post = (rows) => {
    if (rows.length === 0 || needsParsing.size === 0) {
      return rows;
    }
    const adjusted = [];
    for (const row of rows) {
      const created = {};
      for (const [key, value] of Object.entries(row)) {
        const parse = needsParsing.get(key);
        if (!parse) {
          created[key] = value;
        }
        else {
          if (parse.jsonParse) {
            const items = JSON.parse(value);
            if (parse.field) {
              created[key] = items.map(item => db.convertToJs(table, parse.field, item));
            }
            else if (parse.fields) {
              created[key] = items.map(item => {
                const adjusted = {};
                for (const [key, value] of Object.entries(item)) {
                  if (parse.fields.has(key)) {
                    adjusted[key] = db.convertToJs(table, key, value);
                  }
                  else {
                    adjusted[key] = value;
                  }
                }
                return adjusted;
              });
            }
            else {
              created[key] = items;
            }
          }
          else {
            created[key] = db.convertToJs(table, key, value);
          }
        }
      }
      adjusted.push(created);
    }
    return adjusted;
  };
  if (tx && tx.isBatch) {
    return await processBatch(db, options, post);
  }
  const results = await db.all(options);
  const adjusted = post(results);
  if (!include || !adjusted) {
    return debugReturn(adjusted);
  }
  for (const include of includeResults) {
    if (include.postProcess) {
      include.postProcess(adjusted);
    }
    else {
      const runQuery = include.result.runQuery;
      if (runQuery) {
        const result = await runQuery(dbClient, adjusted);
        result.postProcess(adjusted);
      }
    }
  }
  return debugReturn(adjusted);
}

const aggregate = async (config) => {
  const {
    db,
    table,
    tx,
    method,
    groupKeys,
    debugResult
  } = config;
  if (!db.initialized) {
    await db.initialize();
  }
  const params = {};
  const query = config.query || {};
  const { where, column, distinct } = query;
  const computed = db.computed.get(table);
  const adjuster = (name) => adjustName({
    column: name,
    params,
    computed
  });
  const alias = `${method}_result`;
  const actualMethod = method === 'sum' ? 'total' : method;
  let expression;
  if (!column && !distinct) {
    if (method !== 'count') {
      throw Error('Aggregate needs to specify a column');
    }
    expression = `count(*) as ${alias}`;
  }
  else {
    const field = column || distinct;
    const selector = adjuster(field);
    const before = distinct === undefined ? '' : 'distinct ';
    expression = `${actualMethod}(${before}${selector}) as ${alias}`;
  }
  let sql;
  let groupFields;
  if (groupKeys && groupKeys.length > 0) {
    groupFields = groupKeys
      .map(key => {
        return adjuster ? adjuster(key) : key;
      })
      .join(', ');
  }
  const clause = toWhere({
    query: where,
    params,
    adjuster
  });
  const groupClause = groupFields ? `, ${groupFields}` : '';
  const tableClause = db.getTableClause(table);
  sql = `select ${expression}${groupClause} from ${tableClause}`;
  if (clause) {
    sql += ` where ${clause}`;
  }
  if (groupFields) {
    sql += ` group by ${groupFields}`;
  }
  const options = {
    query: sql,
    params,
    tx
  };
  if (debugResult) {
    debugResult.queries.push({
      sql,
      params
    });
  }
  const post = (results) => {
    if (groupFields) {
      if (method == 'min' || method === 'max') {
        const field = distinct || column;
        const key = `${method}_result`;
        for (const result of results) {
          const value = result[key];
          result[key] = db.convertToJs(table, field, value);
        }
      }
      return results;
    }
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
    return await processBatch(db, options, post);
  }
  const results = await db.all(options);
  return post(results);
}

const processInclude = (key, handler, debugResult) => {
  const tableTarget = {};
  const tableHandler = {
    get: function(target, property) {
      if (!target.table) {
        target.table = property;
        return tableProxy;
      }
      if (!target.method) {
        target.method = property;
        return (...args) => {
          target.args = args;
          return tableProxy;
        }
      }
      if (target.method && target.method === 'groupBy' && !target.aggregate) {
        target.aggregate = property;
        return (...args) => {
          target.aggregateArgs = args;
          return tableProxy;
        }
      }
    }
  };
  const tableProxy = new Proxy(tableTarget, tableHandler);
  const columnHandler = {
    get: function(target, property) {
      target.name = property;
      const request = {
        name: property
      };
      columnRequests.push(request);
      return request;
    }
  }
  const columnTarget = {};
  const columnProxy = new Proxy(columnTarget, columnHandler);
  const columnRequests = [];
  handler(tableProxy, columnProxy);
  const method = tableTarget.method;
  let where;
  const whereFirst = ['get', 'many', 'exists'].includes(method);
  if (whereFirst) {
    where = tableTarget.args[0] || {};
  }
  else {
    if (tableTarget.method === 'groupBy') {
      where = tableTarget.aggregateArgs[0].where || {};
    }
    else {
      where = tableTarget.args[0].where || {};
    }
  }
  const whereKeys = [];
  let whereOperator = 'and';
  const getWhereKeys = (conditions, traversals) => {
    for (const [key, value] of Object.entries(conditions)) {
      if (key === 'and' || key === 'or') {
        traversals.push(key);
        let i = 0;
        for (const conditions of value) {
          getWhereKeys(conditions, [...traversals, i]);
          i++;
        }
      }
      else {
        const request = columnRequests.find(r => r === value);
        if (request) {
          if (traversals.length > 0) {
            whereOperator = traversals.at(0);
          }
          whereKeys.push({
            includeKey: key,
            parentKey: request.name,
            traversals
          });
        }
      }
    }
  }
  getWhereKeys(where, []);
  const includeKeys = whereKeys.map(k => k.includeKey);
  const runQuery = async (db, result) => {
    const singleResult = !Array.isArray(result);
    const singleInclude = ['first', 'get', 'exists'].includes(method) || aggregateMethods.includes(method);
    let group = false;
    const values = new Map();
    const config = { debugResult };
    for (const keys of whereKeys) {
      const { includeKey, parentKey, traversals } = keys;
      let parentValues = values.get(parentKey);
      if (!parentValues) {
        parentValues = singleResult ? result[parentKey] : result.map(item => item[parentKey]);
        values.set(includeKey, parentValues);
      }
      let current = where;
      if (traversals.length > 0) {
        for (const key of traversals) {
          current = current[key];
        }
      }
      current[includeKey] = parentValues;
    }
    let returnToValues = null;
    if (['get', 'many', 'exists', ...aggregateMethods].includes(method) && includeKeys.length > 0) {
      if (tableTarget.args.length > 1) {
        const select = tableTarget.args[1];
        if (!Array.isArray(select)) {
          if (includeKeys.length > 1 || includeKeys.at(0) !== select) {
            returnToValues = select;
            const set = new Set([select, ...includeKeys]);
            tableTarget.args[1] = [...set];
          }
        }
        else {
          const add = includeKeys.filter(k => !select.includes(k));
          select.push(...add);
        }
      }
      if (method === 'exists' || aggregateMethods.includes(method)) {
        group = true;
        config.groupKeys = includeKeys;
        returnToValues = `${method}_result`;
      }
    }
    else if (includeKeys.length > 0 && method !== 'groupBy') {
      const options = tableTarget.args[0];
      const select = options.select;
      if (select) {
        if (!Array.isArray(select)) {
          const add = includeKeys.filter(k => k !== select);
          if (add.length > 0) {
            options.select = [select, ...add];
            returnToValues = select;
          }
        }
        else {
          const add = includeKeys.filter(k => !select.includes(k));
          select.push(...add);
        }
      }
    }
    let queryMethod = method;
    if (!singleResult && method === 'get') {
      queryMethod = 'many';
    }
    if (!singleResult && method === 'first') {
      queryMethod = 'query';
    }
    const args = method === 'groupBy' ? tableTarget.aggregateArgs : tableTarget.args;
    if (['first', 'query', 'groupBy'].includes(method) || !queryMethods.includes(method)) {
      if (args[0].limit !== undefined) {
        config.partitionBy = includeKeys;
      }
      else if (args[0].orderBy !== undefined && method === 'first' && queryMethod === 'query') {
        config.partitionBy = includeKeys;
        config.singleRow = true;
      }
    }
    if (args.length === 0) {
      args.push(undefined);
    }
    if (['get', 'many'].includes(method) && args.length === 1) {
      args.push(undefined);
    }
    if (method === 'groupBy') {
      tableTarget.args.push(config);
    }
    else {
      args.push(config);
    }
    let included;
    const run = db[tableTarget.table][queryMethod];
    if (method === 'groupBy') {
      const { aggregate, aggregateArgs } = tableTarget;
      included = await run(...tableTarget.args)[aggregate](...aggregateArgs);
    }
    else {
      included = await run(...args);
    }
    const postProcess = (result) => {
      if (singleResult) {
        let adjusted = false;
        if (singleInclude) {
          const mapped = group ? included.at(0) : included;
          if (mapped === undefined) {
            adjusted = true;
            if (method === 'exists') {
              result[key] = false;
            }
            else if (method === 'count') {
              result[key] = 0;
            }
            else {
              result[key] = mapped;
            }
          }
          else {
            result[key] = mapped;
          }
        }
        else {
          result[key] = included;
        }
        if (returnToValues !== null && !adjusted) {
          const value = result[key];
          if (singleInclude) {
            result[key] = value[returnToValues];
          }
          else {
            result[key] = value.map(item => item[returnToValues]);
          }
        }
      }
      else {
        for (const item of result) {
          if (whereKeys.length > 0) {
            if (whereKeys.length === 1) {
              const { includeKey, parentKey } = whereKeys.at(0);
              item[key] = included.filter(value => value[includeKey] === item[parentKey]);
            }
            else {
              if (whereOperator === 'and') {
                item[key] = included.filter(value => {
                  for (const keys of whereKeys) {
                    const { includeKey, parentKey } = keys;
                    if (value[includeKey] !== item[parentKey]) {
                      return false;
                    }
                  }
                  return true;
                });
              }
              else {
                item[key] = included.filter(value => {
                  for (const keys of whereKeys) {
                    const { includeKey, parentKey } = keys;
                    if (value[includeKey] === item[parentKey]) {
                      return true;
                    }
                  }
                  return false;
                });
              }
            }
          }
          else {
            item[key] = included;
          }
          if (returnToValues !== null) {
            item[key] = item[key].map(v => v[returnToValues]);
          }
          if (singleInclude) {
            const value = item[key].at(0);
            if (value === undefined) {
              item[key] = null;
            }
            else {
              item[key] = value;
            }
          }
        }
      }
    }
    return {
      raw: included,
      whereKeys: includeKeys,
      postProcess
    }
  }
  return {
    whereKeys: whereKeys,
    runQuery
  }
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

const convertItem = (item, converters) => {
  for (const converter of converters) {
    const keys = converter.keys;
    const count = keys.length;
    let i = 0;
    let actual = item;
    for (const key of keys) {
      if (i + 1 === count) {
        if (actual[key] !== null) {
          actual[key] = converter.converter(actual[key]);
        }
      }
      actual = actual[key];
      i++;
    }
  }
}

const getParsers = (columns, db) => {
  const columnMap = {};
  const typeMap = {};
  for (const column of columns) {
    const replaced = column.name.replace(/^flyweight\d+_/, '');
    if (column.name !== replaced) {
      columnMap[column.name] = replaced;
    }
    const converter = db.getDbToJsConverter(column.type);
    if (converter) {
      typeMap[column.name] = converter;
    }
  }
  return {
    names: columnMap,
    types: typeMap
  }
}

const custom = async (config) => {
  const { 
    db, 
    table,
    query,
    method,
    tx, 
    dbClient, 
    partitionBy
  } = config;
  if (!db.initialized) {
    await db.initialize();
  }
  let sql = await db.readQuery(table, method);
  const write = isWrite(sql);
  const columns = parseQuery(sql, db.tables);
  const parsers = getParsers(columns, db);
  let { params, where, select, omit, include, alias, debug, ...keywords } = query || {};
  if (!params) {
    params = {};
  }
  const customFields = {};
  const hasKeywords = Object.keys(keywords).length > 0;
  const wrap = where || select || omit || hasKeywords;
  const withTable = 'flyweight_wrapped';
  let fields;
  if (wrap) {
    sql = sql.replace(/;\s*$/, '');
    sql = `with ${withTable} as (${sql})`;
    if (omit) {
      const all = Object.keys(db.columns[table]);
      fields = invertOmit(all, omit);
    }
    else {
      fields = select;
    }
  }
  if (columns.length === 0) {
    return await db.run({
      query: sql,
      params,
      tx,
      write
    });
  }
  let debugResult;
  if (debug) {
    debugResult = {
      result: undefined,
      queries: []
    };
  }
  const debugReturn = (result) => {
    if (config.debugResult) {
      config.debugResult.queries.push({
        sql,
        params
      });
    }
    if (debugResult) {
      debugResult.queries.push({
        sql,
        params
      });
      debugResult.result = result;
      return debugResult;
    }
    return result;
  }
  const returnValue = ['string', 'function'].includes(typeof select);
  const includeResults = [];
  const columnsToRemove = [];
  if (include) {
    const extraColumns = new Set();
    const includeNames = [];
    for (const [column, handler] of Object.entries(include)) {
      const result = processInclude(column, handler, debugResult);
      extraColumns.add(...result.whereKeys.map(k => k.parentKey));
      includeResults.push({ column, result });
      includeNames.push(column);
    }
    if (fields) {
      const remove = Array.from(extraColumns.values()).filter(c => !fields.includes(c));
      columnsToRemove.push(...remove);
      fields.push(...remove);
    }
  }
  if (wrap) {
    let selectResult;
    if (fields) {
      selectResult = toSelect(db, withTable, fields, parsers.types, params);
      const distinct = keywords && keywords.distinct ? 'distinct ' : '';
      sql += ` select ${distinct}${selectResult.clause}`;
    }
    else {
      sql += ` select *`;
    }
    let wrapQuery;
    if (partitionBy) {
      let orderBy;
      if (keywords.orderBy) {
        orderBy = getOrderBy(keywords.orderBy, params);
      }
      else {
        orderBy = fields.at(0);
      }
      let desc = '';
      if (keywords.desc) {
        desc = ' desc';
      }
      let i = 1;
      let alias = 'rn';
      while (fields && fields.includes(alias)) {
        i++;
        alias = `rn${i}`;
      }
      sql += `, row_number() over (partition by ${partitionBy} order by ${orderBy}${desc}) as ${alias}`;
      wrapQuery = (sql, original) => {
        let statement = `with rankedQuery as (${sql}) select ${original} from rankedQuery where ${alias}`;
        const hasOffset = keywords.offset !== undefined && Number.isInteger(keywords.offset);
        const hasLimit = keywords.limit !== undefined && Number.isInteger(keywords.limit);
        if (hasOffset && hasLimit) {
          const start = keywords.offset;
          const end = keywords.offset + keywords.limit;
          const startPlaceholder = getPlaceholder();
          const endPlaceholder = getPlaceholder();
          params[startPlaceholder] = start;
          params[endPlaceholder] = end;
          statement += ` > $${startPlaceholder} and ${alias} <= $${endPlaceholder}`;
        }
        else if (hasLimit && !hasOffset) {
          const placeholder = getPlaceholder();
          params[placeholder] = keywords.limit;
          statement += ` <= $${placeholder}`;
        }
        else if (hasOffset && !hasLimit) {
          const placeholder = getPlaceholder();
          params[placeholder] = keywords.limit;
          statement += ` > $${placeholder}`;
        }
        return statement;
      }
    }
    sql += ` from ${withTable}`;
    if (where) {
      const clause = toWhere({
        query: where,
        params
      });
      if (clause) {
        sql += ` where ${clause}`;
      }
    }
    if (!partitionBy && hasKeywords) {
      sql += toKeywords(keywords, params);
    }
    if (partitionBy) {
      const original = selectResult ? selectResult.names.join(', ') : columns.map(c => c.name).join(', ');
      sql = wrapQuery(sql, original);
    }
  }
  const post = (rows) => {
    if (rows.length === 0) {
      return rows;
    }
    const sample = Object.keys(rows.at(0));
    const nameKeys = Object.keys(parsers.names);
    const typeKeys = Object.keys(parsers.types);
    const keys = [...nameKeys, ...typeKeys];
    const needsParsing = keys
      .filter(n => sample.includes(n))
      .length > 0;
    if (!needsParsing) {
      if (returnValue) {
        const key = sample.at(0);
        return rows.map(r => r[key]);
      }
      return rows;
    }
    else {
      const parsed = [];
      for (const row of rows) {
        const adjusted = {};
        for (const [key, value] of Object.entries(row)) {
          if (customFields.hasOwnProperty(key)) {
            adjusted[key] = value;
            continue;
          }
          const parser = parsers.types[key];
          const renamed = parsers.names[key] || key;
          if (parser) {
            adjusted[renamed] = parser(value);
          }
          else {
            adjusted[renamed] = value;
          }
        }
        parsed.push(adjusted);
      }
      if (returnValue) {
        const key = sample.at(0);
        return parsed.map(p => p[key]);
      }
      return parsed;
    }
  }
  const options = {
    query: sql,
    params,
    tx,
    write
  };
  if (tx && tx.isBatch) {
    return await processBatch(db, options, post);
  }
  const rows = await db.all(options);
  const adjusted = post(rows);
  if (!include || !adjusted || returnValue) {
    return debugReturn(adjusted);
  }
  let queryResult = adjusted;
  for (const include of includeResults) {
    if (include.postProcess) {
      include.postProcess(adjusted);
    }
    else {
      const runQuery = include.result.runQuery;
      if (runQuery) {
        const result = await runQuery(dbClient, adjusted);
        result.postProcess(adjusted);
      }
    }
    if (columnsToRemove.length === 0) {
      continue;
    }
    const mapped = [];
    for (const item of result) {
      const removed = {};
      for (const [key, value] of Object.entries(item)) {
        if (columnsToRemove.includes(key)) {
          continue;
        }
        removed[key] = value;
      }
      mapped.push(removed);
    }
    queryResult = mapped;
  }
  return debugReturn(queryResult);
}

const invertOmit = (all, omit) => {
  const remove = typeof omit === 'string' ? [omit] : omit;
  return all.filter(t => !remove.includes(t));
}

const all = async (config) => {
  const { 
    db, 
    table, 
    first, 
    tx, 
    dbClient, 
    partitionBy, 
    singleRow,
    type 
  } = config;
  if (!db.initialized) {
    await db.initialize();
  }
  const params = {};
  let query = config.query || {};
  let columns = config.columns;
  let included;
  let keywords;
  let debugResult;
  if (type === 'complex') {
    const { where, select, omit, include, debug, ...rest } = query;
    query = where || {};
    if (omit) {
      const all = Object.keys(db.columns[table]);
      columns = invertOmit(all, omit);
    }
    else {
      columns = select;
    }
    included = include;
    keywords = rest;
    if (debug) {
      debugResult = {
        result: undefined,
        queries: []
      };
    }
  }
  const computed = db.computed.get(table);
  const returnValue = ['string', 'function'].includes(typeof columns);
  const includeResults = [];
  const columnsToRemove = [];
  if (included) {
    const extraColumns = new Set();
    const includeNames = [];
    for (const [column, handler] of Object.entries(included)) {
      const result = processInclude(column, handler, debugResult);
      for (const keys of result.whereKeys) {
        extraColumns.add(keys.parentKey);
      }
      includeResults.push({ column, result });
      includeNames.push(column);
    }
    if (columns) {
      const remove = Array.from(extraColumns.values()).filter(c => !columns.includes(c));
      columnsToRemove.push(...remove);
      columns.push(...remove);
    }
  }
  const customFields = {};
  const columnTypes = db.columns[table];
  const select = toSelect(db, table, columns, columnTypes, params);
  const adjuster = (name) => adjustName({
    column: name,
    selectColumns: select.names,
    params,
    computed
  });
  if (db.virtualSet.has(table)) {
    return await getVirtual(db, table, query, tx, keywords, select.clause, returnValue, false);
  }
  let sql = 'select ';
  if (partitionBy) {
    let orderBy;
    if (keywords.orderBy) {
      orderBy = getOrderBy(keywords.orderBy, params);
    }
    else {
      orderBy = db.getPrimaryKey(table);
    }
    let desc = '';
    if (keywords.desc) {
      desc = ' desc';
    }
    let i = 1;
    let alias = 'rn';
    while (select.names.includes(alias)) {
      i++;
      alias = `rn${i}`;
    }
    select.clause += `, row_number() over (partition by ${partitionBy} order by ${orderBy}${desc}) as ${alias}`;
    const wrapQuery = (sql) => {
      let statement = `with rankedQuery as (${sql}) select ${select.names.join(', ')} from rankedQuery where ${alias}`;
      if (singleRow) {
        statement += ' = 1';
        return statement;
      }
      const hasOffset = keywords.offset !== undefined && Number.isInteger(keywords.offset);
      const hasLimit = keywords.limit !== undefined && Number.isInteger(keywords.limit);
      if (hasOffset && hasLimit) {
        const start = keywords.offset;
        const end = keywords.offset + keywords.limit;
        const startPlaceholder = getPlaceholder();
        const endPlaceholder = getPlaceholder();
        params[startPlaceholder] = start;
        params[endPlaceholder] = end;
        statement += ` > $${startPlaceholder} and ${alias} <= $${endPlaceholder}`;
      }
      else if (hasLimit && !hasOffset) {
        const placeholder = getPlaceholder();
        params[placeholder] = keywords.limit;
        statement += ` <= $${placeholder}`;
      }
      else if (hasOffset && !hasLimit) {
        const placeholder = getPlaceholder();
        params[placeholder] = keywords.limit;
        statement += ` > $${placeholder}`;
      }
      return statement;
    }
    if (keywords.distinct) {
      sql += 'distinct ';
    }
    const tableClause = db.getTableClause(table);
    sql += `${select.clause} from ${tableClause}`;
    const clause = toWhere({
      query,
      params,
      adjuster
    });
    if (clause) {
      sql += ` where ${clause}`;
    }
    sql = wrapQuery(sql);
  }
  else {
    if (keywords && keywords.distinct) {
      sql += 'distinct ';
    }
    const tableClause = db.getTableClause(table);
    sql += `${select.clause} from ${tableClause}`;
    const clause = toWhere({
      query,
      params,
      adjuster
    });
    if (clause) {
      sql += ` where ${clause}`;
    }
    sql += toKeywords(keywords, params, adjuster);
  }
  if (first) {
    sql += ' limit 1';
  }
  const options = {
    query: sql,
    params,
    tx
  };
  const debugReturn = (result) => {
    if (config.debugResult) {
      config.debugResult.queries.push({
        sql,
        params
      });
    }
    if (debugResult) {
      debugResult.queries.push({
        sql,
        params
      });
      debugResult.result = result;
      return debugResult;
    }
    return result;
  }
  const post = (rows) => {
    if (rows.length === 0) {
      if (first) {
        return undefined;
      }
      return rows;
    }
    const sample = rows[0];
    const keys = Object.keys(sample);
    const needsParsing = db.needsParsing(table, keys);
    let adjusted;
    if (needsParsing) {
      adjusted = [];
      for (const row of rows) {
        const created = {};
        for (const [key, value] of Object.entries(row)) {
          if (customFields.hasOwnProperty(key)) {
            created[key] = value;
            continue;
          }
          created[key] = db.convertToJs(table, key, value);
        }
        adjusted.push(created);
      }
    }
    else {
      adjusted = rows;
    }
    if (returnValue) {
      const key = keys[0];
      const mapped = adjusted.map(item => item[key]);
      if (first) {
        if (mapped.length > 0) {
          return mapped.at(0);
        }
        return undefined;
      }
      return mapped;
    }
    if (first) {
      if (adjusted.length > 0) {
        return adjusted.at(0);
      }
      return undefined;
    }
    return adjusted;
  };
  if (tx && tx.isBatch) {
    return await processBatch(db, options, post);
  }
  const rows = await db.all(options);
  const adjusted = post(rows);
  if (!included || !adjusted || returnValue) {
    return debugReturn(adjusted);
  }
  if (first) {
    for (const include of includeResults) {
      if (include.postProcess) {
        include.postProcess(adjusted);
      }
      else {
        const runQuery = include.result.runQuery;
        if (runQuery) {
          const result = await runQuery(dbClient, adjusted);
          result.postProcess(adjusted);
        }
      }
      if (columnsToRemove.length === 0) {
        continue;
      }
      for (const [key, value] of Object.entries(adjusted)) {
        if (columnsToRemove.includes(key)) {
          continue;
        }
        adjusted[key] = value;
      }
    }
    return debugReturn(adjusted);
  }
  else {
    let result = adjusted;
    for (const include of includeResults) {
      if (include.postProcess) {
        include.postProcess(adjusted);
      }
      else {
        const runQuery = include.result.runQuery;
        if (runQuery) {
          const result = await runQuery(dbClient, adjusted);
          result.postProcess(adjusted);
        }
      }
      if (columnsToRemove.length === 0) {
        continue;
      }
      const mapped = [];
      for (const item of result) {
        const removed = {};
        for (const [key, value] of Object.entries(item)) {
          if (columnsToRemove.includes(key)) {
            continue;
          }
          removed[key] = value;
        }
        mapped.push(removed);
      }
      result = mapped;
    }
    return debugReturn(result);
  }
}

const remove = async (db, table, query, tx) => {
  if (!db.initialized) {
    await db.initialize();
  }
  let sql = `delete from ${table}`;
  const params = {};
  const computed = db.computed.get(table);
  const adjuster = (name) => adjustName({
    column: name,
    params,
    computed
  });
  const clause = toWhere({
    table,
    query,
    params,
    adjuster
  });
  if (clause) {
    sql += ` where ${clause}`;
  }
  const options = {
    query: sql,
    params,
    tx
  };
  return await db.run(options);
}

export {
  insert,
  insertMany,
  update,
  upsert,
  exists,
  group,
  aggregate,
  custom,
  all,
  remove
}
