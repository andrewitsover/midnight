interface SQLiteDatabase {
  name: string;
}

type Unwrap<T extends any[]> = {
  [K in keyof T]: T[K] extends Promise<infer U> ? U : T[K];
};

interface SubqueryReturn {
  select: { [key: string | symbol]: SelectType };
  join?: { [key: symbol]: symbol | { left?: symbol, right?: symbol, recursive?: symbol }};
  where?: { [key: symbol]: symbol | null | number | boolean | Date };
  groupBy?: symbol | symbol[];
  having?: { [key: symbol]: symbol };
  orderBy?: symbol | symbol[];
  offset?: number;
  limit?: number;
  as: string;
}

type SubqueryContext = Tables & CompareMethods<Date | number | boolean | null | string | Buffer | symbol> & ComputeMethods & SymbolMethods;

interface TypedDb {
  [key: string]: any;
  exec(sql: string): Promise<void>;
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  pragma(sql: string): Promise<any[]>;
  deferForeignKeys(): Promise<void>;
  getTransaction(): Promise<TypedDb>;
  batch:<T extends any[]> (batcher: (bx: TypedDb) => T) => Promise<Unwrap<T>>;
  query<S extends SelectType, K extends { select: { [key: string | symbol]: S }}, T extends (context: SubqueryContext) => K>(expression: T): Promise<ToJsType<ReturnType<T>['select']>[]>;
}

export const database: SQLiteDatabase;
export const db: TypedDb;
