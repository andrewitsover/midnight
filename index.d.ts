type ExtractKeys<U> = U extends Record<string, any> ? keyof U : keyof {};

interface Keywords<T, K> {
  orderBy?: K | ((column: T, method: ComputeMethods) => void);
  desc?: boolean;
  limit?: number;
  offset?: number;
  distinct?: boolean;
}

type ReadQueries<P, T> = Pick<ToQuery<P, T>, 'get' | 'many' | 'query' | 'first' | 'count' | 'avg' | 'sum' | 'min' | 'max' | 'exists' | 'groupBy'>;

interface Includes<T, R> {
  [key: string]: (tables: T & { use: <S>(query: S) => ReadQueries<T, S> }, columns: R) => any;
}

type ObjectFunction = {
  [key: string]: (...args: any) => any;
}

type MergeIncludes<T, U extends ObjectFunction> = 
  T & { [K in keyof U]: ReturnType<U[K]> extends Promise<infer R> ? (R extends any[] ? R : R | null) : never;
};

type ReturnTypes<T extends ObjectFunction> = {
  [K in keyof T]: ReturnType<T[K]>;
};

type ConvertAlias<T, U extends ObjectFunction> = 
  T & { [K in keyof U]: ReturnType<U[K]> extends Promise<infer R> ? R : never;
};

type IncludeWhere<U extends ObjectFunction> = {
  [K in keyof U]: ReturnType<U[K]> extends Promise<infer R>
    ? R extends string | number | Date | boolean ? R | Array<R> | WhereFunction<R> | null : never : never;
}

interface VirtualKeywords<T> extends Keywords<T, (keyof T)[] | keyof T> {
  rank?: true;
  bm25?: Partial<Record<keyof Omit<T, "rowid">, number>>;
}

interface Highlighter<T> extends VirtualKeywords<T> {
  highlight: { column: keyof T, tags: [string, string] };
}

interface Snippet<T> extends VirtualKeywords<T> {
  snippet: { column: keyof T, tags: [string, string], trailing: string, tokens: number };
}

interface HighlightQuery<W, T> extends Highlighter<T> {
  where?: W;
}

interface SnippetQuery<W, T> extends Snippet<T> {
  where?: W;
}

interface VirtualQuery<W, T> extends VirtualKeywords<T> {
  where?: W;
}

interface VirtualQueryObject<W, K, T> extends VirtualQuery<W, T> {
  select: (keyof T)[] | K[];
}

interface VirtualQueryValue<W, K, T> extends VirtualQuery<W, T> {
  select: K;
}

interface AggregateQuery<W, K> {
  where?: W;
  column?: K;
  distinct?: K;
}

interface AggregateQueryDebug<W, K> extends AggregateQuery<W, K> {
  debug: true;
}

interface ComplexQueryInclude<W, T, U extends ObjectFunction> extends Keywords<T, Array<keyof T> | keyof T> {
  where?: W;
  select?: undefined;
  include?: U;
}

interface ComplexSqlQueryIncludeParams<P, W, T, R extends ObjectFunction> extends ComplexQueryInclude<W, T, R> {
  params: P;
}

interface ComplexSqlQueryInclude<W, T, R extends ObjectFunction> extends ComplexQueryInclude<W, T, R> {
  params?: undefined;
}

interface ComplexSqlQueryIncludeParamsDebug<P, W, T, R extends ObjectFunction> extends ComplexSqlQueryIncludeParams<P, W, T, R> {
  debug: true;
}

interface ComplexSqlQueryIncludeDebug<W, T, R extends ObjectFunction> extends ComplexSqlQueryInclude<W, T, R> {
  debug: true;
}

interface ComplexQueryIncludeDebug<W, T, U extends ObjectFunction> extends ComplexQueryInclude<W, T, U> {
  debug: true;
}

interface ComplexQueryObjectInclude<W, K, T, U extends ObjectFunction> extends Keywords<T, keyof T | Array<keyof T>> {
  where?: W;
  select: (keyof T)[] | K[];
  include?: U;
}

interface ComplexSqlQueryObjectIncludeParams<P, W, K, T, R extends ObjectFunction> extends ComplexQueryObjectInclude<W, K, T, R> {
  params: P;
}

interface ComplexSqlQueryObjectInclude<W, K, T, R extends ObjectFunction> extends ComplexQueryObjectInclude<W, K, T, R> {
  params?: undefined;
}

interface ComplexSqlQueryObjectIncludeParamsDebug<P, W, K, T, R extends ObjectFunction> extends ComplexSqlQueryObjectIncludeParams<P, W, K, T, R> {
  debug: true;
}

interface ComplexSqlQueryObjectIncludeDebug<W, K, T, R extends ObjectFunction> extends ComplexSqlQueryObjectInclude<W, K, T, R> {
  debug: true;
}

interface ComplexQueryObjectIncludeDebug<W, K, T, U extends ObjectFunction> extends ComplexQueryObjectInclude<W, K, T, U> {
  debug: true;
}

interface ComplexQueryObjectIncludeOmit<W, K, T, U extends ObjectFunction> extends Keywords<T, keyof T | Array<keyof T>> {
  where?: W;
  select?: undefined;
  omit: (keyof T)[] | K[] | K;
  include?: U;
}

interface ComplexSqlQueryObjectIncludeOmitParams<P, W, K, T, R extends ObjectFunction> extends ComplexQueryObjectIncludeOmit<W, K, T, R> {
  params: P;
}

interface ComplexSqlQueryObjectIncludeOmit<W, K, T, R extends ObjectFunction> extends ComplexQueryObjectIncludeOmit<W, K, T, R> {
  params?: undefined;
}

interface ComplexSqlQueryObjectIncludeOmitParamsDebug<P, W, K, T, R extends ObjectFunction> extends ComplexSqlQueryObjectIncludeOmitParams<P, W, K, T, R> {
  debug: true;
}

interface ComplexSqlQueryObjectIncludeOmitDebug<W, K, T, R extends ObjectFunction> extends ComplexSqlQueryObjectIncludeOmit<W, K, T, R> {
  debug: true;
}

interface ComplexQueryObjectIncludeOmitDebug<W, K, T, U extends ObjectFunction> extends ComplexQueryObjectIncludeOmit<W, K, T, U> {
  debug: true;
}

interface ComplexQueryValue<W, K, T> extends Keywords<T, Array<keyof T> | keyof T> {
  where?: W;
  select: K;
  omit?: undefined;
  include?: undefined;
}

interface ComplexSqlQueryValueParams<P, W, K, T> extends ComplexQueryValue<W, K, T> {
  params: P;
}

interface ComplexSqlQueryValue<W, K, T> extends ComplexQueryValue<W, K, T> {
  params?: undefined;
}

interface ComplexSqlQueryValueParamsDebug<P, W, K, T> extends ComplexSqlQueryValueParams<P, W, K, T> {
  debug: true;
}

interface ComplexSqlQueryValueDebug<W, K, T> extends ComplexSqlQueryValue<W, K, T> {
  debug: true;
}

interface ComplexQueryValueDebug<W, K, T> extends ComplexQueryValue<W, K, T> {
  debug: true;
}

type MakeOptionalNullable<T> = {
  [K in keyof T]: undefined extends T[K] ? T[K] | null : T[K];
};

type AddComputed<T> = {
  [K in keyof T]: T[K] | ((column: T, methods: ComputeMethods) => void);
};

interface UpdateQuery<W, T> {
  where?: W | null;
  set: Partial<AddComputed<MakeOptionalNullable<T>>>;
}

interface UpsertQuery<T, K> {
  values: T;
  target?: K;
  set?: Partial<MakeOptionalNullable<T>>;
}

interface DebugQuery {
  sql: string;
  params?: any;
}

interface DebugResult<R> {
  result: R;
  queries: Array<DebugQuery>;
}

interface GroupQueryKeywords<W, K, U> {
  where?: W;
  orderBy?: K;
  desc?: boolean;
  limit?: number;
  offset?: number;
  include?: U;
}

