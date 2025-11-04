import reserved from './reserved.js';

let paramCount = 1;

const getPlaceholder = () => {
  const count = paramCount;
  paramCount++;
  if (paramCount > (2 ** 20)) {
    paramCount = 0;
  }
  return `p_${count}`;
}

const toValues = (rows) => {
  if (!rows || rows.length === 0) {
    return rows;
  }
  const sample = rows[0];
  const keys = Object.keys(sample);
  if (keys.length === 1) {
    const key = keys[0];
    return rows.map(r => r[key]);
  }
  return rows;
}

const expressionHandler = (expression) => {
  const columnHandler = {
    get: function(target, property) {
      const request = {
        name: property,
        path: [],
        proxy: null
      };
      const pathHandler = {
        get: function(target, property) {
          const path = target.path;
          path.push(property);
          return pathProxy;
        }
      };
      const pathProxy = new Proxy(request, pathHandler);
      request.proxy = pathProxy;
      columnRequests.push(request);
      return pathProxy;
    }
  }
  const columnTarget = {};
  const columnProxy = new Proxy(columnTarget, columnHandler);
  const columnRequests = [];
  const methodHandler = {
    get: function(target, property) {
      const request = {
        name: property,
        args: null
      };
      methodRequests.push(request);
      return (...args) => {
        request.args = args;
        return request;
      };
    }
  }
  const methodTarget = {};
  const methodProxy = new Proxy(methodTarget, methodHandler);
  const methodRequests = [];
  expression(columnProxy, methodProxy);
  const method = methodRequests.at(0);
  const operators = new Map([
    ['plus', '+'],
    ['minus', '-'],
    ['divide', '/'],
    ['multiply', '*']
  ]);
  const createClause = (params) => {
    const processColumn = (column) => {
      if (column.path.length === 0) {
        return column.name;
      }
      const placeholder = getPlaceholder();
      const path = `$.${column.path.join('.')}`;
      params[placeholder] = path;
      return `json_extract(${column.name}, $${placeholder})`;
    }
    const processMethod = (method) => {
      const statements = [];
      for (const arg of method.args) {
        const subMethod = methodRequests.find(r => r === arg);
        if (subMethod) {
          const statement = processMethod(subMethod);
          statements.push(statement);
          continue;
        }
        const column = columnRequests.find(r => r.proxy === arg);
        if (column) {
          const statement = processColumn(column);
          statements.push(statement);
        }
        else {
          const placeholder = getPlaceholder();
          params[placeholder] = arg;
          statements.push(`$${placeholder}`);
        }
      }
      const operator = operators.get(method.name);
      if (operator) {
        return statements.join(` ${operator} `);
      }
      return `${method.name}(${statements.join(', ')})`;
    }
    let statement;
    if (!method) {
      const column = columnRequests.at(0);
      statement = processColumn(column);
    }
    else {
      statement = processMethod(method);
    }
    return statement;
  }
  return {
    operators,
    columnRequests,
    methodRequests,
    createClause
  };
}

const addAlias = (clause, alias) => {
  const chars = clause.split('');
  let inside = false;
  let count = 0;
  let blanked = '';
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (char === '\'') {
      if (!inside) {
        inside = true;
      }
      else {
        count++;
        if (i < chars.length) {
          const next = chars[i + 1];
          if (next !== '\'') {
            if (count % 2 === 1) {
              inside = false;
            }
            count = 0;
          }
          blanked += ' ';
          continue;
        }
      }
    }
    blanked += inside ? ' ' : char;
  }
  const sections = blanked
    .replaceAll(/[a-z][a-z0-9_]+\s*\(/gmi, m => ' '.repeat(m.length))
    .replaceAll(/\(|\)/gm, ' ')
    .replaceAll('.', ' ')
    .replaceAll(/((^|[^a-z_])\d+([^a-z_]|$))/gmi, m => ' '.repeat(m.length))
    .replaceAll(/([^a-z0-9_])/gm, m => ' '.repeat(m.length))
    .split(/(\s+)/gm)
    .filter(s => s.length > 0);
  let index = 0;
  let result = '';
  for (const section of sections) {
    if (section.startsWith(' ')) {
      result += clause.substring(index, index + section.length);
    }
    else {
      result += `${alias}.${section}`;
    }
    index += section.length;
  }
  return result;
}

const jsonSelector = (type, sql) => {
  if (type === 'boolean') {
    return `(case when ${sql} = 1 then json('true') when ${sql} = 0 then json('false') end)`;
  }
  else if (type === 'json') {
    return `json(${sql})`;
  }
  return sql;
}

const nameToSql = (column, alias) => {
  let name = column;
  if (reserved.has(column)) {
    name = `[${name}]`;
  }
  if (alias) {
    return `${alias}.${name}`;
  }
  return name;
}

export {
  addAlias,
  toValues,
  nameToSql,
  jsonSelector,
  getPlaceholder,
  expressionHandler
}
