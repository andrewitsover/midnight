import returnTypes from './types.js';
import { getPlaceholder, jsonSelector } from './utils.js';
import { compareOperators, mathOperators, toDbName } from './methods.js';

const addParam = (options) => {
  const { db, params, value } = options;
  const placeholder = getPlaceholder();
  params[placeholder] = db.jsToDb(value);
  return `$${placeholder}`;
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
  if (param instanceof Date) {
    return 'date';
  }
  if (Buffer && Buffer.isBuffer(param)) {
    return 'blob';
  }
  return 'json';
}

const sanitize = (s) => s.replaceAll(/'/gmi, '\'\'');

const toLiteral = (value) => {
  const type = typeof value;
  if (type === 'string') {
    return `'${sanitize(value)}'`;
  }
  if (type === 'boolean') {
    return value === true ? 1 : 0;
  }
  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }
  return value;
}

const processArg = (options) => {
  const {
    db,
    arg,
    params,
    requests,
    inJson
  } = options;
  const request = requests.get(arg);
  if (request && request.category !== 'Column') {
    return processMethod({
      db,
      method: request,
      params,
      requests
    });
  }
  else if (request && request.category === 'Column') {
    let sql = request.selector || request.sql || request.name;
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
    sql = addParam({
      db,
      params,
      value: arg,
    });
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
    requests
  } = options;
  const items = [];
  for (const [key, value] of Object.entries(select)) {
    items.push(`'${key}'`);
    if (typeof value === 'symbol') {
      const valueArg = processArg({
        db,
        arg: value,
        requests,
        inJson: true
      });
      items.push(valueArg.sql);
    }
    else {
      const statement = addParam({
        db,
        params,
        value
      });
      items.push(statement);
    }
  }
  return items.join(', ');
}