interface GroupQueryCountStarColumn<A extends string, T, W, K, U> extends GroupQueryKeywords<W, K, U> {
  column: {
    [key in A]: true | keyof T;
  }
}

interface GroupQueryCountStarDistinct<A extends string, T, W, K, U> extends GroupQueryKeywords<W, K, U> {
  distinct: {
    [key in A]: true | keyof T;
  }
}

interface GroupQueryAggregateColumn<A extends string, T, W, K, U> extends GroupQueryKeywords<W, K, U> {
  column: {
    [key in A]: keyof T;
  }
}

interface GroupQueryAggregateDistinct<A extends string, T, W, K, U> extends GroupQueryKeywords<W, K, U> {
  distinct: {
    [key in A]: keyof T;
  }
}

interface GroupQueryObjectAlias<T, W, K, U, A> {
  where?: W;
  column?: keyof T;
  distinct?: keyof T;
  orderBy?: K;
  desc?: boolean;
  limit?: number;
  offset?: number;
  include?: U;
}

interface GroupArrayKeywords<W, K, U> {
  where?: W;
  orderBy?: K;
  desc?: boolean;
  limit?: number;
  offset?: number;
  include?: U;
}

interface GroupArray<A extends string, W, K, U> extends GroupArrayKeywords<W, K, U> {
  select: {
    [key in A]: true;
  }
}

interface GroupArraySelect<A extends string, W, K, U, S> extends GroupArrayKeywords<W, K, U> {
  select: {
    [key in A]: S[];
  }
}

interface GroupArrayValue<A extends string, W, K, U, S> extends GroupArrayKeywords<W, K, U> {
  select: {
    [key in A]: S;
  }
}

type DateToString<T> = T extends Date
  ? string
  : T extends object
    ? { [K in keyof T]: T[K] extends Date ? string : T[K] }
    : T;

interface AggregateMethods<T, W, K extends keyof T, Y> {
  count<A extends string, U extends Includes<Y, (Pick<T, K> & { count: number })>>(params?: GroupQueryCountStarColumn<A, T, W & ToWhere<{ count: number }>, K | 'count', U>): Promise<Array<MergeIncludes<Pick<T, K> & { [key in A]: number }, U>>>;
  count<A extends string, U extends Includes<Y, (Pick<T, K> & { count: number })>>(params?: GroupQueryCountStarDistinct<A, T, W & ToWhere<{ count: number }>, K | 'count', U>): Promise<Array<MergeIncludes<Pick<T, K> & { [key in A]: number }, U>>>;
  avg<A extends string, U extends Includes<Y, (Pick<T, K> & { avg: number })>>(params: GroupQueryAggregateColumn<A, T, W & ToWhere<{ avg: number }>, K | 'avg', U>): Promise<Array<MergeIncludes<Pick<T, K> & { [key in A]: number }, U>>>;
  avg<A extends string, U extends Includes<Y, (Pick<T, K> & { avg: number })>>(params: GroupQueryAggregateDistinct<A, T, W & ToWhere<{ avg: number }>, K | 'avg', U>): Promise<Array<MergeIncludes<Pick<T, K> & { [key in A]: number }, U>>>;
  max<A extends string, U extends Includes<Y, (Pick<T, K> & { max: number })>>(params: GroupQueryAggregateColumn<A, T, W & ToWhere<{ avg: number }>, K | 'max', U>): Promise<Array<MergeIncludes<Pick<T, K> & { [key in A]: number }, U>>>;
  max<A extends string, U extends Includes<Y, (Pick<T, K> & { max: number })>>(params: GroupQueryAggregateDistinct<A, T, W & ToWhere<{ avg: number }>, K | 'max', U>): Promise<Array<MergeIncludes<Pick<T, K> & { [key in A]: number }, U>>>;
  min<A extends string, U extends Includes<Y, (Pick<T, K> & { min: number })>>(params: GroupQueryAggregateColumn<A, T, W & ToWhere<{ avg: number }>, K | 'min', U>): Promise<Array<MergeIncludes<Pick<T, K> & { [key in A]: number }, U>>>;
  min<A extends string, U extends Includes<Y, (Pick<T, K> & { min: number })>>(params: GroupQueryAggregateDistinct<A, T, W & ToWhere<{ avg: number }>, K | 'min', U>): Promise<Array<MergeIncludes<Pick<T, K> & { [key in A]: number }, U>>>;
  sum<A extends string, U extends Includes<Y, (Pick<T, K> & { sum: number })>>(params: GroupQueryAggregateColumn<A, T, W & ToWhere<{ avg: number }>, K | 'sum', U>): Promise<Array<MergeIncludes<Pick<T, K> & { [key in A]: number }, U>>>;
  sum<A extends string, U extends Includes<Y, (Pick<T, K> & { sum: number })>>(params: GroupQueryAggregateDistinct<A, T, W & ToWhere<{ avg: number }>, K | 'sum', U>): Promise<Array<MergeIncludes<Pick<T, K> & { [key in A]: number }, U>>>;
  array<A extends string, S extends keyof T, U extends Includes<Y, Pick<T, K>>>(params: GroupArrayValue<A, W, K, U, S>): Promise<Array<MergeIncludes<Pick<T, K> & { [key in A]: Array<DateToString<T[S]>> }, U>>>;
  array<A extends string, U extends Includes<Y, Pick<T, K>>>(params: GroupArray<A, W, K, U>): Promise<Array<MergeIncludes<Pick<T, K> & { [key in A]: Array<DateToString<T>> }, U>>>;
  array<A extends string, S extends keyof T, U extends Includes<Y, Pick<T, K>>>(params: GroupArraySelect<A, W, K, U, S>): Promise<Array<MergeIncludes<Pick<T, K> & { [key in A]: Array<DateToString<Pick<T, S>>> }, U>>>;
}

type IfOddArgs<T> = 
  [BooleanParam, T, T] | 
  [BooleanParam, T, BooleanParam, T, T] | 
  [BooleanParam, T, BooleanParam, T, BooleanParam, T, T] | 
  [BooleanParam, T, BooleanParam, T, BooleanParam, T, BooleanParam, T, T] | 
  [BooleanParam, T, BooleanParam, T, BooleanParam, T, BooleanParam, T, BooleanParam, T, T] |
  [BooleanParam, T, BooleanParam, T, BooleanParam, T, BooleanParam, T, BooleanParam, T, BooleanParam, T, T];

type IfEvenArgs<T> = 
  [BooleanParam, T] | 
  [BooleanParam, T, BooleanParam, T] | 
  [BooleanParam, T, BooleanParam, T, BooleanParam, T] | 
  [BooleanParam, T, BooleanParam, T, BooleanParam, T, BooleanParam, T] | 
  [BooleanParam, T, BooleanParam, T, BooleanParam, T, BooleanParam, T, BooleanParam, T] |
  [BooleanParam, T, BooleanParam, T, BooleanParam, T, BooleanParam, T, BooleanParam, T, BooleanParam, T];

