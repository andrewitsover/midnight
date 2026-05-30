import {
  insert,
  insertMany,
  update,
  upsert,
  exists,
  aggregate,
  match,
  all,
  remove
} from './queries.js';
import { removeCapital } from './utils.js';
import { Table } from './tables.js';

class TableApi {
  constructor(args) {
    const { db, table, subquery } = args;
    this.subquery = subquery;
    this.table = table;
    this.db = db;
    this.state = args;
  }

  insert(values) {
    return insert({
      ...this.state,
      values
    });
  }

  returnInsert(values) {
    return insert({
      ...this.state,
      values,
      returning: true
    });
  }

  insertMany(items) {
    return insertMany({
      ...this.state,
      items
    });
  }

  returnInsertMany(items) {
    return insertMany({
      ...this.state,
      items,
      returning: true
    });
  }

  update(options) {
    return update({
      ...this.state,
      options
    });
  }

  upsert(options) {
    return upsert({
      ...this.state,
      options
    });
  }

  returnUpsert(options) {
    return upsert({
      ...this.state,
      options,
      returning: true
    });
  }

  exists(query) {
    return exists({
      ...this.state,
      query
    });
  }

  count(query) {
    return aggregate({
      ...this.state,
      query,
      method: 'count'
    });
  }

  avg(query) {
    return aggregate({
      ...this.state,
      query,
      method: 'avg'
    });
  }

  min(query) {
    return aggregate({
      ...this.state,
      query,
      method: 'min'
    });
  }

  max(query) {
    return aggregate({
      ...this.state,
      query,
      method: 'max'
    });
  }

  sum(query) {
    return aggregate({
      ...this.state,
      query,
      method: 'sum'
    });
  }

  get(query, columns) {
    return all({
      ...this.state,
      query,
      columns,
      first: true
    });
  }

  many(query, columns) {
    return all({
      ...this.state,
      query,
      columns
    });
  }

  match(query) {
    return match({
      ...this.state,
      query
    });
  }

  query(query) {
    return all({
      ...this.state,
      query,
      type: 'complex'
    });
  }

  first(query) {
    return all({
      ...this.state,
      query,
      type: 'complex',
      first: true
    });
  }

  delete(query) {
    return remove({
      ...this.state,
      query
    });
  }
}

class DbApi {
  constructor(db) {
    this.db = db;
    for (const table of db.schema) {
      const name = removeCapital(table.name);
      this[name] = new TableApi({
        db,
        table: name
      });
    }
  }

  exec(sql) {
    this.db.exec(sql);
  }

  begin(type) {
    this.db.begin(type);
  }

  commit() {
    this.db.commit();
  }

  rollback() {
    this.db.rollback();
  }

  migrate(sql) {
    this.db.migrate(sql);
  }

  getSchema() {
    return this.db.getSchema();
  }

  diff(previous) {
    return this.db.diff(previous);
  }

  first(lambda) {
    return this.db.query(lambda, true);
  }

  firstValue(lambda) {
    return this.db.query(lambda, true);
  }

  query(lambda) {
    return this.db.query(lambda);
  }

  queryValues(lambda) {
    return this.db.query(lambda);
  }

  subquery(lambda) {
    return this.db.subquery(lambda);
  }

  use(subquery) {
    const symbol = Object.values(subquery).at(0);
    const request = Table.requests.get(symbol);
    const context = request.subquery;
    return new TableApi({
      db: this.db,
      subquery: context
    });
  }

  [Symbol.dispose]() {
    this.db.close();
  }
}

export default DbApi;
