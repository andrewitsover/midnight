import reserved from './reserved.js';
import { compareOperators } from './methods.js';

const pick = (table, columns) => Object.fromEntries(columns.map(c => [c, table[c]]));

const omit = (table, columns) => {
  const entries = Object.keys(table)
    .filter(k => !columns.includes(k))
    .map(c => [c, table[c]]);
  return Object.fromEntries(entries);
};

const createPlaceholder = () => {
  let paramCount = 1;

  return () => {
    const count = paramCount;
    paramCount++;
    if (paramCount > (2 ** 20)) {
      paramCount = 0;
    }
    return `p_${count}`;
  }
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
    .replaceAll(/([^a-z0-9_\[\]])/gm, m => ' '.repeat(m.length))
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

const temporal = [
  Temporal.Duration,
  Temporal.Instant,
  Temporal.PlainDate,
  Temporal.PlainDateTime,
  Temporal.PlainMonthDay,
  Temporal.PlainTime,
  Temporal.PlainYearMonth,
  Temporal.ZonedDateTime
];

const removeCapital = (name) => {
  return name.at(0).toLowerCase() + name.substring(1);
}

const dateTypes = temporal.map(t => removeCapital(t.name));

const jsonSelector = (type, sql) => {
  if (type === 'boolean') {
    return `(case when ${sql} is null then ${sql} else (case when ${sql} = 1 then json('true') when ${sql} = 0 then json('false') end) end)`;
  }
  else if (type === 'json') {
    return `(case when ${sql} is null then ${sql} else json(${sql}) end)`;
  }
  else if (type === 'bigInt') {
    return `(case when ${sql} is null then ${sql} else json_object('$bigInt', cast(${sql} as text)) end)`;
  }
  else if (type === 'blob') {
    return `(case when ${sql} is null then ${sql} else json_object('$blob', base64(${sql})) end)`;
  }
  else if (dateTypes.includes(type)) {
    return `(case when ${sql} is null then ${sql} else json_object('$${type}', ${sql}) end)`;
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

const sanitize = (s) => s.replaceAll(`'`, `''`);

const toLiteral = (value) => {
  if (value === null) {
    return 'null';
  }
  const type = typeof value;
  if (type === 'string') {
    return `'${sanitize(value)}'`;
  }
  if (type === 'boolean') {
    return value === true ? '1' : '0';
  }
  if (type === 'number') {
    return `${value}`;
  }
  if (type === 'bigint') {
    return `${value.toString()}`;
  }
  const exists = temporal.some(type => value instanceof type);
  if (exists) {
    return `'${value.toString()}'`;
  }
  throw Error('invalid literal');
}

const isColumn = (request) => {
  return ['Column', 'SubqueryColumn'].includes(request.category);
}

export {
  pick,
  omit,
  addAlias,
  nameToSql,
  jsonSelector,
  createPlaceholder,
  removeCapital,
  temporal,
  toLiteral,
  isColumn
}