interface ComputeMethods {
  abs(n: OnlyNumbers): DbNumber;
  abs(n: NumberParam): NumberResult;
  cast(value: any, to: 'real'): DbNumber;
  cast(value: any, to: 'integer'): DbNumber;
  coalesce(a: StringResult, b: string): DbString;
  coalesce(a: NumberResult, b: number): DbNumber;
  coalesce(a: BooleanResult, b: boolean): DbBoolean;
  coalesce(a: DateResult, b: Date): DbDate;
  coalesce<T extends DbAny>(a: T, b: T, ...rest: T[]): T;
  coalesce(a: any, b: any, ...rest: any[]): AnyResult;
  concat(...args: any[]): DbString;
  concatWs(...args: any[]): DbString;
  format(format: OnlyStrings, ...args: any[]): DbString;
  format(format: StringParam, ...args: any[]): StringResult;
  if<T extends DbTypes | DbAny>(...args: IfOddArgs<T>): ToDbType<T>;
  if<T extends DbTypes | DbAny>(...args: IfEvenArgs<T>): ToDbType<T | null>;
  if(...args: any[]): AnyResult;
  instr(a: OnlyStrings, b: OnlyStrings): DbNumber;
  instr(a: StringBufferParam, b: StringBufferParam): NumberResult;
  length(value: any): NumberResult;
  lower(value: OnlyStrings): DbString;
  lower(value: StringParam): StringResult;
  ltrim(value: StringParam, remove?: StringParam): StringResult;
  max(a: DbNumber, b: number): DbNumber;
  max<T extends DbAny>(a: T, b: T, ...rest: T[]): T;
  max(a: any, b: any, ...rest: any[]): AnyResult;
  min(a: DbNumber, b: number): DbNumber;
  min<T extends DbAny>(a: T, b: T, ...rest: T[]): T;
  min(a: any, b: any, ...rest: any[]): AnyResult;
  nullif<T extends DbAny>(a: T, b: any): T | DbNull;
  nullif(a: any, b: any): AnyResult;
  octetLength(value: any): NumberResult;
  replace(value: OnlyStrings, occurances: OnlyStrings, substitute: OnlyStrings): DbString;
  replace(value: StringParam, occurances: StringParam, substitute: StringParam): StringResult;
  round(value: OnlyNumbers, places?: NumberParam): DbNumber;
  round(value: NumberParam, places?: NumberParam): NumberResult;
  rtrim<T extends StringParam>(value: T, remove?: StringParam): T;
  sign(value: OnlyNumbers): -1 | 0 | 1;
  sign(value: any): NumberResult;
  substring<T extends StringParam>(value: T, start: NumberParam, length?: NumberParam): T;
  trim<T extends StringParam>(value: T, remove?: StringParam): T;
  unhex(hex: StringParam, ignore?: StringParam): BufferResult;
  unicode(value: OnlyStrings): DbNumber;
  unicode(value: StringParam): NumberResult;
  upper(value: OnlyStrings): DbString;
  upper(value: StringParam): StringResult;
  date(): DbString;
  date(time: OnlyDates): DbString;
  date(time: DateParam, ...modifers: StringParam[]): StringResult;
  time(): DbString;
  time(time: OnlyDates): DbString;
  time(time: DateParam, ...modifers: StringParam[]): StringResult;
  dateTime(): DbString;
  dateTime(time: OnlyDates): DbString;
  dateTime(time: DateParam, ...modifers: StringParam[]): StringResult;
  julianDay(): DbNumber;
  julianDay(time: OnlyDates): DbNumber;
  julianDay(time: DateParam, ...modifers: StringParam[]): NumberResult;
  unixEpoch(): DbNumber;
  unixEpoch(time: OnlyDates): DbNumber;
  unixEpoch(time: DateParam, ...modifers: StringParam[]): StringResult;
  strfTime(format: StringParam, time: DateParam, ...modifers: StringParam[]): StringResult;
  timeDiff(start: OnlyDates, end: OnlyDates): DbString;
  timeDiff(start: DateParam, end: DateParam): StringResult;
  acos(value: NumberParam): NumberResult;
  acosh(value: NumberParam): NumberResult;
  asin(value: NumberParam): NumberResult;
  asinh(value: NumberParam): NumberResult;
  atan(value: NumberParam): NumberResult;
  atan2(b: NumberParam, a: NumberParam): NumberResult;
  atanh(value: NumberParam): NumberResult;
  ceil(value: OnlyNumbers): DbNumber;
  ceil(value: NumberParam): NumberResult;
  cos(value: OnlyNumbers): DbNumber;
  cos(value: NumberParam): NumberResult;
  cosh(value: NumberParam): NumberResult;
  degrees(value: NumberParam): NumberResult;
  exp(value: NumberParam): NumberResult;
  floor(value: OnlyNumbers): DbNumber;
  floor(value: NumberParam): NumberResult;
  ln(value: NumberParam): NumberResult;
  log(base: NumberParam, value: NumberParam): NumberResult;
  mod(value: NumberParam, divider: NumberParam): NumberResult;
  pi(): DbNumber;
  power(value: NumberParam, exponent: NumberParam): NumberResult;
  radians(value: NumberParam): NumberResult;
  sin(value: OnlyNumbers): DbNumber;
  sin(value: NumberParam): NumberResult;
  sinh(value: NumberParam): NumberResult;
  sqrt(value: NumberParam): NumberResult;
  tan(value: NumberParam): NumberResult;
  tanh(value: NumberParam): NumberResult;
  trunc(value: OnlyNumbers): DbNumber;
  trunc(value: NumberParam): NumberResult;
  json(param: JsonParam | any[]): StringResult;
  extract(json: JsonParam | any[], path: StringParam): ExtractResult;
  plus(...args: OnlyNumbers[]): DbNumber;
  plus(...args: NumberParam[]): NumberResult;
  minus(...args: OnlyNumbers[]): DbNumber;
  minus(...args: NumberParam[]): NumberResult;
  divide(...args: OnlyNumbers[]): DbNumber;
  divide(...args: NumberParam[]): NumberResult;
  multiply(...args: OnlyNumbers[]): DbNumber;
  multiply(...args: NumberParam[]): NumberResult;
  object<T extends { [key: string]: AllowedJson }>(select: T): ToJson<T>;
  arrayLength(param: JsonParam | any[]): NumberResult;
}

interface FrameOptions {
  type: 'rows' | 'groups' | 'range';
  currentRow?: true;
  preceding?: 'unbounded' | number;
  following?: 'unbounded' | number;
}

interface WindowOptions {
  partitionBy?: symbol | symbol[];
  where?: { [key: symbol]: symbol };
  orderBy?: symbol | symbol[];
  desc?: true;
  frame?: FrameOptions;
}

type ToJson<T> =
  T extends DbDate ? DbString :
  T extends (infer U)[] ? U extends DbDate ? DbString[] : U[] :
  T extends object ? { 
    [K in keyof T]: T[K] extends DbDate 
      ? DbString : T[K] 
  } : T;

type ToDbType<T> =
  T extends null ? DbNull :
  T extends infer U ? (
    U extends number ? DbNumber :
    U extends string ? DbString :
    U extends Date ? DbDate :
    U extends boolean ? DbBoolean :
    U extends null ? DbNull :
    U extends Json ? DbJson :
    U
  ) : T;

type ToDbInterface<T> = {
  [K in keyof T]: ToDbType<T[K]>;
};

type ToJsType<T> =
  T extends DbNull ? null :
  T extends ComputedNull ? null :
  T extends (infer U)[] ? ToJsType<U>[] :
  T extends new (...args: any[]) => Table ? GetReturnType<T> :
  T extends object
    ? {
        [K in keyof T]: ToJsType<T[K]>
      }
  : T extends DbNumber ? number :
    T extends PkNumber ? number :
    T extends ComputedNumber ? number :
    T extends DbString ? string :
    T extends PkString ? string :
    T extends ComputedString ? string :
    T extends DbDate ? Date :
    T extends PkDate ? Date :
    T extends ComputedDate ? Date :
    T extends DbBoolean ? boolean :
    T extends ComputedBoolean ? boolean :
    T extends DbJson ? Json :
    T extends ComputedJson ? Json :
    T extends DbBuffer ? Buffer :
    T extends PkBuffer ? Buffer :
    T extends ComputedBuffer ? Buffer :
    T extends string ? string :
    T extends number ? number :
    T extends boolean ? boolean :
    T extends Date ? Date :
    never;

interface LagOptions<T> {
  expression: T;
  offset?: number | DbNumber;
  otherwise?: T;
}

