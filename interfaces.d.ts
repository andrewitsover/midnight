export interface Keywords {
  orderBy?: Array<string> | string;
  desc?: boolean;
  limit?: number;
  offset?: number;
  distinct?: boolean;
}

export interface KeywordsWithExclude<T> {
  exclude: T;
  orderBy?: Array<string> | string;
  desc?: boolean;
  limit?: number;
  offset?: number;
  distinct?: boolean;
}

export interface VirtualKeywords<T> {
  rank?: true;
  bm25?: Record<keyof Omit<T, "rowid">, number>;
  limit?: number;
  offset?: number;
}

export interface VirtualKeywordsHighlight<T> {
  rank?: true;
  bm25?: Record<keyof Omit<T, "rowid">, number>;
  highlight: { column: keyof T, tags: [string, string] };
  limit?: number;
  offset?: number;
}

export interface VirtualKeywordsSnippet<T> {
  rank?: true;
  bm25?: Record<keyof Omit<T, "rowid">, number>;
  snippet: { column: keyof T, tags: [string, string], trailing: string, tokens: number };
  limit?: number;
  offset?: number;
}

export interface VirtualQueries<T, W> {
  [key: string]: any;
  get(params?: W | null): Promise<T | undefined>;
  get(params: W | null, columns: null, keywords?: VirtualKeywords<T>): Promise<T | undefined>;
  get<K extends keyof T>(params: W | null, column: K, keywords?: VirtualKeywords<T>): Promise<T[K] | undefined>;
  get<K extends keyof T>(params: W | null, column: K[] & (keyof T)[], keywords?: VirtualKeywords<T>): Promise<Pick<T, K> | undefined>;
  get(params: W | null, columns: null, keywords: VirtualKeywordsHighlight<T>): Promise<{ id: number, highlight: string } | undefined>;
  get(params: W | null, columns: null, keywords: VirtualKeywordsSnippet<T>): Promise<{ id: number, snippet: string } | undefined>;
  many(params?: W): Promise<Array<T>>;
  many(params: W, columns: null, keywords?: VirtualKeywords<T>): Promise<Array<T>>;
  many<K extends keyof T>(params: W | null, columns: K[] & (keyof T)[], keywords?: VirtualKeywords<T>): Promise<Array<Pick<T, K>>>;
  many<K extends keyof T>(params: W | null, column: K, keywords?: VirtualKeywords<T>): Promise<Array<T[K]>>;
  many(params: W | null, columns: null, keywords: VirtualKeywordsHighlight<T>): Promise<Array<{ id: number, highlight: string }>>;
  many(params: W | null, columns: null, keywords: VirtualKeywordsSnippet<T>): Promise<Array<{ id: number, snippet: string }>>;
}

export interface Queries<T, I, W, R> {
  [key: string]: any;
  insert(params: I): Promise<R>;
  insertMany(params: Array<I>): Promise<void>;
  update(query: W | null, params: Partial<T>): Promise<number>;
  get(params?: W | null): Promise<T | undefined>;
  get(params: W | null, columns: null, keywords: Keywords): Promise<T | undefined>;
  get<K extends keyof T>(params: W | null, columns: K[] & (keyof T)[], keywords?: Keywords): Promise<Pick<T, K> | undefined>;
  get<K extends keyof T>(params: W | null, column: K, keywords?: Keywords): Promise<T[K] | undefined>;
  get<K extends keyof T>(params: W | null, columns: null, keywords: KeywordsWithExclude<K[]>): Promise<Omit<T, K> | undefined>;
  many(params?: W): Promise<Array<T>>;
  many(params: W, columns: null, keywords: Keywords): Promise<Array<T>>;
  many<K extends keyof T>(params: W | null, columns: K[] & (keyof T)[], keywords?: Keywords): Promise<Array<Pick<T, K>>>;
  many<K extends keyof T>(params: W | null, column: K, keywords?: Keywords): Promise<Array<T[K]>>;
  many<K extends keyof T>(params: W | null, columns: null, keywords: KeywordsWithExclude<K[]>): Promise<Array<Omit<T, K>>>;
  count(params: W | null, keywords?: { distinct: true }): Promise<number>;
  exists(params: W | null): Promise<boolean>;
  remove(params?: W): Promise<number>;
}

interface Range<T> {
	gt?: T;
	gte?: T;
	lt?: T;
	lte?: T;
}

interface WhereMethods<T> {
	not: (value: T | Array<T> | null) => [];
	gt: (value: T) => [];
	lt: (value: T) => [];
	lte: (value: T) => [];
	like: (pattern: string) => [];
	match: (pattern: string) => [];
	glob: (pattern: string) => [];
	range: (limits: Range<T>) => [];
	eq: (value: T) => [];
}

type WhereBuilder<T> = WhereMethods<T> & {
	[key in Exclude<string, keyof WhereMethods<T>>]: WhereBuilder<T>;
}

type JsonWhereFunction = (builder: WhereBuilder<string | number | boolean>) => [];
type WhereFunction<T> = (builder: WhereMethods<T>) => [];

type JsonProperty = {
  [key: string]: JsonSelector;
}

type TablePropertyr<T> = {
  [key in T]: JsonProperty;
}

type Selector<T> = (builder: TableProperty<T>) => JsonProperty;

type AliasProperty<T> = {
  [key: string]: Selector<T>;
}
