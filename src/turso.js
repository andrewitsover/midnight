import Database from './db.js';
import { makeClient } from './proxy.js';

class TursoDatabase extends Database {
  constructor(props) {
    super({ ...props, name: 'turso' });
    this.db = props.db;
  }

  async runMigration(sql) {
    const defer = 'pragma defer_foreign_keys = true';
    const split = sql.split(';').filter(s => s.length > 2);
    const statements = [defer, ...split].map(sql => ({ sql, args: [] }));
    try {
      await this.db.batch(statements, 'write');
    }
    catch (e) {
      throw e;
    }
  }

  async begin(type) {
    if (!type || !['read', 'write'].includes(type)) {
      throw Error(`Invalid transaction type: ${type}`);
    }
    const db = await this.db.transaction(type);
    await tx.db.begin();
    return makeClient(this, { db });
  }

  async commit(tx) {
    await tx.db.commit();
  }

  async rollback(tx) {
    await tx.db.rollback();
  }

  async sync() {
    await this.db.sync();
  }

  async getError(sql) {
    return this.db.execute(sql);
  }

  async basicRun(sql) {
    return await this.db.execute(sql);
  }

  async insertBatch(inserts) {
    const mapped = inserts.map(insert => {
      return {
        sql: insert.query,
        args: insert.params
      }
    });
    await this.db.batch(mapped, 'write');
  }

  async batch(type, handler) {
    if (!handler) {
      handler = type;
      type = 'write';
    }
    const client = makeClient(this, { isBatch: true });
    const handlers = handler(client).flat();
    const results = await Promise.all(handlers);
    const flat = results.flat();
    const responses = await this.db.batch(flat.map(r => r.statement), type);
    return responses.map((response, i) => {
      const handler = results[i];
      if (handler.post) {
        return handler.post(response);
      }
      return response;
    });
  }

  async run(props) {
    let { query, params, adjusted, tx } = props;
    const isBatch = tx && tx.isBatch;
    if (props.statement && !isBatch) {
      return await this.db.execute(statement);
    }
    if (params === null) {
      params = undefined;
    }
    if (params !== undefined && !adjusted) {
      params = this.adjust(params);
    }
    const statement = {
      sql: query,
      args: params || {}
    };
    if (isBatch) {
      return statement;
    }
    await this.db.execute(statement);
  }

  async all(props) {
    let { query, params, options, adjusted, tx } = props;
    const isBatch = tx && tx.isBatch;
    if (props.statement && !isBatch) {
      const meta = await this.db.execute(statement);
      return this.process(meta.rows, options);
    }
    if (params === null) {
      params = undefined;
    }
    if (params !== undefined && !adjusted) {
      params = this.adjust(params);
    }
    const statement = {
      sql: query,
      args: params || {}
    };
    if (isBatch) {
      return {
        statement,
        post: (meta) => this.process(meta.rows, options)
      }
    }
    const meta = await this.db.execute(statement);
    return this.process(meta.rows, options);
  }

  async exec(sql) {
    await this.db.execute(sql);
  }
}

export default TursoDatabase;