interface SymbolMethods {
  count(): DbNumber;
  count(column: AnyResult): DbNumber;
  count(options: WindowOptions & { distinct: AnyResult }): DbNumber;
  count(options: WindowOptions & { column: AnyResult }): DbNumber;
  min<T extends AnyParam>(column: T): T;
  min<T extends AnyParam>(options: WindowOptions & { distinct: T }): T;
  min<T extends AnyParam>(options: WindowOptions & { column: T }): T;
  max<T extends AnyParam>(column: T): T;
  max<T extends AnyParam>(options: WindowOptions & { distinct: T }): T;
  max<T extends AnyParam>(options: WindowOptions & { column: T }): T;
  avg<T extends NumberResult>(column: T): T;
  avg<T extends NumberResult>(options: WindowOptions & { distinct: T }): T;
  avg<T extends NumberResult>(options: WindowOptions & { column: T }): T;
  sum<T extends NumberResult>(column: T): T;
  sum<T extends NumberResult>(options: WindowOptions & { distinct: T }): T;
  sum<T extends NumberResult>(options: WindowOptions & { column: T }): T;
  rowNumber(options?: WindowOptions): DbNumber;
  rank(options?: WindowOptions): DbNumber;
  denseRank(options?: WindowOptions): DbNumber;
  percentRank(options?: WindowOptions): DbNumber;
  cumeDist(options?: WindowOptions): DbNumber;
  ntile(options: WindowOptions & { groups: number | DbNumber }): DbNumber;
  lag<T extends DbAny>(options: WindowOptions & LagOptions<T>): T;
  lead<T extends DbAny>(options: WindowOptions & LagOptions<T>): T;
  firstValue<T extends DbAny>(options: WindowOptions & { expression: T }): T;
  lastValue<T extends DbAny>(options: WindowOptions & { expression: T }): T;
  nthValue<T extends DbAny>(options: WindowOptions & { expression: T, row: number | DbNumber }): T;
  group<T extends AllowedJson>(options: WindowOptions & { select: T }): ToJson<T>[];
  group<T extends AllowedJson>(select: T): ToJson<T>[];
  group<T>(select: ToDbInterface<T>): ToJson<T>[];
  group<T extends AllowedJson>(key: DbString, value: T): Record<string, ToJson<T>>;
  group<T extends AllowedJson>(options: WindowOptions & { key: DbString, value: T }): Record<string, ToJson<T>>;
}

interface Compute<T> {
  [key: string]: (column: T, method: ComputeMethods) => void;
}

type MatchString = string | { startsWith: string } | { prefix: string };

interface MatchKeywords {
  phrase?: string;
  startsWith?: string;
  prefix?: string;
  and?: (MatchString | { or: string[] } | { not: string | string[] })[];
  or?: (MatchString | { and: string[] } | { not: string | string[] })[];
  not?: MatchString | string[];
  near?: [...string[], number];
}

interface MatchQuery<T> extends MatchKeywords, VirtualKeywords<T> {
  column?: {
    [K in keyof T]?: MatchKeywords | string;
  }
}

interface VirtualQueries<T, W> {
  match(query: MatchQuery<T>): Promise<T[]>;
  get(query: HighlightQuery<W, T>): Promise<{ id: number, highlight: string } | undefined>;
  get(query: SnippetQuery<W, T>): Promise<{ id: number, snippet: string } | undefined>;
  query<K extends keyof T>(query: VirtualQueryObject<W, K, T>): Promise<Array<Pick<T, K>>>;
  query<K extends keyof T>(query: VirtualQueryValue<W, K, T>): Promise<Array<T[K]>>;
  query(query: VirtualQuery<W, T>): Promise<Array<T>>;
  query(query: HighlightQuery<W, T>): Promise<Array<{ id: number, highlight: string }>>;
  query(query: SnippetQuery<W, T>): Promise<Array<{ id: number, snippet: string }>>;
}

interface WriteQueries<T, I, W, R> {
  insert(params: I): Promise<R>;
  insertMany(params: Array<I>): Promise<void>;
  update(options: UpdateQuery<W, I>): Promise<number>;
  upsert<K extends keyof T>(options: UpsertQuery<I, K>): Promise<R>;
  remove(params?: W): Promise<number>;
}

interface Queries<T, W, Y> {
  get(params?: W | null): Promise<T | undefined>;
  get<K extends keyof T>(params: W | null, column: K): Promise<T[K] | undefined>;
  get<K extends keyof T>(params: W | null, columns: (keyof T)[] | K[]): Promise<Pick<T, K> | undefined>;
  get<N>(params: W | null, column: (selector: T) => N): Promise<N | undefined>;
  many(params?: W): Promise<Array<T>>;
  many<K extends keyof T>(params: W | null, columns: (keyof T)[] | K[]): Promise<Array<Pick<T, K>>>;
  many<K extends keyof T>(params: W | null, column: K): Promise<Array<T[K]>>;
  query(): Promise<Array<T>>;
  query<K extends keyof T>(query: ComplexQueryValue<W, K, T>): Promise<Array<T[K]>>;
  query<K extends keyof T>(query: ComplexQueryValueDebug<W, K, T>): Promise<DebugResult<Array<T[K]>>>;
  query<K extends keyof T, U extends Includes<Y, T>>(query: ComplexQueryObjectInclude<W, K, T, U>): Promise<Array<MergeIncludes<Pick<T, K>, U>>>;
  query<K extends keyof T, U extends Includes<Y, T>>(query: ComplexQueryObjectIncludeDebug<W, K, T, U>): Promise<DebugResult<Array<MergeIncludes<Pick<T, K>, U>>>>;
  query<K extends keyof T, U extends Includes<Y, T>>(query: ComplexQueryObjectIncludeOmit<W, K, T, U>): Promise<Array<MergeIncludes<Omit<T, K>, U>>>;
  query<K extends keyof T, U extends Includes<Y, T>>(query: ComplexQueryObjectIncludeOmitDebug<W, K, T, U>): Promise<DebugResult<Array<MergeIncludes<Omit<T, K>, U>>>>;
  query<U extends Includes<Y, T>>(query: ComplexQueryInclude<W, T, U>): Promise<Array<MergeIncludes<T, U>>>;
  query<U extends Includes<Y, T>>(query: ComplexQueryIncludeDebug<W, T, U>): Promise<DebugResult<Array<MergeIncludes<T, U>>>>;
  first(): Promise<T | undefined>;
  first<K extends keyof T>(query: ComplexQueryValue<W, K, T>): Promise<T[K] | undefined>;
  first<K extends keyof T>(query: ComplexQueryValueDebug<W, K, T>): Promise<DebugResult<T[K] | undefined>>;
  first<K extends keyof T, U extends Includes<Y, T>>(query: ComplexQueryObjectInclude<W, K, T, U>): Promise<MergeIncludes<Pick<T, K>, U> | undefined>;
  first<K extends keyof T, U extends Includes<Y, T>>(query: ComplexQueryObjectIncludeDebug<W, K, T, U>): Promise<DebugResult<MergeIncludes<Pick<T, K>, U> | undefined>>;
  first<K extends keyof T, U extends Includes<Y, T>>(query: ComplexQueryObjectIncludeOmit<W, K, T, U>): Promise<MergeIncludes<Omit<T, K>, U> | undefined>;
  first<K extends keyof T, U extends Includes<Y, T>>(query: ComplexQueryObjectIncludeOmitDebug<W, K, T, U>): Promise<DebugResult<MergeIncludes<Omit<T, K>, U> | undefined>>;
  first<U extends Includes<Y, T>>(query: ComplexQueryInclude<W, T, U>): Promise<MergeIncludes<T, U> | undefined>;
  first<U extends Includes<Y, T>>(query: ComplexQueryIncludeDebug<W, T, U>): Promise<DebugResult<MergeIncludes<T, U> | undefined>>;
  count<K extends keyof T>(query?: AggregateQuery<W, K>): Promise<number>;
  avg<K extends keyof T>(query: AggregateQuery<W, K>): Promise<number>;
  max<K extends keyof T>(query: AggregateQuery<W, K>): Promise<T[K]>;
  min<K extends keyof T>(query: AggregateQuery<W, K>): Promise<T[K]>;
  sum<K extends keyof T>(query: AggregateQuery<W, K>): Promise<number>;
  exists(params: W | null): Promise<boolean>;
  groupBy<K extends keyof T>(columns: K | Array<K>): AggregateMethods<T, W, K, Y>;
}

type CompareMethods<T> = {
  not: (value: T | T[]) => symbol;
	gt: (value: NonNullable<T>) => symbol;
	lt: (value: NonNullable<T>) => symbol;
	lte: (value: NonNullable<T>) => symbol;
	like: (pattern: NonNullable<T>) => symbol;
	match: (pattern: NonNullable<T>) => symbol;
	glob: (pattern: NonNullable<T>) => symbol;
	eq: (value: T) => symbol;
}

