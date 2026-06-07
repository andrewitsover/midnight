import returnTypes from './types.js';
import { jsonSelector, nameToSql, temporal, removeCapital, toLiteral, isColumn } from './utils.js';
import { compareOperators, mathOperators, toDbName } from './methods.js';

const dateTypes = temporal.map(t => removeCapital(t.name));

const addParam = (options) => {
  const {
    db,
    params,
    value,
    getPlaceholder
  } = options;
  const placeholder = getPlaceholder();
  const result = db.jsToDb(value);
  params[placeholder] = result.value;
  return {
    type: result.type,
    sql: `$${placeholder}`
  }
}

const getParamType = (param) => {
  const type = typeof param;
  if (param === null) {
    return 'null';
  }
  if (type === 'string') {
    return 'text';
  }
  if (type === 'number') {
    return 'real';
  }
  if (type === 'boolean') {
    return type;
  }
  if (param instanceof Uint8Array) {
    return 'blob';
  }
  const found = temporal.find(type => param instanceof type);
  if (found) {
    return removeCapital(found.name);
  }
  return 'json';
}

const processArg = (options) => {
  const {
    db,
    arg,
    params,
    requests,
    inJson,
    getPlaceholder,
    root,
    getRequest
  } = options;
  const request = getRequest(arg);
  if (request && !isColumn(request)) {
    return processMethod({
      db,
      method: request,
      params,
      requests,
      getPlaceholder,
      root,
      getRequest
    });
  }
  else if (request && isColumn(request)) {
    if (root) {
      const symbol = Symbol();
      const item = {
        category: 'UsedColumn',
        column: request,
        method: root
      };
      requests.set(symbol, item);
    }
    let sql = request.selector || request.sql || nameToSql(request.name);
    const type = request.type;
    if (inJson) {
      sql = jsonSelector(type, request.selector);
    }
    return {
      sql,
      type
    };
  }
  let sql;
  if (params !== undefined) {
    const result = addParam({
      db,
      params,
      value: arg,
      getPlaceholder
    });
    sql = result.sql;
  }
  else {
    sql = toLiteral(arg);
  }
  const type = getParamType(arg);
  return {
    sql,
    type
  };
}

const getObjectBody = (options) => {
  const {
    db,
    select,
    params,
    requests,
    getPlaceholder,
    root,
    getRequest
  } = options;
  const items = [];
  const types = [];
  for (const [key, value] of Object.entries(select)) {
    items.push(`'${key}'`);
    if (typeof value === 'symbol') {
      const valueArg = processArg({
        db,
        arg: value,
        requests,
        inJson: true,
        getPlaceholder,
        root,
        getRequest
      });
      types.push(valueArg.type);
      items.push(valueArg.sql);
    }
    else if (typeof value === 'object') {
      const result = getObjectBody({
        db,
        select: value,
        params,
        requests,
        getPlaceholder,
        root,
        getRequest
      });
      types.push(result.type);
      items.push(`json_object(${result.sql})`);
    }
    else {
      throw Error('invalid arguments to "object" method');
    }
  }
  return {
    sql: items.join(', '),
    types
  }
}

const processWindow = (options) => {
  const {
    db,
    query,
    params,
    requests,
    getPlaceholder,
    root,
    getRequest
  } = options;
  let sql = '';
  const { 
    where, 
    partitionBy, 
    orderBy, 
    desc, 
    frame 
  } = query;
  if (where) {
    const clause = toWhere({
      db,
      where,
      params,
      requests,
      getPlaceholder,
      getRequest
    });
    sql += `filter (where ${clause})`;
  }
  if (partitionBy || orderBy) {
    let clause = '';
    const processItems = (items) => {
      const args = items.map(arg => processArg({
          db,
          arg,
          params,
          requests,
          getPlaceholder,
          root,
          getRequest
        }));
      const mapped = args.map(arg => {
        if (arg.type === 'zonedDateTime') {
          return `temporal_nanoseconds(${arg.sql})`;
        }
        return arg.sql;
      });
      return mapped.join(', ');
    }
    if (partitionBy) {
      const items = Array.isArray(partitionBy) ? partitionBy : [partitionBy];
      clause += ` partition by ${processItems(items)}`;
    }
    if (orderBy) {
      const items = Array.isArray(orderBy) ? orderBy : [orderBy];
      clause += ` order by ${processItems(items)}${desc ? ' desc' : ''}`;
    }
    if (frame) {
      const {
        type,
        currentRow,
        preceding,
        following
      } = frame;
      clause += ` ${type} between `;
      if (currentRow) {
        clause += 'current row and ';
      }
      if (preceding !== undefined) {
        if (preceding === 'unbounded') {
          clause += 'unbounded preceding and ';
        }
        else {
          if (Number.isInteger(preceding)) {
            clause += `${preceding} preceding and `;
          }
          else {
            throw Error('invalid argument for: preceding');
          }
        }
      }
      if (following === 'unbounded') {
        clause += 'unbounded following';
      }
      else {
        if (Number.isInteger(following)) {
          clause += `${following} following and `;
        }
        else {
          throw Error('invalid argument for: following');
        }
      }
    }
    sql += ` over (${clause.trim()})`;
  }
  return sql;
}

