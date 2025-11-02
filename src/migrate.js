import { toSql, columnToSql, indexToSql, toHash } from './tables.js'

const recreate = (table, current) => {
  const temp = `temp_${table.name}`;
  let sql = toSql({ ...table, name: temp, indexes: [] });
  const shared = current
    .columns
    .filter(c => table.columns.map(c => c.name).includes(c.name))
    .map(c => c.name)
    .join(', ');
  sql += '\n';
  sql += `insert into ${temp} (${shared}) select ${shared} from ${table.name};\n`;
  sql += `drop table ${table.name};\n`;
  sql += `alter table ${temp} rename to ${table.name};\n`;
  for (const index of table.indexes) {
    sql += indexToSql(table.name, index);
  }
  sql += 'pragma foreign_key_check;\n';
  return sql;
}

const toString = (column) => Object.values(column).join('');
const attributesEqual = (c1, c2) => {
  const clone1 = structuredClone(c1);
  const clone2 = structuredClone(c2);
  clone1.name = '';
  clone2.name = '';
  return toString(clone1) === toString(clone2);
}

const toMigration = (existing, updated) => {
  let migrations = '';
  const newTables = updated.filter(u => !existing.map(e => e.name).includes(u.name));
  for (const table of newTables) {
    migrations += toSql(table);
  }
  const removedTables = existing.filter(e => !updated.map(u => u.name).includes(e.name));
  for (const table of removedTables) {
    migrations += `drop table ${table.name};\n`;
  }
  for (const table of updated) {
    const current = existing.find(t => t.name === table.name);
    if (!current) {
      continue;
    }
    const removeChecks = current
      .checks
      .filter(c => !table.checks.includes(c))
      .length > 0;
    const removePrimary = current
      .primaryKeys
      .filter(k => !table.primaryKeys.includes(k))
      .length > 0;
    const removeForeign = current
      .foreignKeys
      .map(k => toString(k))
      .filter(k => !table.foreignKeys.map(f => toString(f))
      .includes(k))
      .length > 0;
    let alterColumns = false;
    for (const column of table.columns) {
      const existing = current.columns.find(c => c.name === column.name);
      if (existing) {
        if (toString(existing) !== toString(column)) {
          alterColumns = true;
          break;
        }
      }
    }
    if (removeChecks || removePrimary || removeForeign || alterColumns) {
      migrations += recreate(table, current);
      continue;
    }
    const addColumns = table
      .columns
      .filter(u => !current.columns.map(c => c.name).includes(u.name));
    const removeColumns = current
      .columns
      .filter(c => !table.columns.map(c => c.name).includes(c.name));
    const renameColumns = [];
    for (const column of removeColumns) {
      const same = addColumns.find(c => attributesEqual(column, c));
      if (same) {
        renameColumns.push(same.name, column.name);
        const sql = `alter table ${table.name} rename column ${column.name} to ${same.name};\n`;
        migrations += sql;
      }
    }
    for (const column of addColumns) {
      if (renameColumns.includes(column.name)) {
        continue;
      }
      const clause = columnToSql(column);
      const sql = `alter table ${table.name} add column ${clause};\n`;
      migrations += sql;
    }
    const existingHashes = current.indexes.map(index => toHash(index));
    const updatedHashes = table.indexes.map(index => toHash(index));
    const removeIndexes = existingHashes.filter(h => !updatedHashes.includes(h));
    for (const index of removeIndexes) {
      migrations += `drop index ${table.name}_${index};\n`;
    }
    for (const index of table.indexes) {
      const hash = toHash(index);
      const existing = existingHashes.find(h => h === hash);
      if (!existing) {
        migrations += indexToSql(table.name, index);
      }
    }
    for (const column of removeColumns) {
      if (renameColumns.includes(column.name)) {
        continue;
      }
      migrations += `alter table ${table.name} drop column ${column.name};\n`;
    }
  }
  return migrations;
}

export default toMigration;