type SymbolCompareMethods<T> = {
  not: (column: symbol, value: T) => DbBoolean;
	gt: (column: symbol, value: NonNullable<T>) => DbBoolean;
	lt: (column: symbol, value: NonNullable<T>) => DbBoolean;
	lte: (column: symbol, value: NonNullable<T>) => DbBoolean;
	like: (column: symbol, pattern: NonNullable<T>) => DbBoolean;
	match: (column: symbol, pattern: NonNullable<T>) => DbBoolean;
	glob: (column: symbol, pattern: NonNullable<T>) => DbBoolean;
	eq: (column: symbol, value: T) => DbBoolean;
}

type Transform<T> = NonNullable<T> extends string | number | Date
  ? CompareMethods<T>
  : NonNullable<T> extends boolean
  ? Pick<CompareMethods<T>, 'not' | 'eq'>
  : T;

type WhereFunction<T> = (builder: Transform<T>) => void;

type JsonValue = string | number | boolean | null;

type JsonArray = Array<Json>;

type JsonObject = {
  [key: string]: Json;
}

type JsonMap<T> = {
  [key: string]: T;
}

type Json = JsonValue | JsonObject | JsonArray;

type TableProperty = {
  [key: string]: TableProperty;
}

type TableObject<T> = {
  [key in keyof T]: TableProperty;
}

interface SqlQueryParams<P> {
  params: P;
}

type WhereField<T> = T | Array<NonNullable<T>> | WhereFunction<T> | null;

type OptionalToNull<T> = {
  [K in keyof T]-?: undefined extends T[K] ? Exclude<T[K], undefined> | null : T[K];
};

type Primitive = string | number | boolean | Date;

type ReplaceJson<T> =
  null extends T
    ? Exclude<T, null> extends Primitive ? T : string | null
    : T extends Primitive
      ? T
      : string;

type ToWhere<T> = {
  [K in keyof T]?: WhereField<ReplaceJson<T[K]>>;
} & {
  and?: Array<ToWhere<T>>;
  or?: Array<ToWhere<T>>;
};

interface QueryOptions {
  parse: boolean;
}

interface DatabaseConfig {
  debug?: boolean;
}

interface SQLiteConfig extends DatabaseConfig {
  driver: any;
  extensions?: string | URL | Array<string | URL>;
}

interface TursoConfig extends DatabaseConfig {
  db: any;
}

