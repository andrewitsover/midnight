interface TypedDb {
  [key: string]: any,
  batch:<T extends any[]> (batcher: (bx: TypedDb) => T) => Promise<Unwrap<T>>
}

declare function makeClient(db: any): TypedDb;

export default makeClient;