const processMethod = (options) => {
  const {
    db,
    method,
    params,
    requests,
    getPlaceholder,
    left,
    getRequest
  } = options;
  if (method.alias) {
    return {
      sql: method.alias,
      type: method.type
    };
  }
  const args = method.args;
  const arg = args.at(0);
  const isSymbol = typeof arg === 'symbol';
  const root = options.root ? options.root : method;
  const name = toDbName(method);
  const operator = mathOperators.get(name);
  let type = operator ? 'real' : (method.subcategory === 'Compare' ? 'boolean' : returnTypes[name]);
  if (method.subcategory === 'Compare') {
    const operator = compareOperators.get(name);
    const result = processArg({
      db,
      arg,
      params,
      requests,
      getPlaceholder,
      root,
      getRequest
    });
    if (result.type === 'zonedDateTime' && args.length === 2) {
      const second = processArg({
        db,
        arg: args.at(1),
        params,
        requests,
        getPlaceholder,
        root,
        getRequest
      });
      return {
        sql: `temporal_compare(${result.sql}, ${second.sql}) ${operator} 0`,
        type
      }
    }
    if (method.name === 'like' && args.at(1) instanceof RegExp) {
      const pattern = args.at(1);
      const source = getPlaceholder();
      const flags = getPlaceholder();
      params[source] = pattern.source;
      params[flags] = pattern.flags;
      return {
        sql: `regex(${result.sql}, $${source}, $${flags})`,
        type
      }
    }
    if (args.length === 1) {
      if (name === 'not' && arg === null) {
        return {
          sql: 'is not null',
          type
        }
      }
      return {
        sql: `${operator} ${result.sql}`,
        type
      }
    }
    const selector = result.sql;
    const to = args.at(1);
    if (name === 'not' && to === null) {
      return {
        sql: `${selector} is not null`,
        type
      }
    }
    const toResult = processArg({
      db,
      arg: to,
      params,
      requests,
      getPlaceholder,
      root,
      getRequest
    });
    return {
      sql: `${selector} ${operator} ${toResult.sql}`,
      type
    }
  }
  if (method.name === 'extract' && args.length === 2 && typeof args.at(1) === 'function') {
    const chain = [];
    const proxy = new Proxy(function() {}, {
      get(target, prop) {
        chain.push(prop);
        return proxy;
      },
      apply(target, thisArg, args) {
        chain.push(args.at(0));
        return proxy;
      }
    });
    args.at(1)(proxy);
    let path = '$';
    for (let i = 0; i < chain.length; i++) {
      const current = chain[i];
      if (current === 'at') {
        if (i === chain.length - 1) {
          path += `.${current}`;
          break;
        }
        const next = chain[i + 1];
        if (typeof next === 'number') {
          if (next === -1) {
            path += `[#${next}]`;
          }
          path += `[${next}]`;
        }
        else {
          path += `.${current}.${next}`;
        }
        i++;
      }
      else {
        path += `.${current}`;
      }
    }
    const result = processArg({
      db,
      arg: arg.symbol,
      params,
      requests,
      getPlaceholder,
      root,
      getRequest
    });
    const match = /^json\((?<selector>.+)\)$/.exec(result.sql);
    const selector = match ? match.groups.selector : result.sql;
    const placeholder = getPlaceholder();
    params[placeholder] = path;
    return {
      sql: `${selector} -> $${placeholder}`,
      type: 'json'
    }
  }
  if (name === 'highlight') {
    const [symbol, before, after] = args;
    const column = getRequest(symbol);
    const index = Object
      .keys(db.columns[column.table])
      .filter(k => k !== 'rowid')
      .findIndex(c => c === column.name);
    return {
      sql: `highlight(${column.table}, ${index}, '${before}', '${after}')`,
      type
    }
  }
  if (name === 'cast') {
    const result = processArg({
      db,
      arg,
      params,
      requests,
      getPlaceholder,
      root,
      getRequest
    });
    const type = args.at(1);
    if (!['real', 'integer'].includes(type)) {
      throw Error(`invalid cast type: ${type}`);
    }
    const sql = `cast(${result.sql} as ${type})`;
    return {
      sql,
      type
    }
  }
  if (['json_group_array', 'json_group_object', 'json_object'].includes(name)) {
    const isWindow = method.name === 'windowGroup';
    let otherTypes;
    if (name === 'json_group_array') {
      let sql;
      let valueArg;
      let selectArg;
      const select = isWindow ? arg.select : arg;
      const request = getRequest(select);
      if (request && request.isProxy) {
        selectArg = { ...select };
      }
      else {
        if (!request) {
          selectArg = select;
        }
        else {
          valueArg = select;
        }
      }
      if (valueArg) {
        const result = processArg({
          db,
          arg: valueArg,
          params,
          requests,
          inJson: true,
          getPlaceholder,
          root,
          getRequest
        });
        otherTypes = [result.type];
        sql = `${name}(${result.sql})`;
      }
      else {
        const result = getObjectBody({
          db,
          select: selectArg,
          params,
          requests,
          root,
          getRequest
        });
        otherTypes = result.types;
        sql = `${name}(json_object(${result.sql}))`;
      }
      if (isWindow) {
        const clause = processWindow({
          db,
          query: arg,
          params,
          requests,
          getPlaceholder,
          root,
          getRequest
        });
        sql += ` ${clause}`;
      }
      else if (left) {
        const used = Array.from(requests.values())
          .filter(r => r.category === 'UsedColumn')
          .filter(r => r.method === root)
          .map(r => r.column)
          .filter(c => db.notNull[c.table][c.name])
          .at(0);
        if (used) {
          sql += ` filter (where ${used.selector} is not null)`;
        }
      }
      return {
        sql: sql.trim(),
        type,
        otherTypes
      };
    }
    else if (name === 'json_group_object') {
      let key;
      let value;
      if (isWindow) {
        key = arg.key;
        value = arg.value;
      }
      else {
        key = arg;
        value = args.at(1);
      }
      const keyArg = processArg({
        db,
        arg: key,
        params,
        requests,
        getPlaceholder,
        root,
        getRequest
      });
      const valueArg = processArg({
        db,
        arg: value,
        params,
        requests,
        getPlaceholder,
        root,
        getRequest
      });
      otherTypes = [keyArg.type, valueArg.type];
      let windowClause = '';
      if (isWindow) {
        windowClause = processWindow({
          db,
          query: arg,
          params,
          requests,
          getPlaceholder,
          root,
          getRequest
        });
      }
      const sql = `${name}(${keyArg.sql}, ${valueArg.sql})${windowClause}`;
      return {
        sql,
        type,
        otherTypes
      };
    }
    else {
      const result = getObjectBody({
        db,
        select: arg,
        params,
        requests,
        getPlaceholder,
        root,
        getRequest
      });
      otherTypes = result.types;
      const sql = `${name}(${result.sql})`;
      return {
        sql,
        type,
        otherTypes
      };
    }
  }
  if (method.subcategory === 'Window') {
    let sql;
    if (name === 'ntile') {
      const { groups } = arg;
      if (!Number.isInteger(groups)) {
        throw Error('invalid argument: groups');
      }
      sql = `ntile(${groups})`;
    }
    else if (name === 'lag' || name === 'lead') {
      const { expression, offset, otherwise } = arg;
      const args = [expression, offset, otherwise];
      const parsed = args
        .filter(a => a !== undefined)
        .map(arg => processArg({
          db,
          arg,
          params,
          requests,
          getPlaceholder,
          root,
          getRequest
        }));
      if (parsed.length === 1) {
        type = parsed.at(0).type;
      }
      else if (parsed.length === 3) {
        if (parsed.at(0).type === parsed.at(2).type) {
          type = parsed.at(0).type;
        }
      }
      sql = `${name}(${parsed.map(a => a.sql).join(', ')})`;
    }
    else if (['first_value', 'last_value', 'nth_value'].includes(name)) {
      const { expression, row } = arg;
      const args = [expression, row];
      const parsed = args
        .filter(a => a !== undefined)
        .map(arg => processArg({
          db,
          arg,
          params,
          requests,
          getPlaceholder,
          root,
          getRequest
        }));
      type = parsed.at(0).type;
      sql = `${name}(${parsed.map(a => a.sql).join(', ')})`;
    }
    else if (['min', 'max', 'avg', 'sum', 'count'].includes(name) && isSymbol) {
      const bodyArg = processArg({
        db,
        arg,
        params,
        requests,
        getPlaceholder,
        root,
        getRequest
      });
      const sql = `${name}(${bodyArg.sql})`;
      if (['min', 'max'].includes(name)) {
        type = bodyArg.type;
      }
      return {
        sql,
        type
      };
    }
    else if (name === 'count' && !arg) {
      const sql = 'count(*)';
      return {
        sql,
        type
      };
    }
    else if (['min', 'max', 'avg', 'sum', 'count'].includes(name)) {
      const { column, distinct } = arg;
      const field = column || distinct;
      const bodyArg = processArg({
        db,
        arg: field,
        params,
        requests,
        getPlaceholder,
        root,
        getRequest
      });
      if (['min', 'max'].includes(name)) {
        type = bodyArg.type;
      }
      sql = `${name}(${distinct ? 'distinct ' : ''}${bodyArg.sql})`;
    }
    else {
      sql = `${name}()`;
    }
    const clause = processWindow({
      db,
      query: arg,
      params,
      requests,
      getPlaceholder,
      root,
      getRequest
    });
    if (clause) {
      sql += ` ${clause}`;
    }
    return {
      sql,
      type
    };
  }
  const processed = args.map(arg => processArg({
    db,
    arg,
    params,
    requests,
    getPlaceholder,
    root,
    getRequest
  }));
  if (method.name === 'iif') {
    const length = args.length;
    if (length <= 13) {
      const types = [];
      for (let i = 1; i < processed.length; i += 2) {
        types.push(processed[i].type);
      }
      if (length % 2 === 1) {
        types.push(processed.at(-1).type);
      }
      const unique = new Set(types);
      if (unique.size === 1) {
        type = types.at(0);
      }
    }
  }
  const statements = processed.map(p => p.sql);
  let sql;
  if (operator) {
    sql = statements.join(` ${operator} `);
  }
  else {
    sql = `${name}(${statements.join(', ')})`;
  }
  if (['coalesce', 'min', 'max'].includes(name)) {
    if (processed.length > 1) {
      const types = processed.map(p => p.type);
      const unique = new Set(types);
      if (unique.size === 1) {
        const current = types.at(0);
        if (current === 'boolean' || dateTypes.includes(current)) {
          type = current;
        }
      }
    }
  }
  if (name === 'nullif') {
    const current = processed.map(p => p.type).at(0);
    if (current === 'boolean' || dateTypes.includes(current)) {
      type = current;
    }
  }
  return {
    sql,
    type
  };
}