interface FileSystem {
  readFile: (path: string, encoding: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  readdir: (path: string) => Promise<string[]>;
  join: (...paths: string[]) => string;
  readSql: (path: string) => Promise<string>;
}

declare const intPk1: unique symbol;
declare const intPk2: unique symbol;

type PkNumber = typeof intPk1 | typeof intPk2;

declare const intComp1: unique symbol;
declare const intComp2: unique symbol;

type ComputedNumber = typeof intComp1 | typeof intComp2;

declare const stringPk1: unique symbol;
declare const stringPk2: unique symbol;

type PkString = typeof stringPk1 | typeof stringPk2;

declare const stringComp1: unique symbol;
declare const stringComp2: unique symbol;

type ComputedString = typeof stringComp1 | typeof stringComp2;

declare const bufferPk1: unique symbol;
declare const bufferPk2: unique symbol;

type PkBuffer = typeof bufferPk1 | typeof bufferPk2;

declare const bufferComp1: unique symbol;
declare const bufferComp2: unique symbol;

type ComputedBuffer = typeof bufferComp1 | typeof bufferComp2;

declare const datePk1: unique symbol;
declare const datePk2: unique symbol;

type PkDate = typeof datePk1 | typeof datePk2;

declare const dateComp1: unique symbol;
declare const dateComp2: unique symbol;

type ComputedDate = typeof dateComp1 | typeof dateComp2;

declare const boolComp1: unique symbol;
declare const boolComp2: unique symbol;

type ComputedBoolean = typeof boolComp1 | typeof boolComp2;

declare const jsonComp1: unique symbol;
declare const jsonComp2: unique symbol;

type ComputedJson = typeof jsonComp1 | typeof jsonComp2;

declare const nullComp1: unique symbol;
declare const nullComp2: unique symbol;

type ComputedNull = typeof nullComp1 | typeof nullComp2;

declare const dbNumber1: unique symbol;
declare const dbNumber2: unique symbol;

type DbNumber = typeof dbNumber1 | typeof dbNumber2;

declare const dbString1: unique symbol;
declare const dbString2: unique symbol;

type DbString = typeof dbString1 | typeof dbString2;

declare const dbBoolean1: unique symbol;
declare const dbBoolean2: unique symbol;

type DbBoolean = typeof dbBoolean1 | typeof dbBoolean2;

declare const dbDate1: unique symbol;
declare const dbDate2: unique symbol;

type DbDate = typeof dbDate1 | typeof dbDate2;

declare const dbJson1: unique symbol;
declare const dbJson2: unique symbol;

type DbJson = typeof dbJson1 | typeof dbJson2;

declare const dbBuffer1: unique symbol;
declare const dbBuffer2: unique symbol;

type DbBuffer = typeof dbBuffer1 | typeof dbBuffer2;

declare const dbNull1: unique symbol;
declare const dbNull2: unique symbol;

type DbNull = typeof dbNull1 | typeof dbNull2;

type DbAny = ComputedBoolean | ComputedBuffer | ComputedDate | ComputedJson | ComputedNumber | ComputedString | PkNumber | PkDate | PkString | PkBuffer | DbNumber | DbString | DbBuffer | DbJson | DbDate | DbBoolean;
type AnyParam = DbAny | DbNull | ComputedNull;

type AllowedJson = ComputedBoolean | ComputedDate | ComputedJson | ComputedNumber | ComputedString | PkNumber | PkDate | PkString | DbNumber | DbString | DbJson | DbDate | DbBoolean | DbNull | { [key: string]: AllowedJson } | AllowedJson[];
type SelectType = AllowedJson | AllowedJson[] | SelectType[] | { [key: string | symbol]: AllowedJson };

type OnlyNumbers = number | DbNumber | PkNumber | ComputedNumber;
type NumberParam = number | null | ComputedNumber | PkNumber | DbNumber | DbNull | ComputedNull;
type NumberResult = DbNumber | DbNull;

type OnlyStrings = string | DbString | PkString | ComputedString;
type StringParam = string | null | PkString | ComputedString | DbString | DbNull | ComputedNull;
type StringResult = DbString | DbNull;

type NumberBufferParam = number | Buffer | null | DbNumber | PkNumber | ComputedNumber | PkBuffer | ComputedBuffer | DbBuffer | DbNull | ComputedNull;
type StringBufferParam = string | Buffer | null | DbString | PkString | ComputedString | DbBuffer | DbNull | ComputedNull;

type AnyResult = DbString | DbNumber | DbDate | DbBoolean | DbJson | DbBuffer | DbNull;

type BufferResult = DbBuffer | DbNull;

type OnlyDates = DbDate | PkDate | ComputedDate;
type DateParam = number | string | null | DbNumber | DbString | DbDate | PkNumber | PkString | PkDate | ComputedDate | ComputedNumber | ComputedString | DbNull;
type DateResult = DbDate | DbNull;

type BooleanParam = boolean | DbBoolean | ComputedBoolean;
type BooleanResult = DbBoolean | DbNull;

type JsonParam = string | Buffer | null | DbString | DbBuffer | DbJson | DbNull;
type ExtractResult = DbString | DbNumber | DbBoolean | DbNull;
type JsonResult = DbJson | DbNull;

type DbTypes = number | string | boolean | Date | Buffer | null;

declare const sym1: unique symbol;
type ForeignKeyAction = typeof sym1;

declare const sym2: unique symbol;
declare const sym3: unique symbol;
type DbIndex = typeof sym2 | typeof sym3;

declare const sym4: unique symbol;
declare const sym5: unique symbol;
type DbUnique = typeof sym4 | typeof sym5;

declare const sym6: unique symbol;
declare const sym7: unique symbol;
type DbPrimaryKey = typeof sym6 | typeof sym7;

declare const sym8: unique symbol;
declare const sym9: unique symbol;
type DbCheck = typeof sym8 | typeof sym9;

type GetReturnType<T> =
  PkNumber extends T[keyof T] ? number :
  PkString extends T[keyof T] ? string :
  PkBuffer extends T[keyof T] ? Buffer :
  PkDate extends T[keyof T] ? Date :
  number;

type GetPrimaryKey<T> =
  PkNumber extends T[keyof T] ? DbNumber :
  PkString extends T[keyof T] ? DbString :
  PkBuffer extends T[keyof T] ? DbBuffer :
  PkDate extends T[keyof T] ? DbDate :
  never;

type PkToDbType<T> = 
  T extends PkNumber ? DbNumber :
  T extends PkString ? DbString :
  T extends PkBuffer ? DbBuffer :
  T extends PkDate ? DbDate :
  T;

type ClassFields<T extends new (...args: any[]) => any> = {
  [K in keyof InstanceType<T>]: InstanceType<T>[K];
};

type RemoveUpperCase<T> = {
  [K in keyof T as K extends string
    ? K extends `${infer First}${string}`
      ? First extends Lowercase<First>
        ? K
        : never
      : never
    : never]: T[K];
};

type IsAny<T> = 0 extends (1 & T) ? true : false;

type ExtractColumns<T> = {
  [K in keyof T as K extends string
    ? K extends `${infer First}${string}`
      ? First extends Lowercase<First>
        ? K
        : never
      : never
    : never]: IsAny<ToDbType<T[K]>> extends true
      ? DbString
      : ToDbType<T[K]>;
};

type PkType = PkNumber | PkString | PkDate | PkBuffer;

type ToInsert<T> = {
  [K in keyof T as T[K] extends PkType | DbTypes
    ? K
    : DbNull extends T[K]
      ? K
      : never]?: Exclude<T[K], DbNull>;
} & {
  [K in keyof T as T[K] extends PkType
    ? never
    : DbNull extends T[K]
      ? never
      : K]: T[K];
};

type ExcludeComputed<T> = {
  [K in keyof T as T[K] extends AnyResult | PkType ? K : never]: T[K]
};

type ToQuery<Y, T> = Queries<ToJsType<T>, ToWhere<ToJsType<T>>, Y> & WriteQueries<ToJsType<T>, ToJsType<ToInsert<ExcludeComputed<T>>>, ToWhere<ToJsType<T>>, GetReturnType<T>>;

type ToFTS<Y, T> = VirtualQueries<ToJsType<T>, ToWhere<ToJsType<T>>> & ToQuery<Y, T>;

type ToExternalFTS<Y, T> = VirtualQueries<ToJsType<T>, ToWhere<ToJsType<T>>> & Queries<ToJsType<T>, ToWhere<ToJsType<T>>, Y>;

type MakeClient<T extends { [key: string]: abstract new (...args: any) => any }> = {
  [K in keyof T as K extends string
    ? `${Uncapitalize<K>}`
    : never]: K extends string ? (
      InstanceType<T[K]> extends FTSTable 
        ? ToFTS<MakeClient<T>, ExtractColumns<InstanceType<T[K]>> & { [P in Uncapitalize<K>]: DbString }>
        : InstanceType<T[K]> extends ExternalFTSTable 
          ? ToExternalFTS<MakeClient<T>, ExtractColumns<InstanceType<T[K]>> & { [P in Uncapitalize<K>]: DbString }>
      : ToQuery<MakeClient<T>, ExtractColumns<InstanceType<T[K]>>>) : never;
};

type MakeContext<T extends Record<string, abstract new (...args: any) => any>> = {
  [K in keyof T as Uncapitalize<K & string>]:
    InstanceType<T[K]> extends FTSTable
      ? ExtractColumns<InstanceType<T[K]>> & { [P in Uncapitalize<K & string>]: DbString }
      : ExtractColumns<InstanceType<T[K]>>
};

type Unwrap<T extends any[]> = {
  [K in keyof T]: T[K] extends Promise<infer U> ? U : T[K];
}

type QueryCompareTypes = Date | number | boolean | null | string | Buffer | symbol;

type SubqueryContext = 
  CompareMethods<QueryCompareTypes> &
  SymbolCompareMethods<QueryCompareTypes> &
  ComputeMethods &
  SymbolMethods &
  { use<T>(context: T): T }

type MakeOptional<T> = {
  [K in keyof T]: T[K] extends Array<infer U>
    ? Array<U | DbNull>
    : T[K] | DbNull;
};

type SymbolWhere = {
  [key: symbol]: any;
  and?: [{
    [key: symbol]: any;
    and?: [{ 
      [key: symbol]: any 
    }];
    or?: [{ 
      [key: symbol]: any 
    }];
  }];
  or?: [{
    [key: symbol]: any;
    and?: [{ 
      [key: symbol]: any 
    }];
    or?: [{ 
      [key: symbol]: any 
    }];
  }];
}

interface QueryReturn {
  where?: SymbolWhere;
  join?: [symbol, symbol] | [symbol, symbol, 'left' | 'right' | 'union'] | ([symbol, symbol] | [symbol, symbol, 'left' | 'right' | 'union'])[];
  groupBy?: symbol | symbol[];
  having?: SymbolWhere;
  orderBy?: symbol | symbol[];
  desc?: boolean | DbBoolean | ComputedBoolean;
  offset?: number | ComputedNumber | DbNumber | PkNumber;
  limit?: number | ComputedNumber | DbNumber | PkNumber;
  bm25?: { [key: symbol]: number | ComputedNumber | DbNumber | PkNumber };
  rank?: boolean | DbBoolean | ComputedBoolean;
}

interface ObjectReturn<S> extends QueryReturn {
  select?: { [key: string | symbol]: S };
  distinct?: { [key: string | symbol]: S };
  optional?: { [key: string | symbol]: S };
}

interface ValueReturn<S> extends QueryReturn {
  select?: S;
  distinct?: S;
  optional?: S;
}

type GetDefined<T> =
  (T extends { select: infer V }
    ? ToJsType<V> : never) |
  (T extends { distinct: infer V }
    ? ToJsType<V> : never) |
  (T extends { optional: infer V }
    ? V extends ToDbInterface<infer _>
      ? ToJsType<MakeOptional<NonNullable<V>>>
      : ToJsType<V> | null
    : never);

interface TypedDb<P, C> {
  exec(sql: string): Promise<void>;
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  pragma(sql: string): Promise<any[]>;
  deferForeignKeys(): Promise<void>;
  migrate(sql: string): Promise<void>;
  getSchema(): any[];
  diff(schema?: any[]): string;
  getTransaction(type?: 'read' | 'write' | 'deferred'): Promise<TypedDb<P, C> & P>;
  batch<T extends any[]>(batcher: (bx: TypedDb<P, C> & P) => T): Promise<Unwrap<T>>;
  batch<T extends any[]> (type: 'read' | 'write', batcher: (bx: TypedDb<P, C> & P) => T): Promise<Unwrap<T>>;
  sync(): Promise<void>;
  first<S extends SelectType, K extends ObjectReturn<S>, T extends (context: SubqueryContext & C) => K>(expression: T): Promise<ToJsType<ReturnType<T>['select'] & ReturnType<T>['distinct'] & MakeOptional<NonNullable<ReturnType<T>['optional']>>> | undefined>;
  firstValue<S extends SelectType, K extends ValueReturn<S>, T extends (context: SubqueryContext & C) => K>(expression: T): Promise<GetDefined<ReturnType<T>> | undefined>;
  query<S extends SelectType, K extends ObjectReturn<S>, T extends (context: SubqueryContext & C) => K>(expression: T): Promise<ToJsType<ReturnType<T>['select'] & ReturnType<T>['distinct'] & MakeOptional<NonNullable<ReturnType<T>['optional']>>>[]>;
  queryValues<S extends SelectType, K extends ValueReturn<S>, T extends (context: SubqueryContext & C) => K>(expression: T): Promise<GetDefined<ReturnType<T>>[]>;
  subquery<S extends SelectType, K extends ObjectReturn<S>, T extends (context: SubqueryContext & C) => K>(expression: T): ReturnType<T>['select'] & ReturnType<T>['distinct'] & MakeOptional<NonNullable<ReturnType<T>['optional']>>;
  use<S>(query: S): ReadQueries<P, S>;
}

type ToComputed<T> =
  T extends DbString ? ComputedString :
  T extends DbBoolean ? ComputedBoolean :
  T extends DbDate ? ComputedDate :
  T extends DbNull ? ComputedNull :
  T extends DbJson ? ComputedJson :
  T extends DbNumber ? ComputedNumber :
  T extends boolean ? ComputedBoolean :
  T extends number ? ComputedNumber :
  T extends Date ? ComputedDate :
  T extends string ? ComputedString :
  T extends Buffer ? ComputedBuffer :
  T extends null ? ComputedNull :
  T;

type ForeignActions = 'no action' | 'restrict' | 'set null' | 'set default' | 'cascade';

export class BaseTable {
  Int: DbNumber;
  IntPrimary: PkNumber;
  Real: DbNumber;
  RealPrimary: PkNumber;
  Text: DbString;
  TextPrimary: PkString;
  Blob: DbBuffer;
  BlobPrimary: PkBuffer;
  Json: DbJson;
  Date: DbDate;
  DatePrimary: PkDate;
  Bool: DbBoolean;