const processWindow = (options) => {
  const {
    db,
    query,
    params,
    requests
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
      requests
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
          requests
        }));
      return args.map(a => a.sql).join(', ');
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
            throw Error('Invalid "preceding" argument');
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
          throw Error('Invalid "following" argument');
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
    requests
  } = options;
  if (method.alias) {
    return {
      sql: method.alias,
      type: method.type
    };
  }
  const arg = method.args.at(0);
  const isSymbol = typeof arg === 'symbol';
  const name = toDbName(method);
  const operator = mathOperators.get(name);
  let type = operator ? 'real' : (method.type === 'Compare' ? 'boolean' : returnTypes[name]);
  if (method.type === 'Compare') {
    const operator = compareOperators.get(name);
    const result = processArg({
      db,
      arg,
      params,
      requests
    });
    if (method.args.length === 1) {
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
    const to = method.args.at(1);
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
      requests
    });
    return {
      sql: `${selector} ${operator} ${toResult.sql}`,
      type
    }
  }
  if (name === 'cast') {
    const result = processArg({
      db,
      arg,
      params,
      requests
    });
    const type = method.args.at(1);
    if (!['real', 'integer'].includes(type)) {
      throw Error(`Invalid cast type ${type}`);
    }
    const sql = `cast(${result.sql} as ${type})`;
    return {
      sql,
      type
    }
  }
  if (['json_group_array', 'json_group_object', 'json_object'].includes(name)) {
    if (name === 'json_group_array') {
      let sql;
      const argRequest = requests.get(arg);
      const selectRequest = !argRequest && requests.get(arg.select);
      const request = argRequest || selectRequest;
      const argIsProxy = argRequest && argRequest.isProxy;
      const isProxy = request && request.isProxy;
      let valueArg;
      if (!isProxy) {
        valueArg = isSymbol ? arg : (typeof arg.select === 'symbol' ? arg.select : null);
      }
      if (!isProxy && valueArg) {
        const body = processArg({
          db,
          arg: valueArg,
          params,
          requests,
          inJson: true
        });
        sql = `${name}(${body.sql})`;
      }
      else {
        let select;
        if (isProxy) {
          if (argIsProxy) {
            select = { ...arg };
          }
          else {
            select = { ...arg.select };
          }
        }
        else {
          select = arg.select ? arg.select : arg;
        }
        const body = getObjectBody({
          db,
          select,
          params,
          requests
        });
        sql = `${name}(json_object(${body}))`;
      }
      if (!argIsProxy && arg.select) {
        const clause = processWindow({
          db,
          query: arg,
          params,
          requests
        });
        sql += ` ${clause}`;
      }
      return {
        sql: sql.trim(),
        type
      };
    }
    else if (name === 'json_group_object') {
      let key;
      let value;
      if (isSymbol) {
        key = arg;
        value = method.args.at(1);
      }
      else {
        key = arg.key;
        value = arg.value;
      }
      const keyArg = processArg({
        db,
        arg: key,
        params,
        requests
      });
      const valueArg = processArg({
        db,
        arg: value,
        params,
        requests
      });
      let windowClause = '';
      if (!isSymbol) {
        windowClause = processWindow({
          db,
          query: arg,
          params,
          requests
        });
      }
      const sql = `${name}(${keyArg.sql}, ${valueArg.sql})${windowClause}`;
      return {
        sql,
        type
      };
    }
    else {
      const body = getObjectBody({
        db,
        select: arg,
        params,
        requests
      });
      const sql = `${name}(${body})`;
      return {
        sql,
        type
      };
    }
  }
  if (method.type === 'Window') {
    let sql;
    if (name === 'ntile') {
      const { groups } = arg;
      if (!Number.isInteger(groups)) {
        throw Error('Invalid "groups" argument');
      }
      sql = `ntil(${groups})`;
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
          requests
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
          requests
        }));
      type = parsed.at(0).type;
      sql = `${name}(${parsed.map(a => a.sql).join(', ')})`;
    }
    else if (['min', 'max', 'avg', 'sum', 'count'].includes(name) && isSymbol) {
      const bodyArg = processArg({
        db,
        arg,
        params,
        requests
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
        requests
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
      requests
    });
    if (clause) {
      sql += ` ${clause}`;
    }
    return {
      sql,
      type
    };
  }
  const processed = method.args.map(arg => processArg({
    db,
    arg,
    params,
    requests
  }));
  if (method.name === 'if') {
    const length = method.args.length;
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
        if (['boolean', 'date'].includes(current)) {
          type = current;
        }
      }
    }
  }
  if (name === 'nullif') {
    const current = processed.map(p => p.type).at(0);
    if (['boolean', 'date'].includes(current)) {
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
    requests
  } = options;
  const type = options.type || 'and';
  const statements = [];
  if (Object.keys(where).length > 0) {
    throw Error('The "where" clause has a string as a key');
  }
  const whereKeys = Object.getOwnPropertySymbols(where);
  for (const symbol of whereKeys) {
    let selector;
    const request = requests.get(symbol);
    if (request.category !== 'Column') {
      if (request.alias) {
        selector = request.alias;
      }
      else {
        const keyArg = processMethod({
          db,
          method: request,
          params,
          requests
        });
        selector = keyArg.sql;
      }
    }
    else {
      selector = request.selector || request.sql || request.name;
    }
    const value = where[symbol];
    const valueRequest = requests.get(value);
    if (valueRequest && valueRequest.type === 'Compare') {
      const { name, args } = valueRequest;
      const param = args.at(0);
      if (name === 'not' && param === null) {
        statements.push(`${selector} is not null`);
      }
      else {
        const operator = compareOperators.get(name);
        const result = processArg({
          db,
          arg: param,
          params,
          requests
        });
        if (name === 'not' && Array.isArray(param)) {
          statements.push(`${selector} not in (select json_each.value from json_each(${result.sql}))`);
        }
        else {
          statements.push(`${selector} ${operator} ${result.sql}`);
        }
      }
    }
    else if (valueRequest && valueRequest.category !== 'Column') {
      const methodArg = processMethod({
        db,
        method: valueRequest,
        params,
        requests
      });
      statements.push(`${selector} = ${methodArg.sql}`);
    }
    else if (valueRequest && valueRequest.category === 'Column') {
      statements.push(`${selector} = ${valueRequest.selector}`);
    }
    else if (value === null) {
      statements.push(`${selector} is null`);
    }
    else {
      if (params) {
        const statement = addParam({
          db,
          params,
          value
        });
        if (Array.isArray(value)) {
          statements.push(`${selector} in (select json_each.value from json_each(${statement}))`);
        }
        else {
          statements.push(`${selector} = ${statement}`);
        }
      }
      else {
        if (Array.isArray(value)) {
          statements.push(`${selector} in (${value.map(v => toLiteral(v)).join(', ')})`);
        }
        else {
          statements.push(`${selector} = ${toLiteral(value)}`);
        }
      }
    }
  }
  for (const type of ['and', 'or']) {
    const value = where[type];
    if (value) {
      if (!Array.isArray(value)) {
        throw Error(`Invalid arguments to "${type}" in the where clause`);
      }
      const statement = value
        .map(where => toWhere({ 
          db, 
          where, 
          type,
          params,
          requests
        }))
        .join(` ${type} `);
      statements.push(statement);
    }
  }
  return statements.join(` ${type} `);
}

export {
  processArg,
  processMethod,
  toWhere
}