const toWhere = (options) => {
  const {
    db,
    where,
    params,
    requests,
    getPlaceholder,
    internal,
    getRequest
  } = options;
  const type = options.type || 'and';
  const statements = [];
  const invalidKeys = Object.keys(where)
    .filter(k => !['and', 'or'].includes(k))
    .length > 0;
  if (invalidKeys) {
    throw Error('the where clause has a string as a key');
  }
  const whereKeys = Object.getOwnPropertySymbols(where);
  for (const symbol of whereKeys) {
    let selector;
    const request = getRequest(symbol);
    if (request && !isColumn(request)) {
      if (request.alias) {
        selector = request.alias;
      }
      else {
        const keyArg = processMethod({
          db,
          method: request,
          params,
          requests,
          getPlaceholder,
          getRequest
        });
        selector = keyArg.sql;
      }
    }
    else {
      selector = request.selector || request.sql || nameToSql(request.name);
    }
    const value = where[symbol];
    const valueRequest = getRequest(value);
    if (valueRequest && valueRequest.subcategory === 'Compare') {
      const { name, args } = valueRequest;
      const param = args.at(0);
      if (request.type === 'zonedDateTime') {
        if (args.length === 1) {
          const result = processArg({
            db,
            arg: param,
            params,
            requests,
            getPlaceholder,
            getRequest
          });
          const operator = compareOperators.get(name);
          statements.push(`temporal_compare(${selector}, ${result.sql}) ${operator} 0`);
        }
        else {
          const first = processArg({
            db,
            arg: param,
            params,
            requests,
            getPlaceholder,
            getRequest
          });
          const second = processArg({
            db,
            arg: args.at(1),
            params,
            requests,
            getPlaceholder,
            getRequest
          });
          const operator = compareOperators.get(name);
          statements.push(`${selector} = temporal_compare(${first.sql}, ${second.sql}) ${operator} 0`);
        }
      }
      else if (name === 'not' && param === null) {
        statements.push(`${selector} is not null`);
      }
      else if (name === 'like' && args.some(a => a instanceof RegExp)) {
        if (args.length === 1) {
          const source = getPlaceholder();
          const flags = getPlaceholder();
          params[source] = param.source;
          params[flags] = param.flags;
          statements.push(`regex(${selector}, $${source}, $${flags})`);
        }
        else {
          const arg = args.at(1);
          const result = processArg({
            db,
            arg: param,
            params,
            requests,
            getPlaceholder,
            getRequest
          });
          const source = getPlaceholder();
          const flags = getPlaceholder();
          params[source] = arg.source;
          params[flags] = arg.flags;
          statements.push(`${selector} = regex(${result.sql}, $${source}, $${flags})`);
        }
      }
      else {
        if (name === 'not') {
          const found = getRequest(param);
          if (found && found.isProxy) {
            const column = Object.keys(param).at(0);
            const symbol = param[column];
            const request = getRequest(symbol, false);
            statements.push(`${selector} not in (select ${request.selector} from ${request.tableAlias})`);
            continue;
          }
        }
        const operator = compareOperators.get(name);
        const result = processArg({
          db,
          arg: param,
          params,
          requests,
          getPlaceholder,
          getRequest
        });
        if (name === 'not' && Array.isArray(param)) {
          statements.push(`${selector} not in (select json_each.value from json_each(${result.sql}))`);
        }
        else {
          statements.push(`${selector} ${operator} ${result.sql}`);
        }
      }
    }
    else if (valueRequest && !valueRequest.isProxy && !isColumn(valueRequest)) {
      const methodArg = processMethod({
        db,
        method: valueRequest,
        params,
        requests,
        getPlaceholder,
        getRequest
      });
      statements.push(`${selector} = ${methodArg.sql}`);
    }
    else if (valueRequest && !valueRequest.isProxy && isColumn(valueRequest)) {
      statements.push(`${selector} = ${valueRequest.selector}`);
    }
    else if (value === null) {
      statements.push(`${selector} is null`);
    }
    else {
      if (valueRequest && valueRequest.isProxy) {
        const column = Object.keys(value).at(0);
        const symbol = value[column];
        const request = getRequest(symbol);
        statements.push(`${selector} in (select ${request.selector} from ${request.tableAlias})`);
      }
      else if (params) {
        const result = addParam({
          db,
          params,
          value,
          getPlaceholder,
          getRequest
        });
        if (Array.isArray(value)) {
          statements.push(`${selector} in (select json_each.value from json_each(${result.sql}))`);
        }
        else {
          if (request.type === 'zonedDateTime') {
            statements.push(`temporal_compare(${selector}, ${result.sql}) = 0`);
          }
          else {
            statements.push(`${selector} = ${result.sql}`);
          }
        }
      }
      else {
        if (Array.isArray(value)) {
          statements.push(`${selector} in (${value.map(v => toLiteral(v)).join(', ')})`);
        }
        else {
          const literal = toLiteral(value);
          if (request.type === 'zonedDateTime') {
            statements.push(`temporal_compare(${selector}, ${literal}) = 0`);
          }
          else {
            statements.push(`${selector} = ${literal}`);
          }
        }
      }
    }
  }
  for (const type of ['and', 'or']) {
    const value = where[type];
    if (value) {
      if (!Array.isArray(value)) {
        throw Error(`invalid arguments to ${type} in the where clause`);
      }
      const statement = value
        .map(where => toWhere({ 
          db, 
          where, 
          type,
          params,
          requests,
          getPlaceholder,
          internal: true,
          getRequest
        }))
        .join(` ${type} `);
      statements.push(`(${statement})`);
    }
  }
  const sql = statements.join(` ${type} `);
  if (!internal && sql.startsWith('(')) {
    return sql.slice(1, -1);
  }
  return sql;
}

export {
  processArg,
  processMethod,
  toWhere
}