  Now: Date;

  References<T extends abstract new (...args: any[]) => any>(table: T, options?: {
    onDelete?: ForeignActions,
    onUpdate?: ForeignActions,
    index?: false
  }): GetPrimaryKey<InstanceType<T>>;
  References<T extends abstract new (...args: any[]) => any, N extends false>(table: T, options?: {
    onDelete?: ForeignActions,
    onUpdate?: ForeignActions,
    notNull: N,
    index?: false
  }): GetPrimaryKey<InstanceType<T>> | DbNull;
  References<T extends abstract new (...args: any[]) => any, K extends keyof RemoveUpperCase<InstanceType<T>>>(table: T, options?: {
    column: K,
    onDelete?: ForeignActions,
    onUpdate?: ForeignActions,
    index?: false
  }): PkToDbType<InstanceType<T>[K]>;
  References<T extends abstract new (...args: any[]) => any, K extends keyof RemoveUpperCase<InstanceType<T>>, N extends false>(table: T, options?: {
    column: K,
    onDelete?: ForeignActions,
    onUpdate?: ForeignActions,
    notNull: N,
    index?: false
  }): PkToDbType<InstanceType<T>[K]> | DbNull;
  Cascade<T extends abstract new (...args: any[]) => any>(table: T, options?: {
    index?: false
  }): GetPrimaryKey<InstanceType<T>>;
  Cascade<T extends abstract new (...args: any[]) => any, N extends false>(table: T, options?: {
    notNull: N,
    index?: false
  }): GetPrimaryKey<InstanceType<T>> | DbNull;
  Cascade<T extends abstract new (...args: any[]) => any, K extends keyof RemoveUpperCase<InstanceType<T>>>(table: T, options?: {
    column: K,
    index?: false
  }): PkToDbType<InstanceType<T>[K]>;
  Cascade<T extends abstract new (...args: any[]) => any, K extends keyof RemoveUpperCase<InstanceType<T>>, N extends false>(table: T, options?: {
    column: K,
    notNull: N,
    index?: false
  }): PkToDbType<InstanceType<T>[K]> | DbNull;

  Index<T>(type: T): ToDbType<T>;
  Index<T>(type: T, expression: (column: T) => { [key: symbol]: any }): ToDbType<T>;
  Index(...args: [any, ...any[]]): void;
  Index(...args: [any, ...any[], { [key: symbol]: any }]): void;
  Unique<T>(type: T): ToDbType<T>;
  Unique<T>(type: T, expression: (column: T) => { [key: symbol]: any }): ToDbType<T>;
  Unique(...args: [any, ...any[]]): void;
  Unique(...args: [any, ...any[], { [key: symbol]: any }]): void;
  Check<T>(type: T, ...checks: any): ToDbType<T>;
  Null<T>(type: T): ToDbType<T> | DbNull;
  Default<T extends Primitive>(value: T): ToDbType<T>;

