let paramCount = 1;

const getPlaceholder = () => {
  const count = paramCount;
  paramCount++;
  if (paramCount > (2 ** 20)) {
    paramCount = 0;
  }
  return `p_${count}`;
}

const reservedWords = [
  'where',
  'select',
  'omit',
  'include',
  'orderBy',
  'desc',
  'limit',
  'offset',
  'distinct'
];

const aggregateMethods = [
  'count',
  'avg',
  'min',
  'max',
  'sum',
  'total'
];

const methods = new Map([
  ['not', '!='],
  ['gt', '>'],
  ['gte', '>='],
  ['lt', '<'],
  ['lte', '<='],
  ['like', 'like'],
  ['match', 'match'],
  ['glob', 'glob'],
  ['range', null],
  ['includes', null],
  ['some', null],
  ['eq', '=']
]);

const getConditions = (verify, table, column, query, params) => {
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
  if (columnTarget.name && verify) {
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
  const select = table ? `${table}.${column}` : column;
  const selector = path ? `json_extract(${select}, $${placeholder})` : select;
  const conditions = [];
  const fromClauses = [];
  const expression = table ? `${table}.${columnTarget.name}` : columnTarget.name;
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
  else if (method === 'range') {
    for (const [method, param] of Object.entries(value)) {
      if (!['gt', 'gte', 'lt', 'lte'].includes(method)) {
        throw Error('Invalid range statement');
      }
      const operator = methods.get(method);
      if (param === columnProxy) {
        conditions.push(`${selector} ${operator} ${expression}`);
      }
      else {
        const placeholder = getPlaceholder();
        params[placeholder] = param;
        conditions.push(`${selector} ${operator} $${placeholder}`);
      }
    }
  }
  else if (method === 'includes') {
    const alias = `${table}_${column.replace('.', '_')}_json`;
    if (value === columnProxy) {
      conditions.push(`${alias}.value = ${expression}`);
    }
    else {
      const placeholder = getPlaceholder();
      params[placeholder] = value;
      conditions.push(`${alias}.value = $${placeholder}`);
    }
    fromClauses.push(`json_each(${selector}) as ${alias}`);
  }
  else if (method === 'some') {
    const alias = `${table}_${column.replace('.', '_')}_json`;
    fromClauses.push(`json_each(${selector}) as ${alias}`);
    const result = getConditions(verify, alias, 'value', value, params);
    conditions.push(...result.conditions);
    fromClauses.push(...result.fromClauses);
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
  return {
    conditions,
    fromClauses
  }
}

const getPlaceholders = (supports, query, params, columnTypes) => {
  const columns = Object.keys(query);
  return columns.map(columnName => {
    const placeholder = getPlaceholder();
    params[placeholder] = query[columnName];
    if (supports.jsonb && columnTypes[columnName] === 'json') {
      return `jsonb($${placeholder})`;
    }
    return `$${placeholder}`;
  });
}

const adjust = (db, table, params) => {
  const columnTypes = db.columnSets[table];
  const adjusted = db.adjust(params);
  const processed = {};
  for (const [name, value] of Object.entries(adjusted)) {
    if (db.supports.jsonb && columnTypes[name] === 'json') {
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
  const columnTypes = db.columnSets[table];
  const placeholders = getPlaceholders(db.supports, query, params, columnTypes);
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

const upsert = async (db, table, options, tx) => {
  if (!db.initialized) {
    await db.initialize();
  }
  const { values, target, set } = options;
  const columnSet = db.columnSets[table];
  const verify = makeVerify(table, columnSet);
  const params = {};
  const query = adjust(db, table, values);
  let sql = makeInsertSql(db, table, query, params);
  let allParams = { ...params };
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
  return await processInsert(db, sql, params, primaryKey, tx);
}

const insert = async (db, table, values, tx) => {
  if (!db.initialized) {
    await db.initialize();
  }
  const columnSet = db.columnSets[table];
  const verify = makeVerify(table, columnSet);
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
  const columnSet = db.columnSets[table];
  const columnTypes = db.columns[table];
  const verify = makeVerify(table, columnSet);
  const sample = items[0];
  const columns = Object.keys(sample);
  verify(columns);
  const hasBlob = db.tables[table].filter(c => columns.includes(c.name)).some(c => c.type === 'blob');
  if (hasBlob) {
    return await batchInserts(tx, db, table, items);
  }
  let sql = `insert into ${table}(${columns.join(', ')}) select `;
  const select = columns.map(column => {
    if (db.supports.jsonb && columnTypes[column] === 'json') {
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

const toWhere = (verify, table, query, params, type = 'and') => {
  if (!query) {
    return {
      whereClauses: '',
      fromClauses: ''
    }
  }
  if (!params) {
    params = query;
  }
  const entries = Object.entries(query);
  if (entries.length === 0) {
    return {
      whereClauses: '',
      fromClauses: ''
    }
  }
  const conditions = [];
  const fromClauses = [];
  for (const [column, param] of entries) {
    if (verify && column !== 'and' && column !== 'or') {
      verify(column);
    }
    if (param === undefined) {
      continue;
    }
    const selector = table ? `${table}.${column}` : column;
    if (column === 'and' || column === 'or') {
      if (!Array.isArray(param)) {
        throw Error(`The "${column}" property value must be an array of conditions`);
      }
      const filters = [];
      for (const query of param) {
        const results = toWhere(verify, table, query, params, column);
        filters.push(results.whereClauses);
        if (results.fromClauses) {
          fromClauses.push(results.fromClauses);
        }
      }
      conditions.push(`(${filters.join(` ${column} `)})`);
    }
    else if (typeof param === 'function') {
      const result = getConditions(verify, table, column, param, params);
      conditions.push(...result.conditions);
      fromClauses.push(...result.fromClauses);
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
  return {
    whereClauses: conditions.join(` ${type} `),
    fromClauses: fromClauses.join(', ')
  }
}

const createSetClause = (db, table, query, params) => {
  const statements = [];
  const columnTypes = db.columns[table];
  for (const [column, param] of Object.entries(query)) {
    const placeholder = getPlaceholder();
    params[placeholder] = param;
    if (columnTypes[column] === 'json' && db.supports.jsonb) {
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
  const columnSet = db.columnSets[table];
  const verify = makeVerify(table, columnSet);
  const keys = Object.keys(set);
  verify(keys);
  const params = {};
  const query = adjust(db, table, set);
  const setString = createSetClause(db, table, query, params);
  let sql = `update ${table} set ${setString}`;
  if (where) {
    sql += addClauses(verify, table, where, params);
  }
  const runOptions = {
    query: sql,
    params,
    tx
  };
  return await db.run(runOptions);
}

const makeVerify = (table, columnSet, include) => {
  return (column, customFields) => {
    if (typeof column === 'string') {
      if (include && include.hasOwnProperty(column)) {
        return;
      }
      if (customFields && customFields.hasOwnProperty(column)) {
        return;
      }
      if (!columnSet.has(column)) {
        throw Error(`Column ${column} does not exist on table ${table}`);
      }
    }
    else {
      const columns = column;
      for (const column of columns) {
        if (include && include.hasOwnProperty(column)) {
          return;
        }
        if (customFields && customFields.hasOwnProperty(column)) {
          return;
        }
        if (!columnSet.has(column)) {
          throw Error(`Column ${column} does not exist on table ${table}`);
        }
      }
    }
  }
}

const traverse = (selector) => {
  const chain = [];
  const handler = {
    get: function(target, property) {
      chain.push(property);
      return proxy;
    }
  }
  const proxy = new Proxy([], handler);
  selector(proxy);
  const column = chain.shift();
  const path = `$.${chain.join('.')}`;
  return {
    column,
    path
  };
}

const expandStar = (db, table) => {
  const columnTypes = db.columns[table];
  const names = Object.keys(columnTypes);
  if (!db.supports.jsonb || !db.hasJson[table]) {
    const clause = names
      .map(name => `${table}.${name}`)
      .join(', ');
    return {
      names,
      clause
    }
  }
  const statements = [];
  for (const [column, type] of Object.entries(columnTypes)) {
    if (type === 'json') {
      statements.push(`json(${table}.${column}) as ${column}`);
    }
    else {
      statements.push(`${table}.${column}`);
    }
  }
  return {
    names,
    clause: statements.join(', ')
  }
}

const toSelect = (db, table, columns, verify, params, customFields) => {
  const columnTypes = db.columns[table];
  if (columns) {
    if (typeof columns === 'string') {
      let clause;
      verify(columns);
      if (db.supports.jsonb && columnTypes[columns] === 'json') {
        clause = `json(${table}.${columns}) as ${columns}`;
      }
      else {
        clause = `${table}.${columns}`;
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
          if (db.supports.jsonb && columnTypes[columns] === 'json') {
            statements.push(`json(${table}.${columns}) as ${columns}`);
          }
          else {
            statements.push(`${table}.${column}`);
          }
        }
        else {
          const { select, as } = column;
          if (!/^[a-z][a-z0-9]*$/i.test(as)) {
            throw Error(`Invalid alias: ${as}`);
          }
          names.push(as);
          const result = traverse(select);
          verify(result.column);
          const placeholder = getPlaceholder();
          params[placeholder] = result.path;
          customFields[as] = 'any';
          statements.push(`json_extract(${table}.${result.column}, $${placeholder}) as ${as}`);
        }
      }
      return {
        names,
        clause: statements.join(', ')
      }
    }
    else if (typeof columns === 'function') {
      const { column, path } = traverse(columns);
      verify(column);
      const placeholder = getPlaceholder();
      params[placeholder] = path;
      customFields['json_result'] = 'any';
      const clause = `json_extract(${table}.${column}, $${placeholder}) as json_result`;
      return {
        names: ['json_result'],
        clause
      }
    }
    return expandStar(db, table);
  }
  return expandStar(db, table);
}

const getOrderBy = (verify, keywords, customFields) => {
  let orderBy = keywords.orderBy;
  verify(orderBy, customFields);
  if (Array.isArray(orderBy)) {
    orderBy = orderBy.join(', ');
  }
  return orderBy;
}

const shouldSort = (keywords, included) => {
  const orderBy = keywords.orderBy;
  if (!orderBy) {
    return false;
  }
  if (!included) {
    return true;
  }
  if (keywords.offset !== undefined || keywords.limit !== undefined) {
    return true;
  }
  if (typeof orderBy === 'string') {
    if (included.hasOwnProperty(orderBy)) {
      return false;
    }
  }
  else {
    for (const column of orderBy) {
      if (included.hasOwnProperty(orderBy)) {
        return false;
      }
    }
  }
  return true;
}

const toKeywords = (verify, keywords, params, customFields, included) => {
  let sql = '';
  if (keywords) {
    const sort = shouldSort(keywords, included);
    if (sort) {
      const orderBy = getOrderBy(verify, keywords, customFields);
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

const getVirtual = async (db, table, query, tx, keywords, select, returnValue, verify, once) => {
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
    const fromClauses = [];
    for (const [column, param] of Object.entries(query)) {
      verify(column);
      if (typeof param === 'function') {
        const result = getConditions(verify, column, param, params);
        statements.push(...result.conditions);
        fromClauses.push(...result.fromClauses);
      }
      else {
        const placeholder = getPlaceholder();
        params[placeholder] = param;
        statements.push(`${column} match $${placeholder}`);
      }
    }
    if (fromClauses.length > 0) {
      sql += `, ${fromClauses.join(',')}`;
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
  sql += toKeywords(verify, keywords, params);
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
    groupKey,
    parentQuery,
    debugResult
  } = config;
  if (!db.initialized) {
    await db.initialize();
  }
  const query = config.query || {};
  if (groupKey) {
    const result = await aggregate({ db, table, query, tx, method: 'count', groupKey, parentQuery });
    return result.map(r => {
      return {
        result: r.countResult > 0,
        [groupKey]: r[groupKey]
      }
    });
  }
  const columnSet = db.columnSets[table];
  const verify = makeVerify(table, columnSet);
  const params = {};
  let sql = `select exists(select 1 from ${table}`;
  sql += addClauses(verify, table, query, params);
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

const addClauses = (verify, table, query, params) => {
  let sql = '';
  const { whereClauses, fromClauses } = toWhere(verify, table, query, params);
  if (fromClauses) {
    sql += `, ${fromClauses}`;
  }
  if (whereClauses) {
    sql += ` where ${whereClauses}`;
  }
  return sql;
}

const aggregate = async (config) => {
  const {
    db,
    table,
    tx,
    method,
    groupKey,
    parentQuery,
    debugResult
  } = config;
  if (!db.initialized) {
    await db.initialize();
  }
  const params = {};
  const query = config.query || {};
  let parentWhere = {};
  let parentHaving = {};
  if (parentQuery) {
    for (const [key, value] of Object.entries(parentQuery.query)) {
      if (parentQuery.include && parentQuery.include.hasOwnProperty(key)) {
        parentHaving[key] = value;
      }
      else {
        parentWhere[key] = value;
      }
    }
  }
  const { where, column, distinct } = query;
  const columnSet = db.columnSets[table];
  const verify = makeVerify(table, columnSet);
  const clauses = toWhere(verify, table, where, params);
  const primaryKey = db.getPrimaryKey(table);
  const alias = parentQuery ? parentQuery.includeName : `${method}_result`;
  const actualMethod = method === 'sum' ? 'total' : method;
  let expression;
  if (!column && !distinct) {
    if (method !== 'count') {
      throw Error('Aggregate needs to specify a column');
    }
    if (clauses.fromClauses && method === 'count') {
      expression = `count(distinct ${table}.${primaryKey}) as ${alias}`;
    }
    else {
      expression = `count(${table}.${primaryKey}) as ${alias}`;
    }
  }
  else if (distinct) {
    expression = `${actualMethod}(distinct ${table}.${distinct}) as ${alias}`;
  }
  else {
    expression = `${actualMethod}(${table}.${column}) as ${alias}`;
  }
  let sql;
  if (groupKey) {
    if (parentQuery) {
      const clauses = toWhere(verify, table, where, params);
      const columnSet = db.columnSets[parentQuery.table];
      const parentVerify = makeVerify(parentQuery.table, columnSet);
      const parentClauses = toWhere(parentVerify, parentQuery.table, parentWhere, params);
      if (clauses.fromClauses || parentClauses.fromClauses) {
        throw Error('Queries that order by included fields cannot contain array searches.');
      }
      sql = `select ${expression}, ${table}.${groupKey} from ${parentQuery.table} left join ${table} on ${parentQuery.table}.${parentQuery.joinColumn} = ${table}.${groupKey}`;
      if (clauses.whereClauses || parentClauses.whereClauses) {
        sql += ' where ';
        if (parentClauses.whereClauses) {
          sql += parentClauses.whereClauses;
        }
        if (clauses.whereClauses) {
          if (parentClauses.whereClauses) {
            sql += ' and ';
          }
          sql += clauses.whereClauses;
        }
      }
    }
    else {
      const { whereClauses, fromClauses } = toWhere(verify, table, where, params);
      sql = `select ${expression}, ${table}.${groupKey} from ${table}`;
      if (fromClauses) {
        sql += `, ${fromClauses}`;
      }
      if (whereClauses) {
        sql += ` where ${whereClauses}`;
      }
    }
  }
  else {
    const { whereClauses, fromClauses } = toWhere(verify, table, where, params);
    sql = `select ${expression} from ${table}`;
    if (fromClauses) {
      sql += `, ${fromClauses}`;
    }
    if (whereClauses) {
      sql += ` where ${whereClauses}`;
    }
  }
  if (groupKey) {
    sql += ` group by ${table}.${groupKey}`;
    if (parentQuery) {
      const clauses = toWhere(null, null, parentHaving, params);
      if (clauses.whereClauses) {
        sql += ` having ${clauses.whereClauses}`;
      }
      const { orderBy, offset, limit, desc } = parentQuery.keywords;
      if (offset !== undefined || limit !== undefined || orderBy === parentQuery.includeName) {
        sql += ` order by ${parentQuery.includeName}`;
      }
      if (desc) {
        sql += ` desc`;
      }
      if (offset) {
        const placeholder = getPlaceholder();
        params[placeholder] = offset;
        sql += ` offset $${placeholder}`;
      }
      if (limit) {
        const placeholder = getPlaceholder();
        params[placeholder] = limit;
        sql += ` limit $${placeholder}`;
      }
    }
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
    if (groupKey) {
      return results;
    }
    if (results.length > 0) {
      return results[0][`${method}_result`];
    }
    return undefined;
  };
  if (tx && tx.isBatch) {
    return await processBatch(db, options, post);
  }
  const results = await db.all(options);
  return post(results);
}

const processInclude = (key, handler, parentQuery, defined, debugResult) => {
  const tableTarget = {};
  let otherProxy;
  let otherTarget;
  const tableHandler = {
    get: function(target, property) {
      if (!target.table) {
        target.table = property;
        return tableProxy;
      }
      if (!target.method) {
        target.method = property;
        return (...args) => {
          let where;
          if (defined) {
            const options = defined.get(target.table);
            if (options) {
              where = options.where;
              otherProxy = options.columnProxy;
              otherTarget = options.columnTarget;
            }
          }
          if (where) {
            if (args.length === 0) {
              args.push({});
            }
            const options = args.at(0);
            if (['get', 'many', 'exists'].includes(target.method)) {
              args[0] = { ...where, ...options };
            }
            else {
              if (!options.where) {
                options.where = where;
              }
              else {
                options.where = { ...options.where, ...where };
              }
            }
          }
          target.args = args;
          return tableProxy;
        }
      }
    }
  };
  const tableProxy = new Proxy(tableTarget, tableHandler);
  const columnHandler = {
    get: function(target, property) {
      target.name = property;
      return columnProxy;
    }
  }
  const columnTarget = {};
  const columnProxy = new Proxy(columnTarget, columnHandler);
  handler(tableProxy, columnProxy);
  const targetName = otherTarget ? otherTarget.name : columnTarget.name;
  if (parentQuery) {
    parentQuery.joinColumn = targetName;
  }
  const method = tableTarget.method;
  let where;
  const whereFirst = ['get', 'many', 'exists'].includes(method);
  if (whereFirst) {
    where = tableTarget.args[0] || {};
  }
  else {
    where = tableTarget.args[0].where || {};
  }
  let whereKey;
  for (const [key, value] of Object.entries(where)) {
    if (value === columnProxy || value === otherProxy) {
      whereKey = key;
      break;
    }
  }
  if (['first', 'get'].includes(method) && parentQuery) {
    let column;
    let where;
    if (method === 'first') {
      column = tableTarget.args[0].select;
      where = tableTarget.args[0].where;
    }
    else {
      if (tableTarget.args.length > 1) {
        column = tableTarget.args[1];
      }
      if (tableTarget.args.length > 0) {
        where = tableTarget.args[0];
      }
    }
    if (typeof column !== 'string') {
      throw Error('Cannot order by object types');
    }
    return {
      parentColumn: targetName,
      joinColumn: whereKey,
      table: tableTarget.table,
      column,
      where
    }
  }
  const runQuery = async (db, result) => {
    const singleResult = !parentQuery && !Array.isArray(result);
    const singleInclude = ['first', 'get', 'exists'].includes(method) || aggregateMethods.includes(method);
    let group = false;
    let values;
    const config = { debugResult };
    if (!parentQuery) {
      values = singleResult ? result[targetName] : result.map(item => item[targetName]);
    }
    if (whereKey) {
      where[whereKey] = values;
    }
    if (parentQuery) {
      const adjustedWhere = {};
      for (const [key, value] of Object.entries(where)) {
        if (key === whereKey) {
          continue;
        }
        adjustedWhere[key] = value;
      }
      if (whereFirst) {
        tableTarget.args[0] = adjustedWhere;
      }
      else {
        tableTarget.args[0].where = adjustedWhere;
      }
      where = adjustedWhere;
    }
    let returnToValues = null;
    if (['get', 'many', 'exists', ...aggregateMethods].includes(method) && whereKey !== undefined) {
      if (tableTarget.args.length > 1) {
        const select = tableTarget.args[1];
        if (!Array.isArray(select)) {
          if (select !== whereKey) {
            returnToValues = select;
            tableTarget.args[1] = [select, whereKey];
          }
        }
        else if (!select.includes(whereKey)) {
          select.push(whereKey);
        }
      }
      if (method === 'exists' || aggregateMethods.includes(method)) {
        group = true;
        config.groupKey = whereKey;
        config.parentQuery = parentQuery;
        if (parentQuery) {
          returnToValues = parentQuery.includeName;
        }
        else {
          returnToValues = `${method}_result`;
        }
      }
    }
    else if (whereKey !== undefined) {
      const options = tableTarget.args[0];
      const select = options.select;
      if (select) {
        if (!Array.isArray(select) && select !== whereKey) {
          returnToValues = select;
          options.select = [select, whereKey];
        }
        else if (!select.includes(whereKey)) {
          select.push(whereKey);
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
    if (['first', 'query'].includes(method)) {
      if (tableTarget.args[0].limit !== undefined) {
        config.partitionBy = whereKey;
      }
      else if (tableTarget.args[0].orderBy !== undefined && method === 'first' && queryMethod === 'query') {
        config.partitionBy = whereKey;
        config.singleRow = true;
      }
    }
    if (tableTarget.args.length === 0) {
      tableTarget.args.push(undefined);
    }
    if (['get', 'many'].includes(method) && tableTarget.args.length === 1) {
      tableTarget.args.push(undefined);
    }
    tableTarget.args.push(config);
    const included = await db[tableTarget.table][queryMethod](...tableTarget.args);
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
          const itemKey = item[targetName];
          if (whereKey !== undefined) {
            item[key] = included.filter(value => value[whereKey] === itemKey);
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
              if (method === 'exists') {
                item[key] = false;
              }
              else if (method === 'count') {
                item[key] = 0;
              }
              else {
                item[key] = value;
              }
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
      whereKey,
      postProcess
    }
  }
  return {
    parentColumn: targetName,
    runQuery
  }
}

const all = async (config) => {
  const { 
    db, 
    table, 
    first, 
    tx, 
    dbClient, 
    partitionBy, 
    singleRow 
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
  if (reservedWords.some(k => query.hasOwnProperty(k))) {
    const { where, select, omit, include, alias, debug, ...rest } = query;
    query = where || {};
    if (omit) {
      const remove = typeof omit === 'string' ? [omit] : omit;
      columns = Object.keys(db.columns[table]).filter(t => !remove.includes(t));
    }
    else {
      columns = select;
    }
    included = include;
    keywords = rest;
    if (alias) {
      if (!columns) {
        columns = [];
      }
      else if (typeof columns === 'string') {
        columns = [columns];
      }
      for (const [key, value] of Object.entries(alias)) {
        columns.push({ select: value, as: key });
      }
    }
    if (debug) {
      debugResult = {
        result: undefined,
        queries: []
      };
    }
  }
  const returnValue = ['string', 'function'].includes(typeof columns);
  const includeResults = [];
  let columnsToRemove = [];
  const runWhere = [];
  const runSort = [];
  let orderByIncludes;
  if (included) {
    const extraColumns = new Set();
    const includeNames = [];
    const maybeIncludeSort = keywords && keywords.orderBy && (keywords.limit !== undefined || keywords.offset !== undefined);
    const orderBy = [];
    if (keywords && keywords.orderBy) {
      if (!Array.isArray(keywords.orderBy)) {
        orderBy.push(keywords.orderBy);
      }
      else {
        orderBy.push(...keywords.orderBy);
      }
    }
    for (const [column, handler] of Object.entries(included)) {
      let parentQuery;
      const inSort = maybeIncludeSort && orderBy.includes(column);
      const inWhere = query.hasOwnProperty(column);
      if (inSort || inWhere) {
        parentQuery = {
          table,
          query,
          columns,
          include: included,
          keywords,
          includeName: column
        };
      }
      if (inSort) {
        runSort.push(column);
      }
      else if (inWhere) {
        runWhere.push(column);
      }
      const defined = db.includes.get(table);
      const result = processInclude(column, handler, parentQuery, defined, debugResult);
      extraColumns.add(result.parentColumn);
      includeResults.push({ column, result });
      includeNames.push(column);
    }
    if (columns) {
      columnsToRemove = Array.from(extraColumns.values()).filter(c => !columns.includes(c));
      columns.push(...columnsToRemove);
    }
    if (runSort.length > 0) {
      orderByIncludes = runSort.at(0);
    }
    else if (keywords && keywords.orderBy) {
      orderByIncludes = includeNames.find(n => orderBy.includes(n));
    }
  }
  const columnSet = db.columnSets[table];
  const verify = makeVerify(table, columnSet, included);
  const customFields = {};
  const select = toSelect(db, table, columns, verify, params, customFields);
  if (db.virtualSet.has(table)) {
    return await getVirtual(db, table, query, tx, keywords, select.clause, returnValue, verify, false);
  }
  let sql = 'select ';
  let runFirstInclude;
  let joinWithInclude = false;
  const otherTableColumns = new Map();
  if (runSort.length > 0) {
    const name = runSort.at(0);
    runFirstInclude = includeResults.find(r => r.column === name);
    const { table, column } = runFirstInclude.result;
    if (table !== undefined) {
      joinWithInclude = true;
      sql += `${table}.${column} as ${runFirstInclude.column}, `;
      const data = {
        table,
        column
      };
      otherTableColumns.set(runFirstInclude.column, data);
    }
  }
  const addWhere = () => {
    if (joinWithInclude) {
      const includeTable = runFirstInclude.result.table;
      const joinColumn = runFirstInclude.result.joinColumn;
      const parentColumn = runFirstInclude.result.parentColumn;
      sql += ` left join ${includeTable} on ${includeTable}.${joinColumn} = ${table}.${parentColumn}`;
      const parentClauses = toWhere(verify, table, query, params);
      const includeVerify = makeVerify(includeTable, db.columnSets[includeTable]);
      const includeWhere = runFirstInclude.result.where;
      const adjusted = {};
      for (const [key, value] of Object.entries(includeWhere)) {
        if (key === runFirstInclude.result.joinColumn) {
          continue;
        }
        adjusted[key] = value;
      }
      const includeClauses = toWhere(includeVerify, null, adjusted, params);
      if (parentClauses.whereClauses || includeClauses.whereClauses) {
        sql += ` where`;
        if (parentClauses.whereClauses) {
          sql += ` ${parentClauses.whereClauses}`;
        }
        if (includeClauses.whereClauses) {
          if (parentClauses.whereClauses) {
            sql += ' and';
          }
          sql += ` ${includeClauses.whereClauses}`;
        }
      }
    }
    else {
      sql += addClauses(verify, table, query, params);
    }
  }
  if (partitionBy) {
    let orderBy;
    if (keywords.orderBy) {
      orderBy = getOrderBy(verify, keywords, customFields);
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
    select.clause += `, row_number() over (partition by ${table}.${partitionBy} order by ${table}.${orderBy}${desc}) as ${alias}`;
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
    sql += `${select.clause} from ${table}`;
    addWhere();
    sql = wrapQuery(sql);
  }
  else {
    if (keywords && keywords.distinct) {
      sql += 'distinct ';
    }
    sql += `${select.clause} from ${table}`;
    if (runWhere.length > 0) {
      for (const key of runWhere) {
        const include = includeResults.find(r => r.column === key);
        const result = await include.result.runQuery(dbClient);
        include.postProcess = result.postProcess;
        const mapped = result.raw.map(r => r[result.whereKey]);
        query = {
          [include.result.parentColumn]: mapped
        };
      }
    }
    if (runSort.length > 0 && !joinWithInclude) {
      const result = await runFirstInclude.result.runQuery(dbClient);
      runFirstInclude.postProcess = result.postProcess;
      const mapped = result.raw.map(r => r[result.whereKey]);
      query = {
        [runFirstInclude.result.parentColumn]: mapped
      };
    }
    addWhere();
    if (runSort.length === 0 || joinWithInclude) {
      sql += toKeywords(verify, keywords, params, customFields, included);
    }
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
          const other = otherTableColumns.get(key);
          if (other) {
            created[key] = db.convertToJs(other.table, other.column, value);
          }
          else {
            created[key] = db.convertToJs(table, key, value);
          }
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
    if (orderByIncludes) {
      const sample = result.find(r => r[orderByIncludes] !== null && r[orderByIncludes] !== undefined);
      if (sample !== undefined) {
        const type = sample[orderByIncludes] instanceof Date ? 'Date' : typeof sample[orderByIncludes];
        let sorter;
        const nullSorter = (sorter, desc) => {
          return (a, b) => {
            if (a === b) {
              return 0;
            }
            if (a === null || a === undefined) {
              if (b !== null && b !== undefined) {
                if (desc) {
                  return -1;
                }
                return 1;
              }
              return 0;
            }
            if (b === null || b === undefined) {
              if (a !== null & a !== undefined) {
                if (desc) {
                  return 1;
                }
                return -1;
              }
              return 0;
            }
            return sorter(a, b);
          }
        }
        if (type === 'string') {
          if (keywords.desc) {
            sorter = nullSorter((a, b) => b[orderByIncludes].localeCompare(a[orderByIncludes]), true);
          }
          else {
            sorter = nullSorter((a, b) => a[orderByIncludes].localeCompare(b[orderByIncludes]));
          }
        }
        else if (type === 'number' || type === 'boolean') {
          if (keywords.desc) {
            sorter = nullSorter((a, b) => b[orderByIncludes] - a[orderByIncludes], true);
          }
          else {
            sorter = nullSorter((a, b) => a[orderByIncludes] - b[orderByIncludes]);
          }
        }
        else if (type === 'Date') {
          if (keywords.desc) {
            const sort = (a, b) => {
              const order = b[orderByIncludes].getTime() - a[orderByIncludes].getTime();
              if (isNaN(order)) {
                return 0;
              }
              return order;
            };
            sorter = nullSorter(sort, true);
          }
          else {
            const sort = (a, b) => {
              const order = a[orderByIncludes].getTime() - b[orderByIncludes].getTime();
              if (isNaN(order)) {
                return 0;
              }
              return order;
            };
            sorter = nullSorter(sort);
          }
        }
        else {
          throw Error(`Cannot sort ${type} types`);
        }
        result.sort(sorter);
      }
    }
    return debugReturn(result);
  }
}

const remove = async (db, table, query, tx) => {
  if (!db.initialized) {
    await db.initialize();
  }
  const columnSet = db.columnSets[table];
  const verify = makeVerify(table, columnSet);
  let sql = `delete from ${table}`;
  const params = {};
  sql += addClauses(verify, table, query, params);
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
  aggregate,
  all,
  remove
}