  Abs(n: OnlyNumbers): ToComputed<DbNumber>;
  Abs(n: NumberParam): ToComputed<NumberResult>;
  Cast(value: any, to: 'real'): ToComputed<DbNumber>;
  Cast(value: any, to: 'integer'): ToComputed<DbNumber>;
  Coalesce(a: StringResult, b: string): ToComputed<DbString>;
  Coalesce(a: NumberResult, b: number): ToComputed<DbNumber>;
  Coalesce(a: BooleanResult, b: boolean): ToComputed<DbBoolean>;
  Coalesce(a: DateResult, b: Date): ToComputed<DbDate>;
  Coalesce<T extends DbAny>(a: T, b: T, ...rest: T[]): ToComputed<T>;
  Coalesce(a: any, b: any, ...rest: any[]): ToComputed<AnyResult>;
  Concat(...args: any[]): ToComputed<DbString>;
  ConcatWs(...args: any[]): ToComputed<DbString>;
  Format(format: OnlyStrings, ...args: any[]): ToComputed<DbString>;
  Format(format: StringParam, ...args: any[]): ToComputed<StringResult>;
  If<T extends DbTypes | DbAny>(...args: IfOddArgs<T>): ToComputed<ToDbType<T>>;
  If<T extends DbTypes | DbAny>(...args: IfEvenArgs<T>): ToComputed<ToDbType<T | null>>;
  If(...args: any[]): ToComputed<AnyResult>;
  Instr(a: OnlyStrings, b: OnlyStrings): ToComputed<DbNumber>;
  Instr(a: StringBufferParam, b: StringBufferParam): ToComputed<NumberResult>;
  Length(value: any): ToComputed<NumberResult>;
  Lower(value: OnlyStrings): ToComputed<DbString>;
  Lower(value: StringParam): ToComputed<StringResult>;
  Ltrim(value: StringParam, remove?: StringParam): ToComputed<StringResult>;
  Max(a: DbNumber, b: number): ToComputed<DbNumber>;
  Max<T extends DbAny>(a: T, b: T, ...rest: T[]): ToComputed<T>;
  Max(a: any, b: any, ...rest: any[]): ToComputed<AnyResult>;
  Min(a: DbNumber, b: number): ToComputed<DbNumber>;
  Min<T extends DbAny>(a: T, b: T, ...rest: T[]): ToComputed<T>;
  Min(a: any, b: any, ...rest: any[]): ToComputed<AnyResult>;
  Nullif<T extends DbAny>(a: T, b: any): ToComputed<T | DbNull>;
  Nullif(a: any, b: any): ToComputed<AnyResult>;
  OctetLength(value: any): ToComputed<NumberResult>;
  Replace(value: OnlyStrings, occurances: OnlyStrings, substitute: OnlyStrings): ToComputed<DbString>;
  Replace(value: StringParam, occurances: StringParam, substitute: StringParam): ToComputed<StringResult>;
  Round(value: OnlyNumbers, places?: NumberParam): ToComputed<DbNumber>;
  Round(value: NumberParam, places?: NumberParam): ToComputed<NumberResult>;
  Rtrim<T extends StringParam>(value: T, remove?: StringParam): ToComputed<T>;
  Sign(value: OnlyNumbers): ToComputed<-1 | 0 | 1>;
  Sign(value: any): ToComputed<NumberResult>;
  Substring<T extends StringParam>(value: T, start: NumberParam, length?: NumberParam): ToComputed<T>;
  Trim<T extends StringParam>(value: T, remove?: StringParam): ToComputed<T>;
  Unhex(hex: StringParam, ignore?: StringParam): ToComputed<BufferResult>;
  Unicode(value: OnlyStrings): ToComputed<DbNumber>;
  Unicode(value: StringParam): ToComputed<NumberResult>;
  Upper(value: OnlyStrings): ToComputed<DbString>;
  Upper(value: StringParam): ToComputed<StringResult>;
  ToDate(): ToComputed<DbString>;
  ToDate(time: OnlyDates): ToComputed<DbString>;
  ToDate(time: DateParam, ...modifers: StringParam[]): ToComputed<StringResult>;
  Time(): ToComputed<DbString>;
  Time(time: OnlyDates): ToComputed<DbString>;
  Time(time: DateParam, ...modifers: StringParam[]): ToComputed<StringResult>;
  DateTime(): ToComputed<DbString>;
  DateTime(time: OnlyDates): ToComputed<DbString>;
  DateTime(time: DateParam, ...modifers: StringParam[]): ToComputed<StringResult>;
  JulianDay(): ToComputed<DbNumber>;
  JulianDay(time: OnlyDates): ToComputed<DbNumber>;
  JulianDay(time: DateParam, ...modifers: StringParam[]): ToComputed<NumberResult>;
  UnixEpoch(): ToComputed<DbNumber>;
  UnixEpoch(time: OnlyDates): ToComputed<DbNumber>;
  UnixEpoch(time: DateParam, ...modifers: StringParam[]): ToComputed<StringResult>;
  StrfTime(format: StringParam, time: DateParam, ...modifers: StringParam[]): ToComputed<StringResult>;
  TimeDiff(start: OnlyDates, end: OnlyDates): ToComputed<DbString>;
  TimeDiff(start: DateParam, end: DateParam): ToComputed<StringResult>;
  Acos(value: NumberParam): ToComputed<NumberResult>;
  Acosh(value: NumberParam): ToComputed<NumberResult>;
  Asin(value: NumberParam): ToComputed<NumberResult>;
  Asinh(value: NumberParam): ToComputed<NumberResult>;
  Atan(value: NumberParam): ToComputed<NumberResult>;
  Atan2(b: NumberParam, a: NumberParam): ToComputed<NumberResult>;
  Atanh(value: NumberParam): ToComputed<NumberResult>;
  Ceil(value: OnlyNumbers): ToComputed<DbNumber>;
  Ceil(value: NumberParam): ToComputed<NumberResult>;
  Cos(value: OnlyNumbers): ToComputed<DbNumber>;
  Cos(value: NumberParam): ToComputed<NumberResult>;
  Cosh(value: NumberParam): ToComputed<NumberResult>;
  Degrees(value: NumberParam): ToComputed<NumberResult>;
  Exp(value: NumberParam): ToComputed<NumberResult>;
  Floor(value: OnlyNumbers): ToComputed<DbNumber>;
  Floor(value: NumberParam): ToComputed<NumberResult>;
  Ln(value: NumberParam): ToComputed<NumberResult>;
  Log(base: NumberParam, value: NumberParam): ToComputed<NumberResult>;
  Mod(value: NumberParam, divider: NumberParam): ToComputed<NumberResult>;
  Pi(): ToComputed<DbNumber>;
  Power(value: NumberParam, exponent: NumberParam): ToComputed<NumberResult>;
  Radians(value: NumberParam): ToComputed<NumberResult>;
  Sin(value: OnlyNumbers): ToComputed<DbNumber>;
  Sin(value: NumberParam): ToComputed<NumberResult>;
  Sinh(value: NumberParam): ToComputed<NumberResult>;
  Sqrt(value: NumberParam): ToComputed<NumberResult>;
  Tan(value: NumberParam): ToComputed<NumberResult>;
  Tanh(value: NumberParam): ToComputed<NumberResult>;
  Trunc(value: OnlyNumbers): ToComputed<DbNumber>;
  Trunc(value: NumberParam): ToComputed<NumberResult>;
  ToJson(param: JsonParam | any[]): ToComputed<StringResult>;
  Extract(json: JsonParam | any[], path: StringParam): ToComputed<ExtractResult>;
  Object<T extends { [key: string]: AllowedJson }>(select: T): ToComputed<ToJson<T>>;
  ArrayLength(param: JsonParam | any[]): ToComputed<NumberResult>;

  Plus(...args: OnlyNumbers[]): ToComputed<DbNumber>;
  Plus(...args: NumberParam[]): ToComputed<NumberResult>;
  Minus(...args: OnlyNumbers[]): ToComputed<DbNumber>;
  Minus(...args: NumberParam[]): ToComputed<NumberResult>;
  Divide(...args: OnlyNumbers[]): ToComputed<DbNumber>;
  Divide(...args: NumberParam[]): ToComputed<NumberResult>;
  Multiply(...args: OnlyNumbers[]): ToComputed<DbNumber>;
  Multiply(...args: NumberParam[]): ToComputed<NumberResult>;

  Not(value: symbol | QueryCompareTypes | QueryCompareTypes[]): ToComputed<DbBoolean>;
  Not(column: symbol, value: QueryCompareTypes | QueryCompareTypes[]): ToComputed<DbBoolean>;
  Gt(value: symbol | QueryCompareTypes): ToComputed<DbBoolean>;
	Gt(column: symbol, value: QueryCompareTypes): ToComputed<DbBoolean>;
  Lt(value: symbol | QueryCompareTypes): ToComputed<DbBoolean>;
	Lt(column: symbol, value: QueryCompareTypes): ToComputed<DbBoolean>;
  Lte(value: symbol | QueryCompareTypes): ToComputed<DbBoolean>;
	Lte(column: symbol, value: QueryCompareTypes): ToComputed<DbBoolean>;
  Like(pattern: DbString | ComputedString | string): ToComputed<DbBoolean>;
	Like(column: symbol, pattern: QueryCompareTypes): ToComputed<DbBoolean>;
  Match(pattern: DbString | ComputedString | string): ToComputed<DbBoolean>;
	Match(column: symbol, pattern: QueryCompareTypes): ToComputed<DbBoolean>;
  Glob(pattern: DbString | ComputedString | string): ToComputed<DbBoolean>;
	Glob(column: symbol, pattern: QueryCompareTypes): ToComputed<DbBoolean>;
  Eq(value: symbol | QueryCompareTypes): ToComputed<DbBoolean>;
	Eq(column: symbol, value: QueryCompareTypes): ToComputed<DbBoolean>;
}

export class Table extends BaseTable {
  id: PkNumber;
}

interface Unicode61Config {
  removeDiacritics?: boolean;
  categories?: string[];
  tokenChars?: string;
  separators?: string;
  porter?: boolean;
}

export class Unicode61 {
  constructor(options: Unicode61Config);
}

interface AsciiConfig {
  categories?: string[];
  tokenChars?: string;
  separators?: string;
  porter?: boolean;
}

export class Ascii {
  constructor(options: AsciiConfig);
}

interface TrigramConfig {
  caseSensitive?: boolean;
  removeDiacritics?: boolean;
  porter?: boolean;
}

export class Trigram {
  constructor(options: TrigramConfig);
}

export class FTSTable extends BaseTable {
  rowid: PkNumber;
  Prefix?: number | number[];
  Tokenizer?: Unicode61 | Ascii | Trigram;
  Unindex(): DbString;
}

export class ExternalFTSTable extends FTSTable {
  ExternalRowId?: PkNumber | DbNumber;
}

export class Database {
  constructor();
  getClient<T extends abstract new (...args: any[]) => any, C extends { [key: string]: T }>(classes: C): TypedDb<MakeClient<C>, MakeContext<C>> & MakeClient<C>;
  run(args: { query: any, params?: any }): Promise<number>;
  all<T>(args: { query: any, params?: any, options?: QueryOptions }): Promise<Array<T>>;
  exec(query: string): Promise<void>;
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export class SQLiteDatabase extends Database {
  constructor(path?: string | URL, options?: SQLiteConfig);
  initialize(): Promise<void>;
  close(): Promise<void>;
  created: boolean;
}

export class TursoDatabase extends Database {
  constructor(options: TursoConfig);
  batch(handler: (batcher: any) => any[], type: 'read' | 'write'): Promise<any[]>;
}
