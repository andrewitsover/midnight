import { PathLike } from 'node:fs';
import { FunctionOptions, Session, ApplyChangesetOptions } from 'node:sqlite';

type ExtractKeys<U> = U extends Record<string, any> ? keyof U : keyof {};

interface Keywords<T, K> {
  orderBy?: K | ((column: T) => symbol);
  desc?: boolean;
  limit?: number | bigint;
  offset?: number | bigint;
  distinct?: boolean;
  log?: boolean | ((info: LogInfo) => void);
}

type ReadQueries<P, T> = Pick<ToQuery<P, T>, 'get' | 'many' | 'query' | 'first' | 'count' | 'avg' | 'sum' | 'min' | 'max' | 'exists'>;

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
  log?: boolean | ((info: LogInfo) => void);
}

interface ComplexQuery<W, T> extends Keywords<T, Array<keyof T> | keyof T> {
  where?: W;
}

interface ComplexQueryObject<W, K, T> extends Keywords<T, keyof T | Array<keyof T>> {
  where?: W;
  select: (keyof T)[] | K[];
}

interface ComplexQueryObjectOmit<W, K, T> extends Keywords<T, keyof T | Array<keyof T>> {
  where?: W;
  omit: (keyof T)[] | K[] | K;
}

interface ComplexQueryValue<W, K, T> extends Keywords<T, Array<keyof T> | keyof T> {
  where?: W;
  return: K;
}

type MakeOptionalNullable<T> = {
  [K in keyof T]: undefined extends T[K] ? T[K] | null : T[K];
};

type AddComputed<T> = {
  [K in keyof T]: T[K] | ((column: T, methods: ComputeMethods & UpdateCompareMethods) => void);
};

interface UpdateQuery<W, T> {
  where?: W | null;
  set: Partial<AddComputed<MakeOptionalNullable<T>>>;
  log?: boolean | ((info: LogInfo) => void);
}

interface UpsertQuery<T, K> {
  values: T;
  target?: K;
  set?: Partial<MakeOptionalNullable<T>>;
  log?: boolean | ((info: LogInfo) => void);
}

interface GroupQueryKeywords<W, K> {
  where?: W;
  orderBy?: K;
  desc?: boolean;
  limit?: number | bigint;
  offset?: number | bigint;
  log?: boolean | ((info: LogInfo) => void);
}

interface GroupQueryCountStarColumn<A extends string, T, W, K> extends GroupQueryKeywords<W, K> {
  column: {
    [key in A]: true | keyof T;
  }
}

interface GroupQueryCountStarDistinct<A extends string, T, W, K> extends GroupQueryKeywords<W, K> {
  distinct: {
    [key in A]: true | keyof T;
  }
}

interface GroupQueryAggregateColumn<A extends string, T, W, K> extends GroupQueryKeywords<W, K> {
  column: {
    [key in A]: keyof T;
  }
}

interface GroupQueryAggregateDistinct<A extends string, T, W, K> extends GroupQueryKeywords<W, K> {
  distinct: {
    [key in A]: keyof T;
  }
}

interface GroupQueryObjectAlias<T, W, K> {
  where?: W;
  column?: keyof T;
  distinct?: keyof T;
  orderBy?: K;
  desc?: boolean;
  limit?: number | bigint;
  offset?: number | bigint;
}

interface GroupArrayKeywords<W, K> {
  where?: W;
  orderBy?: K;
  desc?: boolean;
  limit?: number | bigint;
  offset?: number | bigint;
}

interface GroupArray<A extends string, W, K> extends GroupArrayKeywords<W, K> {
  select: {
    [key in A]: true;
  }
}

interface GroupArraySelect<A extends string, W, K, S> extends GroupArrayKeywords<W, K> {
  select: {
    [key in A]: S[];
  }
}

interface GroupArrayValue<A extends string, W, K, S> extends GroupArrayKeywords<W, K> {
  select: {
    [key in A]: S;
  }
}

type DateToString<T> = T extends AnyTemporal
  ? string
  : T extends object
    ? { [K in keyof T]: T[K] extends AnyTemporal ? string : T[K] }
    : T;

interface AggregateMethods<T, W, K extends keyof T, Y> {
  count<A extends string>(params?: GroupQueryCountStarColumn<A, T, W & ToWhere<{ count: number }>, K | 'count'>): Array<Pick<T, K> & { [key in A]: number }>;
  count<A extends string>(params?: GroupQueryCountStarDistinct<A, T, W & ToWhere<{ count: number }>, K | 'count'>): Array<Pick<T, K> & { [key in A]: number }>;
  avg<A extends string>(params: GroupQueryAggregateColumn<A, T, W & ToWhere<{ avg: number }>, K | 'avg'>): Array<Pick<T, K> & { [key in A]: number }>;
  avg<A extends string>(params: GroupQueryAggregateDistinct<A, T, W & ToWhere<{ avg: number }>, K | 'avg'>): Array<Pick<T, K> & { [key in A]: number }>;
  max<A extends string>(params: GroupQueryAggregateColumn<A, T, W & ToWhere<{ max: number }>, K | 'max'>): Array<Pick<T, K> & { [key in A]: number }>;
  max<A extends string>(params: GroupQueryAggregateDistinct<A, T, W & ToWhere<{ max: number }>, K | 'max'>): Array<Pick<T, K> & { [key in A]: number }>;
  min<A extends string>(params: GroupQueryAggregateColumn<A, T, W & ToWhere<{ min: number }>, K | 'min'>): Array<Pick<T, K> & { [key in A]: number }>;
  min<A extends string>(params: GroupQueryAggregateDistinct<A, T, W & ToWhere<{ min: number }>, K | 'min'>): Array<Pick<T, K> & { [key in A]: number }>;
  sum<A extends string>(params: GroupQueryAggregateColumn<A, T, W & ToWhere<{ sum: number }>, K | 'sum'>): Array<Pick<T, K> & { [key in A]: number }>;
  sum<A extends string>(params: GroupQueryAggregateDistinct<A, T, W & ToWhere<{ sum: number }>, K | 'sum'>): Array<Pick<T, K> & { [key in A]: number }>;
  array<A extends string, S extends keyof T>(params: GroupArrayValue<A, W, K, S>): Array<Pick<T, K> & { [key in A]: Array<DateToString<T[S]>> }>;
  array<A extends string>(params: GroupArray<A, W, K>): Array<Pick<T, K> & { [key in A]: Array<DateToString<T>> }>;
  array<A extends string, S extends keyof T>(params: GroupArraySelect<A, W, K, S>): Array<Pick<T, K> & { [key in A]: Array<DateToString<Pick<T, S>>> }>;
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
  abs<T extends NumericParam>(n: T): ToDbType<T>;
  cast(value: any, to: 'real' | 'integer'): DbNumber;
  coalesce<T extends DbAny | DbTypes | DbNull>(a: T, b: T, ...rest: T[]): ToDbType<T>;
  concat(...args: any[]): DbString;
  concatWs(...args: any[]): DbString;
  format<T extends StringParam>(format: T, ...args: any[]): ToDbType<T>;
  iif<T extends DbTypes | DbAny>(...args: IfOddArgs<T>): ToDbType<T>;
  iif<T extends DbTypes | DbAny>(...args: IfEvenArgs<T>): ToDbType<T | null>;
  iif(...args: any[]): AnyResult;
  instr(a: OnlyStrings, b: OnlyStrings): DbNumber;
  instr(a: StringBlobParam, b: StringBlobParam): NumberResult;
  length(value: any): NumberResult;
  lower<T extends StringParam>(value: T): ToDbType<T>;
  ltrim(value: StringParam, remove?: StringParam): StringResult;
  max<T>(a: T, b: T, ...rest: T[]): ToDbType<T>;
  min<T>(a: T, b: T, ...rest: T[]): ToDbType<T>;
  nullif<T>(a: T, b: any): ToDbType<T> | DbNull;
  octetLength(value: any): NumberResult;
  replace<T extends StringParam>(value: T, occurrences: T, substitute: T): ToDbType<T>;
  round<T extends Numeric>(value: T, places?: NumericParam): ToDbType<T>;
  rtrim<T extends StringParam>(value: T, remove?: StringParam): T;
  sign(value: Numeric): -1 | 0 | 1;
  substring<T extends StringParam>(value: T, start: NumericParam, length?: NumericParam): T;
  trim<T extends StringParam>(value: T, remove?: StringParam): T;
  unhex(hex: StringParam, ignore?: StringParam): BlobResult;
  unicode(value: OnlyStrings): DbNumber;
  unicode(value: StringParam): NumberResult;
  upper<T extends StringParam>(value: T): ToDbType<T>;
  date(): DbString;
  date(time: AnyDateType): DbString;
  date(time: DateParam, ...modifiers: StringParam[]): StringResult;
  time(): DbString;
  time(time: AnyDateType): DbString;
  time(time: DateParam, ...modifiers: StringParam[]): StringResult;
  dateTime(): DbString;
  dateTime(time: CompatibleDate): DbString;
  dateTime(time: DateParam, ...modifiers: StringParam[]): StringResult;
  julianDay(): DbNumber;
  julianDay(time: CompatibleDate): DbNumber;
  julianDay(time: DateParam, ...modifiers: StringParam[]): NumberResult;
  unixEpoch(): DbNumber;
  unixEpoch(time: CompatibleDate): DbNumber;
  unixEpoch(time: DateParam, ...modifiers: StringParam[]): NumberResult;
  strfTime(format: StringParam, time: DateParam, ...modifiers: StringParam[]): StringResult;
  timeDiff(start: CompatibleDate, end: CompatibleDate): DbString;
  timeDiff(start: DateParam, end: DateParam): StringResult;
  acos(value: NumericParam): NumberResult;
  acosh(value: NumericParam): NumberResult;
  asin(value: NumericParam): NumberResult;
  asinh(value: NumericParam): NumberResult;
  atan(value: NumericParam): NumberResult;
  atan2(b: NumericParam, a: NumericParam): NumberResult;
  atanh(value: NumericParam): NumberResult;
  ceil<T extends NumericParam>(value: T): ToDbType<T>;
  cos<T extends NumericParam>(value: T): ToDbType<T>;
  cosh(value: NumericParam): NumberResult;
  degrees(value: NumericParam): NumberResult;
  exp(value: NumericParam): NumberResult;
  floor<T extends NumericParam>(value: T): ToDbType<T>;
  ln(value: NumericParam): NumberResult;
  log(base: NumericParam, value: NumericParam): NumberResult;
  mod(value: NumericParam, divider: NumericParam): NumberResult;
  pi(): DbNumber;
  power(value: NumericParam, exponent: NumericParam): NumberResult;
  radians(value: NumericParam): NumberResult;
  sin(value: Numeric): DbNumber;
  sin(value: NumericParam): NumberResult;
  sinh(value: NumericParam): NumberResult;
  sqrt(value: NumericParam): NumberResult;
  tan(value: NumericParam): NumberResult;
  tanh(value: NumericParam): NumberResult;
  trunc<T extends NumericParam>(value: T): ToDbType<T>;
  json(param: JsonParam | any[]): StringResult;
  extract(json: JsonParam | any[], path: string): any;
  extract<T, S extends (json: T) => any>(json: T, extractor: S): ReturnType<S>;
  each<T extends unknown[], S extends (json: T[number]) => EachSelector>(json: T, extractor: S): ReturnType<S>['select'][];
  plus<T extends NumericParam>(...args: T[]): ToDbType<T>;
  minus<T extends NumericParam>(...args: T[]): ToDbType<T>;
  divide<T extends NumericParam>(...args: T[]): ToDbType<T>;
  multiply<T extends NumericParam>(...args: T[]): ToDbType<T>;
  object<T extends { [key: string]: AllowedJson }>(select: T): ToDbType<T>;
  arrayLength(param: JsonParam | any[]): NumberResult;
  highlight(column: DbString, before: string, after: string): DbString;
  symbol<T>(json: T): T extends DbNull ? DbJson | DbNull : DbJson;
}

type JsonPrimitive = DbString | DbNumber | DbBoolean | DbNull | JsonPrimitive[] | { [key: string]: JsonPrimitive };

interface EachSelector {
  select?: JsonPrimitive,
  where?: { [key: JsonPrimitive]: symbol }
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
  T extends AnyDateType | AnyBigIntType ? DbString :
  T extends (infer U)[] ? U extends AnyDateType | AnyBigIntType ? DbString[] : U[] :
  T extends object ? { 
    [K in keyof T]: T[K] extends AnyDateType | AnyBigIntType
      ? DbString : T[K] 
  } : T;

type ToDbType<T> =
  T extends null ? DbNull :
  T extends infer U ? (
    U extends number ? DbNumber :
    U extends bigint ? DbBigInt :
    U extends string ? DbString :
    U extends Temporal.Duration ? DbDuration :
    U extends Temporal.Instant ? DbInstant :
    U extends Temporal.PlainDate ? DbPlainDate :
    U extends Temporal.PlainDateTime ? DbPlainDateTime :
    U extends Temporal.PlainMonthDay ? DbPlainMonthDay :
    U extends Temporal.PlainTime ? DbPlainTime :
    U extends Temporal.PlainYearMonth ? DbPlainYearMonth :
    U extends Temporal.ZonedDateTime ? DbZonedDateTime :
    U extends boolean ? DbBoolean :
    U extends null ? DbNull :
    U extends Json ? DbJson :
    U
  ) : T;

type ToDefaultType<T> =
  T extends null ? DbNull :
  T extends infer U ? (
    U extends number ? DefaultNumber :
    U extends bigint ? DefaultBigInt :
    U extends string ? DefaultString :
    U extends Temporal.Duration ? DefaultDuration :
    U extends Temporal.Instant ? DefaultInstant :
    U extends Temporal.PlainDate ? DefaultPlainDate :
    U extends Temporal.PlainDateTime ? DefaultPlainDateTime :
    U extends Temporal.PlainMonthDay ? DefaultPlainMonthDay :
    U extends Temporal.PlainTime ? DefaultPlainTime :
    U extends Temporal.PlainYearMonth ? DefaultPlainYearMonth :
    U extends Temporal.ZonedDateTime ? DefaultZonedDateTime :
    U extends boolean ? DefaultBoolean :
    U extends null ? DbNull :
    U extends Json ? DefaultJson :
    U
  ) : T;

type ToDbInterface<T> = {
  [K in keyof T]: ToDbType<T[K]>;
};

type ToJsType<T> =
  T extends AnyNullType ? null :
  T extends (infer U)[] ? ToJsType<U>[] :
  T extends new (...args: any[]) => Table ? GetReturnType<T> :
  T extends () => infer U ? ToJsType<U> : 
  T extends AnyNumberType ? number :
  T extends AnyBigIntType ? bigint :
  T extends AnyStringType ? string :
  T extends AnyDurationType ? Temporal.Duration :
  T extends AnyInstantType ? Temporal.Instant :
  T extends AnyPlainDateType ? Temporal.PlainDate :
  T extends AnyPlainDateTimeType ? Temporal.PlainDateTime :
  T extends AnyPlainMonthDayType ? Temporal.PlainMonthDay :
  T extends AnyPlainTimeType ? Temporal.PlainTime :
  T extends AnyPlainYearMonthType ? Temporal.PlainYearMonth :
  T extends AnyZonedDateTimeType ? Temporal.ZonedDateTime :
  T extends AnyBooleanType ? boolean :
  T extends AnyJsonType ? Json :
  T extends AnyBlobType ? Uint8Array :
  T extends string ? string :
  T extends number ? number :
  T extends bigint ? bigint :
  T extends boolean ? boolean :
  T extends Temporal.Duration ? Temporal.Duration :
  T extends Temporal.Instant ? Temporal.Instant :
  T extends Temporal.PlainDate ? Temporal.PlainDate :
  T extends Temporal.PlainDateTime ? Temporal.PlainDateTime :
  T extends Temporal.PlainMonthDay ? Temporal.PlainMonthDay :
  T extends Temporal.PlainTime ? Temporal.PlainTime :
  T extends Temporal.PlainYearMonth ? Temporal.PlainYearMonth :
  T extends Temporal.ZonedDateTime ? Temporal.ZonedDateTime :
  T extends object
    ? {
        [K in keyof T]: ToJsType<T[K]>
      }
  : never;

interface LagOptions<T> {
  expression: T;
  offset?: number | bigint | AnyNumberType | AnyBigIntType;
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
  group<T extends AllowedJson>(select: T): T[];
  group<T>(select: ToDbInterface<T>): T[];
  group<T extends AllowedJson>(key: DbString, value: T): Record<string, T>;
  windowGroup<T extends AllowedJson>(options: WindowOptions & { select: T }): T[];
  windowGroup<T>(options: WindowOptions & { select: ToDbInterface<T> }): T[];
  windowGroup<T extends AllowedJson>(options: WindowOptions & { key: DbString, value: T }): Record<string, T>;
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

interface MatchAnyKeywords {
  phrase?: any;
  startsWith?: any;
  prefix?: any;
  and?: any;
  or?: any;
  not?: any;
  near?: any;
}

interface MatchQuery<T> extends MatchKeywords, VirtualKeywords<T & { rowid: number }> {
  where?: {
    [K in keyof T]?: MatchKeywords | string;
  }
}

interface MatchAnyQuery<T> extends MatchAnyKeywords, VirtualKeywords<T & { rowid: number }> {
  where?: {
    [K in keyof T]?: MatchAnyKeywords | string;
  }
}

interface MatchQuerySelect<T, K> extends MatchKeywords, VirtualKeywords<T & { rowid: number }> {
  select: (keyof T)[] | K[];
  where?: {
    [K in keyof T]?: MatchKeywords | string;
  }
}

interface MatchQueryAnySelect<T, K> extends MatchAnyKeywords, VirtualKeywords<T & { rowid: number }> {
  select: (keyof T)[] | K[];
  where?: {
    [K in keyof T]?: MatchAnyKeywords | string;
  }
}

interface MatchQueryValue<T, K> extends MatchKeywords, VirtualKeywords<T & { rowid: number }> {
  return: K;
  column?: {
    [K in keyof T]?: MatchKeywords | string;
  }
}

interface MatchQueryAnyValue<T, K> extends MatchAnyKeywords, VirtualKeywords<T & { rowid: number }> {
  return: K;
  column?: {
    [K in keyof T]?: MatchAnyKeywords | string;
  }
}

interface VirtualQueries<T, E, W> {
  match(query: MatchQuery<T>): T[];
  match(query: MatchAnyQuery<T>): T[];
  match<K extends keyof E>(query: MatchQuerySelect<T, K>): Pick<E, K>[];
  match<K extends keyof E>(query: MatchQueryAnySelect<T, K>): Pick<E, K>[];
  match<K extends keyof E>(query: MatchQueryValue<T, K>): E[K][];
  match<K extends keyof E>(query: MatchQueryAnyValue<T, K>): E[K][];
  get(query: HighlightQuery<W, T>): { id: number, highlight: string } | undefined;
  get(query: SnippetQuery<W, T>): { id: number, snippet: string } | undefined;
  query(query: HighlightQuery<W, T>): Array<{ id: number, highlight: string }>;
  query(query: SnippetQuery<W, T>): Array<{ id: number, snippet: string }>;
}

interface WriteQueries<T, I, W, R> {
  insert(params: I): R;
  returnInsert(params: I) : T;
  insertMany(params: Array<I>): void;
  returnInsertMany(params: Array<I>): T[];
  update(options: UpdateQuery<W, I>): number;
  upsert<K extends keyof T>(options: UpsertQuery<I, K>): R;
  returnUpsert<K extends keyof T>(options: UpsertQuery<I, K>): T;
  delete(params?: W): number;
}

interface Queries<T, E, W, Y> {
  get(params?: W | null): T | undefined;
  get<K extends keyof E>(params: W | null, column: K): E[K] | undefined;
  get<K extends keyof E>(params: W | null, columns: (keyof E)[] | K[]): Pick<E, K> | undefined;
  many(params?: W): Array<T>;
  many<K extends keyof E>(params: W | null, columns: (keyof E)[] | K[]): Array<Pick<E, K>>;
  many<K extends keyof E>(params: W | null, column: K): Array<E[K]>;
  query(): Array<T>;
  query<K extends keyof E>(query: ComplexQueryValue<W, K, T>): Array<E[K]>;
  query<K extends keyof E>(query: ComplexQueryObject<W, K, T>): Array<Pick<E, K>>;
  query<K extends keyof E>(query: ComplexQueryObjectOmit<W, K, T>): Array<Omit<E, K>>;
  query(query: ComplexQuery<W, E>): Array<T>;
  first(): T | undefined;
  first<K extends keyof E>(query: ComplexQueryValue<W, K, T>): E[K] | undefined;
  first<K extends keyof E>(query: ComplexQueryObject<W, K, T>): Pick<E, K> | undefined;
  first<K extends keyof E>(query: ComplexQueryObjectOmit<W, K, T>): Omit<E, K> | undefined;
  first(query: ComplexQuery<W, E>): T | undefined;
  count<K extends keyof E>(query?: AggregateQuery<W, K>): number;
  avg<K extends keyof E>(query: AggregateQuery<W, K>): number;
  max<K extends keyof E>(query: AggregateQuery<W, K>): E[K];
  min<K extends keyof E>(query: AggregateQuery<W, K>): E[K];
  sum<K extends keyof E>(query: AggregateQuery<W, K>): number;
  exists(params: W | null): boolean;
}

type CompareMethods<T> = {
  not: (value: T | T[]) => symbol;
	gt: (value: NonNullable<T>) => symbol;
  gte: (value: NonNullable<T>) => symbol;
	lt: (value: NonNullable<T>) => symbol;
	lte: (value: NonNullable<T>) => symbol;
	like: (pattern: string | AnyStringType | RegExp) => symbol;
	match: (pattern: string | AnyStringType) => symbol;
	glob: (pattern: string | AnyStringType) => symbol;
	eq: (value: T) => symbol;
}

type UpdateCompareMethods = {
  not<T>(column: T, value: T): DbBoolean;
	gt<T>(column: T, value: NonNullable<T>): DbBoolean;
  gte<T>(column: T, value: NonNullable<T>): DbBoolean;
	lt<T>(column: T, value: NonNullable<T>): DbBoolean;
	lte<T>(column: T, value: NonNullable<T>): DbBoolean;
	like<T>(column: T, pattern: string | AnyStringType | RegExp): DbBoolean;
	match<T>(column: T, pattern: string | AnyStringType): DbBoolean;
	glob<T>(column: T, pattern: string | AnyStringType): DbBoolean;
	eq<T>(column: T, value: T): DbBoolean;
}

type SymbolCompareMethods<T> = {
  not: (column: symbol, value: T) => DbBoolean;
	gt: (column: symbol, value: NonNullable<T>) => DbBoolean;
  gte: (column: symbol, value: NonNullable<T>) => DbBoolean;
	lt: (column: symbol, value: NonNullable<T>) => DbBoolean;
	lte: (column: symbol, value: NonNullable<T>) => DbBoolean;
	like: (column: symbol, pattern: string | AnyStringType | RegExp) => DbBoolean;
	match: (column: symbol, pattern: string | AnyStringType) => DbBoolean;
	glob: (column: symbol, pattern: string | AnyStringType) => DbBoolean;
	eq: (column: symbol, value: T) => DbBoolean;
}

type Transform<T> = NonNullable<T> extends string | number | AnyTemporal
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

type WhereField<T> = T | Array<NonNullable<T>> | symbol | null;

type OptionalToNull<T> = {
  [K in keyof T]-?: undefined extends T[K] ? Exclude<T[K], undefined> | null : T[K];
};

type Primitive = string | number | boolean | AnyTemporal;

type PrimitiveNull = Primitive | null;

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

interface SQLiteLimits {
  length?: number;
  sqlLength?: number;
  column?: number;
  exprDepth?: number;
  compoundSelect?: number;
  vdbeOp?: number;
  functionArg?: number;
  attach?: number;
  likePatternLength?: number;
  variableNumber?: number;
  triggerDepth?: number;
}

interface SQLiteConfig {
  open?: boolean;
  readonly?: boolean;
  enableForeignKeyConstraints?: boolean;
  enableDoubleQuotedStringLiterals?: boolean;
  allowExtension?: boolean;
  timeout?: number;
  readBigInts?: boolean;
  defensive?: boolean;
  limits?: SQLiteLimits;
}

declare const intPk1: unique symbol;
declare const intPk2: unique symbol;

type PkNumber = typeof intPk1 | typeof intPk2;

declare const intComp1: unique symbol;
declare const intComp2: unique symbol;

type ComputedNumber = typeof intComp1 | typeof intComp2;

declare const intDefault1: unique symbol;
declare const intDefault2: unique symbol;

type DefaultNumber = typeof intDefault1 | typeof intDefault2;

declare const bigIntPk1: unique symbol;
declare const bigIntPk2: unique symbol;

type PkBigInt = typeof bigIntPk1 | typeof bigIntPk2;

declare const bigIntComp1: unique symbol;
declare const bigIntComp2: unique symbol;

type ComputedBigInt = typeof bigIntComp1 | typeof bigIntComp2;

declare const bigIntDefault1: unique symbol;
declare const bigIntDefault2: unique symbol;

type DefaultBigInt = typeof bigIntDefault1 | typeof bigIntDefault2;

declare const stringPk1: unique symbol;
declare const stringPk2: unique symbol;

type PkString = typeof stringPk1 | typeof stringPk2;

declare const stringComp1: unique symbol;
declare const stringComp2: unique symbol;

type ComputedString = typeof stringComp1 | typeof stringComp2;

declare const stringDefault1: unique symbol;
declare const stringDefault2: unique symbol;

type DefaultString = typeof stringDefault1 | typeof stringDefault2;

declare const blobPk1: unique symbol;
declare const blobPk2: unique symbol;

type PkBlob = typeof blobPk1 | typeof blobPk2;

declare const blobComp1: unique symbol;
declare const blobComp2: unique symbol;

type ComputedBlob = typeof blobComp1 | typeof blobComp2;

declare const blobDefault1: unique symbol;
declare const blobDefault2: unique symbol;

type DefaultBlob = typeof blobDefault1 | typeof blobDefault2;

declare const boolComp1: unique symbol;
declare const boolComp2: unique symbol;

type ComputedBoolean = typeof boolComp1 | typeof boolComp2;

declare const boolDefault1: unique symbol;
declare const boolDefault2: unique symbol;

type DefaultBoolean = typeof boolDefault1 | typeof boolDefault2;

declare const jsonComp1: unique symbol;
declare const jsonComp2: unique symbol;

type ComputedJson = typeof jsonComp1 | typeof jsonComp2;

declare const jsonDefault1: unique symbol;
declare const jsonDefault2: unique symbol;

type DefaultJson = typeof jsonDefault1 | typeof jsonDefault2;

declare const nullComp1: unique symbol;
declare const nullComp2: unique symbol;

type ComputedNull = typeof nullComp1 | typeof nullComp2;

declare const dbNumber1: unique symbol;
declare const dbNumber2: unique symbol;

type DbNumber = typeof dbNumber1 | typeof dbNumber2;

declare const dbBigInt1: unique symbol;
declare const dbBigInt2: unique symbol;

type DbBigInt = typeof dbBigInt1 | typeof dbBigInt2;

declare const dbString1: unique symbol;
declare const dbString2: unique symbol;

type DbString = typeof dbString1 | typeof dbString2;

declare const dbBoolean1: unique symbol;
declare const dbBoolean2: unique symbol;

type DbBoolean = typeof dbBoolean1 | typeof dbBoolean2;

declare const dbDuration1: unique symbol;
declare const dbDuration2: unique symbol;

type DbDuration = typeof dbDuration1 | typeof dbDuration2;

declare const dbInstant1: unique symbol;
declare const dbInstant2: unique symbol;

type DbInstant = typeof dbInstant1 | typeof dbInstant2;

declare const dbPlainDate1: unique symbol;
declare const dbPlainDate2: unique symbol;

type DbPlainDate = typeof dbPlainDate1 | typeof dbPlainDate2;

declare const dbPlainDateTime1: unique symbol;
declare const dbPlainDateTime2: unique symbol;

type DbPlainDateTime = typeof dbPlainDateTime1 | typeof dbPlainDateTime2;

declare const dbPlainMonthDay1: unique symbol;
declare const dbPlainMonthDay2: unique symbol;

type DbPlainMonthDay = typeof dbPlainMonthDay1 | typeof dbPlainMonthDay2;

declare const dbPlainTime1: unique symbol;
declare const dbPlainTime2: unique symbol;

type DbPlainTime = typeof dbPlainTime1 | typeof dbPlainTime2;

declare const dbPlainYearMonth1: unique symbol;
declare const dbPlainYearMonth2: unique symbol;

type DbPlainYearMonth = typeof dbPlainYearMonth1 | typeof dbPlainYearMonth2;

declare const dbZonedDateTime1: unique symbol;
declare const dbZonedDateTime2: unique symbol;

type DbZonedDateTime = typeof dbZonedDateTime1 | typeof dbZonedDateTime2;

declare const durationPk1: unique symbol;
declare const durationPk2: unique symbol;

type PkDuration = typeof durationPk1 | typeof durationPk2;

declare const instantPk1: unique symbol;
declare const instantPk2: unique symbol;

type PkInstant = typeof instantPk1 | typeof instantPk2;

declare const plainDatePk1: unique symbol;
declare const plainDatePk2: unique symbol;

type PkPlainDate = typeof plainDatePk1 | typeof plainDatePk2;

declare const plainDateTimePk1: unique symbol;
declare const plainDateTimePk2: unique symbol;

type PkPlainDateTime = typeof plainDateTimePk1 | typeof plainDateTimePk2;

declare const plainMonthDayPk1: unique symbol;
declare const plainMonthDayPk2: unique symbol;

type PkPlainMonthDay = typeof plainMonthDayPk1 | typeof plainMonthDayPk2;

declare const plainTimePk1: unique symbol;
declare const plainTimePk2: unique symbol;

type PkPlainTime = typeof plainTimePk1 | typeof plainTimePk2;

declare const plainYearMonthPk1: unique symbol;
declare const plainYearMonthPk2: unique symbol;

type PkPlainYearMonth = typeof plainYearMonthPk1 | typeof plainYearMonthPk2;

declare const zonedDateTimePk1: unique symbol;
declare const zonedDateTimePk2: unique symbol;

type PkZonedDateTime = typeof zonedDateTimePk1 | typeof zonedDateTimePk2;

declare const durationDefault1: unique symbol;
declare const durationDefault2: unique symbol;

type DefaultDuration = typeof durationDefault1 | typeof durationDefault2;

declare const instantDefault1: unique symbol;
declare const instantDefault2: unique symbol;

type DefaultInstant = typeof instantDefault1 | typeof instantDefault2;

declare const plainDateDefault1: unique symbol;
declare const plainDateDefault2: unique symbol;

type DefaultPlainDate = typeof plainDateDefault1 | typeof plainDateDefault2;

declare const plainDateTimeDefault1: unique symbol;
declare const plainDateTimeDefault2: unique symbol;

type DefaultPlainDateTime = typeof plainDateTimeDefault1 | typeof plainDateTimeDefault2;

declare const plainMonthDayDefault1: unique symbol;
declare const plainMonthDayDefault2: unique symbol;

type DefaultPlainMonthDay = typeof plainMonthDayDefault1 | typeof plainMonthDayDefault2;

declare const plainTimeDefault1: unique symbol;
declare const plainTimeDefault2: unique symbol;

type DefaultPlainTime = typeof plainTimeDefault1 | typeof plainTimeDefault2;

declare const plainYearMonthDefault1: unique symbol;
declare const plainYearMonthDefault2: unique symbol;

type DefaultPlainYearMonth = typeof plainYearMonthDefault1 | typeof plainYearMonthDefault2;

declare const zonedDateTimeDefault1: unique symbol;
declare const zonedDateTimeDefault2: unique symbol;

type DefaultZonedDateTime = typeof zonedDateTimeDefault1 | typeof zonedDateTimeDefault2;

declare const durationComp1: unique symbol;
declare const durationComp2: unique symbol;

type ComputedDuration = typeof durationComp1 | typeof durationComp2;

declare const instantComp1: unique symbol;
declare const instantComp2: unique symbol;

type ComputedInstant = typeof instantComp1 | typeof instantComp2;

declare const plainDateComp1: unique symbol;
declare const plainDateComp2: unique symbol;

type ComputedPlainDate = typeof plainDateComp1 | typeof plainDateComp2;

declare const plainDateTimeComp1: unique symbol;
declare const plainDateTimeComp2: unique symbol;

type ComputedPlainDateTime = typeof plainDateTimeComp1 | typeof plainDateTimeComp2;

declare const plainMonthDayComp1: unique symbol;
declare const plainMonthDayComp2: unique symbol;

type ComputedPlainMonthDay = typeof plainMonthDayComp1 | typeof plainMonthDayComp2;

declare const plainTimeComp1: unique symbol;
declare const plainTimeComp2: unique symbol;

type ComputedPlainTime = typeof plainTimeComp1 | typeof plainTimeComp2;

declare const plainYearMonthComp1: unique symbol;
declare const plainYearMonthComp2: unique symbol;

type ComputedPlainYearMonth = typeof plainYearMonthComp1 | typeof plainYearMonthComp2;

declare const zonedDateTimeComp1: unique symbol;
declare const zonedDateTimeComp2: unique symbol;

type ComputedZonedDateTime = typeof zonedDateTimeComp1 | typeof zonedDateTimeComp2;

type DateTypes = DbDuration | DbInstant | DbPlainDate | DbPlainDateTime | DbPlainMonthDay | DbPlainTime | DbPlainYearMonth | DbZonedDateTime;
type PkDateTypes = PkDuration | PkInstant | PkPlainDate | PkPlainDateTime | PkPlainMonthDay | PkPlainTime | PkPlainYearMonth | PkZonedDateTime;
type ComputedDateTypes = ComputedDuration | ComputedInstant | ComputedPlainDate | ComputedPlainDateTime | ComputedPlainMonthDay | ComputedPlainTime | ComputedPlainYearMonth | ComputedZonedDateTime;
type DefaultDateTypes = DefaultDuration | DefaultInstant | DefaultPlainDate | DefaultPlainDateTime | DefaultPlainMonthDay | DefaultPlainTime | DefaultPlainYearMonth | DefaultZonedDateTime;
type AnyDateType = DateTypes | PkDateTypes | ComputedDateTypes | DefaultDateTypes;
type CompatibleDateTypes = DbInstant | DbPlainDate | DbPlainDateTime | DbPlainMonthDay | DbPlainTime | DbPlainYearMonth;
type CompatiblePrimaryDateTypes = PkInstant | PkPlainDate | PkPlainDateTime | PkPlainMonthDay | PkPlainTime | PkPlainYearMonth;
type CompatibleComputedDateTypes = ComputedInstant | ComputedPlainDate | ComputedPlainDateTime | ComputedPlainMonthDay | ComputedPlainTime | ComputedPlainYearMonth;
type CompatibleDefaultDateTypes = DefaultInstant | DefaultPlainDate | DefaultPlainDateTime | DefaultPlainMonthDay | DefaultPlainTime | DefaultPlainYearMonth;
type CompatibleDate = CompatibleDateTypes | CompatiblePrimaryDateTypes | CompatibleComputedDateTypes | CompatibleDefaultDateTypes;

type AnyDurationType = DefaultDuration | ComputedDuration | PkDuration | DbDuration;
type AnyInstantType = DefaultInstant | ComputedInstant | PkInstant | DbInstant;
type AnyPlainDateType = DefaultPlainDate | ComputedPlainDate | PkPlainDate | DbPlainDate;
type AnyPlainDateTimeType = DefaultPlainDateTime | ComputedPlainDateTime | PkPlainDateTime | DbPlainDateTime;
type AnyPlainMonthDayType = DefaultPlainMonthDay | ComputedPlainMonthDay | PkPlainMonthDay | DbPlainMonthDay;
type AnyPlainTimeType = DefaultPlainTime | ComputedPlainTime | PkPlainTime | DbPlainTime;
type AnyPlainYearMonthType = DefaultPlainYearMonth | ComputedPlainYearMonth | PkPlainYearMonth | DbPlainYearMonth;
type AnyZonedDateTimeType = DefaultZonedDateTime | ComputedZonedDateTime | PkZonedDateTime | DbZonedDateTime;
type AnyTemporal = Temporal.Duration | Temporal.Instant | Temporal.PlainDate | Temporal.PlainDateTime | Temporal.PlainMonthDay | Temporal.PlainTime | Temporal.PlainYearMonth | Temporal.ZonedDateTime;

declare const dbJson1: unique symbol;
declare const dbJson2: unique symbol;

type DbJson = typeof dbJson1 | typeof dbJson2;

declare const dbBlob1: unique symbol;
declare const dbBlob2: unique symbol;

type DbBlob = typeof dbBlob1 | typeof dbBlob2;

declare const dbNull1: unique symbol;
declare const dbNull2: unique symbol;

type DbNull = typeof dbNull1 | typeof dbNull2;

type AnyNumberType = DbNumber | DefaultNumber | PkNumber | ComputedNumber;
type AnyBigIntType = DbBigInt | DefaultBigInt | PkBigInt | ComputedBigInt;
type AnyBooleanType = DbBoolean | DefaultBoolean | ComputedBoolean;
type AnyStringType = DbString | DefaultString | PkString | ComputedString;
type AnyBlobType = DbBlob | DefaultBlob | PkBlob | ComputedBlob;
type AnyJsonType = DbJson | DefaultJson | ComputedJson;
type AnyNullType = DbNull | ComputedNull;

type DbAny = AnyNumberType | AnyBigIntType | AnyBooleanType | AnyStringType | AnyBlobType | AnyJsonType | AnyDateType;
type AnyParam = DbAny | AnyNullType;

type AllowedJson = AnyNumberType | AnyBigIntType | AnyBooleanType | AnyStringType | AnyBlobType | AnyJsonType | AnyDateType | DbNull | { [key: string]: AllowedJson | Primitive | null } | AllowedJson[];
type SelectType = (() => SelectType) | Primitive | AllowedJson | AllowedJson[] | SelectType[] | { [key: string | symbol]: AllowedJson | Primitive | (() => SelectType) };

type Numeric = number | bigint | AnyNumberType | AnyBigIntType;
type NumericParam = number | bigint | AnyNumberType | null | AnyNullType;
type NumberResult = DbNumber | DbNull;

type OnlyStrings = string | AnyStringType;
type StringParam = string | AnyStringType | null | AnyNullType;
type StringResult = DbString | DbNull;

type NumberBlobParam = number | Uint8Array | null | AnyNumberType | AnyBlobType | AnyNullType;
type StringBlobParam = string | Uint8Array | null | AnyStringType | AnyBlobType | AnyNullType;

type AnyResult = DbString | DbNumber | DbBigInt | DateTypes | DbBoolean | DbJson | DbBlob | DbNull;

type BlobResult = DbBlob | DbNull;

type DateParam = number | string | null | AnyStringType | AnyNumberType | CompatibleDate | AnyNullType;

type BooleanParam = boolean | AnyBooleanType;
type BooleanResult = DbBoolean | DbNull;

type JsonParam = string | Uint8Array | null | DbString | DbBlob | DbJson | AnyNullType;
type ExtractResult = DbString | DbNumber | DbBoolean | DbNull;
type JsonResult = DbJson | DbNull;

type DbTypes = number | bigint | string | boolean | AnyTemporal | Uint8Array | null;
type DefaultTypes = DefaultNumber | DefaultBigInt | DefaultString | DefaultBoolean | DefaultDateTypes | DefaultBlob;

type ParamType = PrimitiveNull | AnyParam;

type ToNumericResult<T> =
  T extends bigint | AnyBigIntType ? ComputedBigInt :
  T extends number | AnyNumberType ? ComputedNumber :
  T extends null | AnyNullType ? ComputedNull :
  never;

type GetReturnType<T> =
  PkNumber extends T[keyof T] ? number :
  PkString extends T[keyof T] ? string :
  PkBlob extends T[keyof T] ? Uint8Array :
  PkDuration extends T[keyof T] ? Temporal.Duration :
  PkInstant extends T[keyof T] ? Temporal.Instant :
  PkPlainDate extends T[keyof T] ? Temporal.PlainDate :
  PkPlainDateTime extends T[keyof T] ? Temporal.PlainDateTime :
  PkPlainMonthDay extends T[keyof T] ? Temporal.PlainMonthDay :
  PkPlainTime extends T[keyof T] ? Temporal.PlainTime :
  PkPlainYearMonth extends T[keyof T] ? Temporal.PlainYearMonth :
  PkZonedDateTime extends T[keyof T] ? Temporal.ZonedDateTime :
  number;

type GetPrimaryKey<T> =
  PkNumber extends T[keyof T] ? DbNumber :
  PkBigInt extends T[keyof T] ? DbBigInt :
  PkString extends T[keyof T] ? DbString :
  PkBlob extends T[keyof T] ? DbBlob :
  PkDuration extends T[keyof T] ? DbDuration :
  PkInstant extends T[keyof T] ? DbInstant :
  PkPlainDate extends T[keyof T] ? DbPlainDate :
  PkPlainDateTime extends T[keyof T] ? DbPlainDateTime :
  PkPlainMonthDay extends T[keyof T] ? DbPlainMonthDay :
  PkPlainTime extends T[keyof T] ? DbPlainTime :
  PkPlainYearMonth extends T[keyof T] ? DbPlainYearMonth :
  PkZonedDateTime extends T[keyof T] ? DbZonedDateTime :
  DbNumber;

type PkToDbType<T> = 
  T extends PkNumber ? DbNumber :
  T extends PkBigInt ? DbBigInt :
  T extends PkString ? DbString :
  T extends PkBlob ? DbBlob :
  T extends PkDuration ? DbDuration :
  T extends PkInstant ? DbInstant :
  T extends PkPlainDate ? DbPlainDate :
  T extends PkPlainDateTime ? DbPlainDateTime :
  T extends PkPlainMonthDay ? DbPlainMonthDay :
  T extends PkPlainTime ? DbPlainTime :
  T extends PkPlainYearMonth ? DbPlainYearMonth :
  T extends PkZonedDateTime ? DbZonedDateTime :
  T;

type ToPrimaryKey<T> =
  T extends AnyStringType ? PkString :
  T extends AnyNumberType ? PkNumber :
  T extends AnyBigIntType ? PkBigInt :
  T extends AnyBlobType ? PkBlob :
  T extends AnyDurationType ? PkDuration :
  T extends AnyInstantType ? PkInstant :
  T extends AnyPlainDateType ? PkPlainDate :
  T extends AnyPlainDateTimeType ? PkPlainDateTime :
  T extends AnyPlainMonthDayType ? PkPlainMonthDay :
  T extends AnyPlainTimeType ? PkPlainTime :
  T extends AnyPlainYearMonthType ? PkPlainYearMonth :
  T extends AnyZonedDateTimeType ? PkZonedDateTime :
  never;

type ClassFields<T extends new (...args: any[]) => any> = {
  [K in keyof InstanceType<T>]: InstanceType<T>[K];
};

type RemoveUpperCase<T> = {
  [K in keyof T as K extends string
    ? K extends `${infer First}${infer Second}${string}`
      ? First extends Uppercase<First>
        ? Second extends Lowercase<Second>
          ? never
          : K
        : K
      : K
    : never]: T[K];
};

type IsAny<T> = 0 extends (1 & T) ? true : false;

type ExtractColumns<T> = {
  [K in keyof T as K extends string
    ? K extends `${infer First}${infer Second}${string}`
      ? First extends Uppercase<First>
        ? Second extends Lowercase<Second>
          ? never
          : K
        : K
      : K
    : never]: IsAny<ToDbType<T[K]>> extends true
      ? DbString
      : ToDefaultType<T[K]>;
};

type PkType = PkNumber | PkBigInt | PkString | PkDateTypes | PkBlob;
type ComputedType = ComputedNumber | ComputedBigInt | ComputedString | ComputedDateTypes | ComputedBoolean | ComputedJson | ComputedBlob;

type OptionalKeys<T> = {
  [K in keyof T]:
    T[K] extends PkType | DbTypes | DefaultTypes
      ? K
      : DbNull extends T[K]
        ? K
        : never
}[keyof T];

type RequiredKeys<T> = {
  [K in keyof T]:
    T[K] extends PkType | DbTypes | DefaultTypes
      ? never
      : DbNull extends T[K]
        ? never
        : K
}[keyof T];

type ToInsert<T> =
  {
    [K in OptionalKeys<T>]?: T[K];
  } &
  {
    [K in RequiredKeys<T>]: T[K];
  };


type ExcludeComputed<T> = {
  [K in keyof T as T[K] extends DbTypes | DefaultTypes | AnyResult | PkType ? K : never]: T[K]
};

type ToQuery<Y, T> = Queries<ToJsType<T>, ToJsType<T>, ToWhere<ToJsType<T>>, Y> & WriteQueries<ToJsType<T>, ToJsType<ToInsert<ExcludeComputed<T>>>, ToWhere<ToJsType<T>>, GetReturnType<T>>;
type ToVirtualQuery<Y, T, E> = Queries<ToJsType<E>, ToJsType<E> & { rowid: number }, ToWhere<ToJsType<T>>, Y> & WriteQueries<ToJsType<E>, ToJsType<ToInsert<ExcludeComputed<E>>> & { rowid: number }, ToWhere<ToJsType<T>>, number>;

type ToFTS<Y, T, E> = VirtualQueries<ToJsType<E>, ToJsType<E> & { rowid: number }, ToWhere<ToJsType<T>>> & ToVirtualQuery<Y, T, E>;

type ToExternalFTS<Y, T, E> = VirtualQueries<ToJsType<E>, ToJsType<E>  & { rowid: number }, ToWhere<ToJsType<T>>> & Queries<ToJsType<E>, ToJsType<E>, ToWhere<ToJsType<T>>, Y>;

type MakeClient<T extends { [key: string]: abstract new (...args: any) => any }> = {
  [K in keyof T as K extends string
    ? `${Uncapitalize<K>}`
    : never]: K extends string ? (
      InstanceType<T[K]> extends FTSTable 
        ? ToFTS<MakeClient<T>, ExtractColumns<InstanceType<T[K]>> & { [P in Uncapitalize<K>]: DbString }, Omit<ExtractColumns<InstanceType<T[K]>>, 'rowid'>>
        : InstanceType<T[K]> extends ExternalFTSTable 
          ? ToExternalFTS<MakeClient<T>, ExtractColumns<InstanceType<T[K]>> & { [P in Uncapitalize<K>]: DbString }, Omit<ExtractColumns<InstanceType<T[K]>>, 'rowid'>>
      : ToQuery<MakeClient<T>, ExtractColumns<InstanceType<T[K]>>>) : never;
};

type MakeContext<T extends Record<string, abstract new (...args: any) => any>> = {
  [K in keyof T as Uncapitalize<K & string>]:
    InstanceType<T[K]> extends FTSTable
      ? ExtractColumns<InstanceType<T[K]>> & { [P in Uncapitalize<K & string>]: DbString }
      : ExtractColumns<InstanceType<T[K]>>
};

type Unwrap<T extends any[]> = {
  [K in keyof T]: T[K];
}

type QueryCompareTypes = AnyTemporal | number | boolean | null | string | Uint8Array | symbol;

type SubqueryContext = 
  CompareMethods<QueryCompareTypes> &
  SymbolCompareMethods<QueryCompareTypes> &
  ComputeMethods &
  SymbolMethods &
  { use<T>(context: T): T };

type MakeOptional<T> = {
  [K in keyof T]:
    T[K] extends object
      ? T[K]
      : T[K] | DbNull;
};

type SymbolWhere = {
  [key: symbol]: any;
  and?: {
    [key: symbol]: any;
    and?: { [key: symbol]: any }[];
    or?: { [key: symbol]: any }[];
  }[];
  or?: {
    [key: symbol]: any;
    and?: { [key: symbol]: any }[];
    or?: { [key: symbol]: any }[];
  }[];
}

interface LogInfo {
  sql: string;
  params: any;
  durationMs: number;
}

type JoinType = 'left' | 'right' | 'union';

interface QueryReturn {
  where?: SymbolWhere;
  join?: SymbolWhere & { type?: JoinType } | [symbol, symbol] | [symbol, symbol, JoinType] | (SymbolWhere & { type?: JoinType } | [symbol, symbol] | [symbol, symbol, JoinType])[];
  groupBy?: symbol | symbol[];
  having?: SymbolWhere;
  orderBy?: symbol | symbol[];
  desc?: boolean | AnyBooleanType;
  offset?: number | bigint | AnyNumberType | AnyBigIntType;
  limit?: number | bigint | AnyNumberType | AnyBigIntType;
  bm25?: { [key: symbol]: number | bigint | AnyNumberType | AnyBigIntType };
  rank?: boolean | DbBoolean | ComputedBoolean;
  log?: boolean | ((info: LogInfo) => void);
}

interface ObjectReturn<S> extends QueryReturn {
  select?: { [key: string | symbol]: S };
  distinct?: { [key: string | symbol]: S };
  maybe?: { [key: string | symbol]: S };
  certain?: { [key: string | symbol]: S };
}

interface ValueReturn<S> extends QueryReturn {
  select?: S;
  distinct?: S;
  maybe?: S;
  certain?: S;
}

type RemoveNull<T> =
  T extends (infer U)[]
    ? RemoveNull<U>[]
    : T extends object
      ? { [K in keyof T]: RemoveNull<Exclude<T[K], DbNull>> }
      : Exclude<T, DbNull>;

type GetDefined<T> =
  ToJsType<
    (T extends { select: any } ? T['select'] : unknown) &
    (T extends { distinct: any } ? T['distinct'] : unknown) &
    (T extends { certain: any } ? Exclude<T['certain'], DbNull> : unknown) &
    (T extends { maybe: any } ? NonNullable<T['maybe']> | DbNull : unknown)
  >;

interface TypedDb<P, C> {
  exec(sql: string): void;
  begin(type?: 'deferred' | 'immediate'): void;
  commit(): void;
  rollback(): void;
  migrate(sql: string): void;
  getSchema(): any[];
  diff(schema?: any[]): string;
  first<S extends SelectType, K extends ObjectReturn<S>, T extends (tables: C) => K>(expression: T): ToJsType<ReturnType<T>['select'] & ReturnType<T>['distinct'] & MakeOptional<NonNullable<ReturnType<T>['maybe']>> & RemoveNull<ReturnType<T>['certain']>> | undefined;
  firstValue<S extends SelectType, K extends ValueReturn<S>, T extends (tables: C) => K>(expression: T): GetDefined<ReturnType<T>> | undefined;
  query<S extends SelectType, K extends ObjectReturn<S>, T extends (tables: C) => K>(expression: T): ToJsType<ReturnType<T>['select'] & ReturnType<T>['distinct'] & MakeOptional<NonNullable<ReturnType<T>['maybe']>> & RemoveNull<ReturnType<T>['certain']>>[];
  queryValues<S extends SelectType, K extends ValueReturn<S>, T extends (tables: C) => K>(expression: T): GetDefined<ReturnType<T>>[];
  subquery<S extends SelectType, K extends ObjectReturn<S>, T extends (tables: C) => K>(expression: T): ReturnType<T>['select'] & ReturnType<T>['distinct'] & MakeOptional<NonNullable<ReturnType<T>['maybe']>> & RemoveNull<ReturnType<T>['certain']>;
  use<S>(query: S): ReadQueries<P, S>;
}

type ToComputed<T> =
  T extends AnyStringType ? ComputedString :
  T extends AnyBooleanType ? ComputedBoolean :
  T extends DbDuration ? ComputedDuration :
  T extends DbInstant ? ComputedInstant :
  T extends DbPlainDate ? ComputedPlainDate :
  T extends DbPlainDateTime ? ComputedPlainDateTime :
  T extends DbPlainMonthDay ? ComputedPlainMonthDay :
  T extends DbPlainTime ? ComputedPlainTime :
  T extends DbPlainYearMonth ? ComputedPlainYearMonth :
  T extends DbZonedDateTime ? ComputedZonedDateTime :
  T extends AnyNullType ? ComputedNull :
  T extends AnyJsonType ? ComputedJson :
  T extends AnyNumberType ? ComputedNumber :
  T extends AnyBigIntType ? ComputedBigInt :
  T extends boolean ? ComputedBoolean :
  T extends number ? ComputedNumber :
  T extends bigint ? ComputedBigInt :
  T extends string ? ComputedString :
  T extends Temporal.Duration ? ComputedDuration :
  T extends Temporal.Instant ? ComputedInstant :
  T extends Temporal.PlainDate ? ComputedPlainDate :
  T extends Temporal.PlainDateTime ? ComputedPlainDateTime :
  T extends Temporal.PlainMonthDay ? ComputedPlainMonthDay :
  T extends Temporal.PlainTime ? ComputedPlainTime :
  T extends Temporal.PlainYearMonth ? ComputedPlainYearMonth :
  T extends Temporal.ZonedDateTime ? ComputedZonedDateTime :
  T extends Uint8Array ? ComputedBlob :
  T extends null ? ComputedNull :
  T;

type ForeignActions = 'no action' | 'restrict' | 'set null' | 'set default' | 'cascade';

interface StaticNull {
  Int: DbNumber | DbNull;
  BigInt: DbBigInt | DbNull;
  Real: DbNumber | DbNull;
  Text: DbString | DbNull;
  Blob: DbBlob | DbNull;
  Json: DbJson | DbNull;
  Bool: DbBoolean | DbNull;
  Duration: DbDuration | DbNull;
  Instant: DbInstant | DbNull;
  PlainDate: DbPlainDate | DbNull;
  PlainDateTime: DbPlainDateTime | DbNull;
  PlainMonthDay: DbPlainMonthDay | DbNull;
  PlainTime: DbPlainTime | DbNull;
  PlainYearMonth: DbPlainYearMonth | DbNull;
  ZonedDateTime: DbZonedDateTime | DbNull;
}

interface Null {
  Int: DbNumber | DbNull;
  BigInt: DbBigInt | DbNull;
  Real: DbNumber | DbNull;
  Text: DbString | DbNull;
  Blob: DbBlob | DbNull;
  Json: DbJson | DbNull;
  Bool: DbBoolean | DbNull;
  Duration: DbDuration | DbNull;
  Instant: DbInstant | DbNull;
  PlainDate: DbPlainDate | DbNull;
  PlainDateTime: DbPlainDateTime | DbNull;
  PlainMonthDay: DbPlainMonthDay | DbNull;
  PlainTime: DbPlainTime | DbNull;
  PlainYearMonth: DbPlainYearMonth | DbNull;
  ZonedDateTime: DbZonedDateTime | DbNull;

  Now: NullNow;
  True: DefaultBoolean | DbNull;
  False: DefaultBoolean | DbNull;

  References<T extends abstract new (...args: any[]) => any>(table: T, options?: {
    onDelete?: ForeignActions,
    onUpdate?: ForeignActions,
    index?: false
  }): GetPrimaryKey<RemoveUpperCase<InstanceType<T>>> | DbNull;
  References<T extends abstract new (...args: any[]) => any, K extends keyof RemoveUpperCase<InstanceType<T>>>(table: T, options?: {
    column: K,
    onDelete?: ForeignActions,
    onUpdate?: ForeignActions,
    index?: false
  }): PkToDbType<InstanceType<T>[K]> | DbNull;
  Cascade<T extends abstract new (...args: any[]) => any>(table: T, options?: {
    index?: false
  }): GetPrimaryKey<RemoveUpperCase<InstanceType<T>>> | DbNull;
  Cascade<T extends abstract new (...args: any[]) => any, K extends keyof RemoveUpperCase<InstanceType<T>>>(table: T, options?: {
    column: K,
    index?: false
  }): PkToDbType<InstanceType<T>[K]> | DbNull;

  Default<T extends PrimitiveNull>(value: T): ToDefaultType<T> | DbNull;

  TypedArray<T extends TypedJson>(type: T): T[] | DbNull;
  TypedObject<T extends TypedJson>(type: T): T | DbNull;
}

interface Now {
  Instant: DefaultInstant;
  PlainDate: DefaultPlainDate;
  PlainDateTime: DefaultPlainDateTime;
  PlainTime: DefaultPlainTime;
  ZonedDateTime: DefaultZonedDateTime;
}

interface NullNow {
  Instant: DefaultInstant | DbNull;
  PlainDate: DefaultPlainDate | DbNull;
  PlainDateTime: DefaultPlainDateTime | DbNull;
  PlainTime: DefaultPlainTime | DbNull;
  ZonedDateTime: DefaultZonedDateTime | DbNull;
}

type TypedJson = AnyParam | { [key: string]: AnyParam | TypedJson | TypedJson[] };

export class BaseTable {
  static Int: DbNumber;
  static IntPrimary: PkNumber;
  static BigInt: DbBigInt;
  static BigIntPrimary: PkBigInt;
  static Real: DbNumber;
  static RealPrimary: PkNumber;
  static Text: DbString;
  static TextPrimary: PkString;
  static Blob: DbBlob
  static BlobPrimary: PkBlob;
  static Json: DbJson;
  static Duration: DbDuration;
  static Instant: DbInstant;
  static PlainDate: DbPlainDate;
  static PlainDateTime: DbPlainDateTime;
  static PlainMonthDay: DbPlainMonthDay;
  static PlainTime: DbPlainTime;
  static PlainYearMonth: DbPlainYearMonth;
  static ZonedDateTime: DbZonedDateTime;
  static DurationPrimary: PkDuration;
  static InstantPrimary: PkInstant;
  static PlainDatePrimary: PkPlainDate;
  static PlainDateTimePrimary: PkPlainDateTime;
  static PlainMonthDayPrimary: PkPlainMonthDay;
  static PlainTimePrimary: PkPlainTime;
  static PlainYearMonthPrimary: PkPlainYearMonth;
  static ZonedDateTimePrimary: PkZonedDateTime;
  static Bool: DbBoolean;
  static Null: StaticNull;

  Int: DbNumber;
  IntPrimary: PkNumber;
  BigInt: DbBigInt;
  BigIntPrimary: PkBigInt;
  Real: DbNumber;
  RealPrimary: PkNumber;
  Text: DbString;
  TextPrimary: PkString;
  Blob: DbBlob
  BlobPrimary: PkBlob;
  Json: DbJson;
  Duration: DbDuration;
  Instant: DbInstant;
  PlainDate: DbPlainDate;
  PlainDateTime: DbPlainDateTime;
  PlainMonthDay: DbPlainMonthDay;
  PlainTime: DbPlainTime;
  PlainYearMonth: DbPlainYearMonth;
  ZonedDateTime: DbZonedDateTime;
  DurationPrimary: PkDuration;
  InstantPrimary: PkInstant;
  PlainDatePrimary: PkPlainDate;
  PlainDateTimePrimary: PkPlainDateTime;
  PlainMonthDayPrimary: PkPlainMonthDay;
  PlainTimePrimary: PkPlainTime;
  PlainYearMonthPrimary: PkPlainYearMonth;
  ZonedDateTimePrimary: PkZonedDateTime;
  Bool: DbBoolean;

  Now: Now;
  True: DefaultBoolean;
  False: DefaultBoolean;

  Primary<T extends DbAny>(type: T): ToPrimaryKey<T>;

  References<T extends abstract new (...args: any[]) => any>(table: T, options?: {
    onDelete?: ForeignActions,
    onUpdate?: ForeignActions,
    index?: false
  }): GetPrimaryKey<RemoveUpperCase<InstanceType<T>>>;
  References<T extends abstract new (...args: any[]) => any, K extends keyof RemoveUpperCase<InstanceType<T>>>(table: T, options?: {
    column: K,
    onDelete?: ForeignActions,
    onUpdate?: ForeignActions,
    index?: false
  }): PkToDbType<InstanceType<T>[K]>;
  Cascade<T extends abstract new (...args: any[]) => any>(table: T, options?: {
    index?: false
  }): GetPrimaryKey<RemoveUpperCase<InstanceType<T>>>;
  Cascade<T extends abstract new (...args: any[]) => any, K extends keyof RemoveUpperCase<InstanceType<T>>>(table: T, options?: {
    column: K,
    index?: false
  }): PkToDbType<InstanceType<T>[K]>;

  Index<T>(type: T): ToDbType<T>;
  Index<T>(type: T, expression: (column: T) => { where: { [key: symbol]: any }}): ToDbType<T>;
  Index(...args: [any, ...any[]]): void;
  Index(...args: [any, ...any[], { where: { [key: symbol]: any }}]): void;
  Unique<T>(type: T): ToDbType<T>;
  Unique<T>(type: T, expression: (column: T) => { where: { [key: symbol]: any }}): ToDbType<T>;
  Unique(...args: [any, ...any[]]): void;
  Unique(...args: [any, ...any[], { where: { [key: symbol]: any }}]): void;
  Check(where: SymbolWhere): void;
  Check<T>(type: T, ...checks: ({ in: DbTypes[] } | { is: any })[]): ToDbType<T>;
  Null: Null;
  Default<T extends PrimitiveNull>(value: T): ToDefaultType<T>;

  TypedArray<T extends TypedJson>(type: T): T[];
  TypedObject<T extends TypedJson>(type: T): T;

  Symbol<T>(json: T): T extends DbNull ? DbJson | DbNull : DbJson;

  Abs<T extends Numeric>(n: T): ToNumericResult<T>;
  Cast(value: any, to: 'real' | 'integer'): ComputedNumber;
  Coalesce<T extends DbAny | DbTypes | DbNull>(a: T, b: T, ...rest: T[]): ToComputed<T>;
  Concat(...args: any[]): ComputedString;
  ConcatWs(...args: any[]): ComputedString;
  Format<T extends StringParam>(format: T, ...args: any[]): ToComputed<T>;
  Iif<T extends DbTypes | DbAny>(...args: IfOddArgs<T>): ToComputed<ToDbType<T>>;
  Iif<T extends DbTypes | DbAny>(...args: IfEvenArgs<T>): ToComputed<ToDbType<T | null>>;
  Iif(...args: any[]): ToComputed<AnyResult>;
  Instr(a: OnlyStrings, b: OnlyStrings): ComputedNumber;
  Instr(a: StringBlobParam, b: StringBlobParam): ToComputed<NumberResult>;
  Length(value: any): ToComputed<NumberResult>;
  Lower(value: OnlyStrings): ComputedString;
  Lower(value: StringParam): ComputedString;
  Ltrim(value: StringParam, remove?: StringParam): ToComputed<StringResult>;
  Max<T>(a: T, b: T, ...rest: T[]): ToComputed<T>;
  Min<T>(a: T, b: T, ...rest: T[]): ToComputed<T>;
  Nullif<T extends DbAny>(a: T, b: any): ToComputed<T | DbNull>;
  OctetLength(value: any): ToComputed<NumberResult>;
  Replace<T extends StringParam>(value: T, occurrences: T, substitute: T): ToComputed<T>;
  Round<T extends NumericParam>(value: T, places?: T): ToComputed<T>;
  Rtrim<T extends StringParam>(value: T, remove?: StringParam): ToComputed<T>;
  Sign(value: Numeric): ToComputed<-1 | 0 | 1>;
  Sign(value: any): ToComputed<NumberResult>;
  Substring<T extends StringParam>(value: T, start: NumericParam, length?: NumericParam): ToComputed<T>;
  Trim<T extends StringParam>(value: T, remove?: StringParam): ToComputed<T>;
  Unhex(hex: StringParam, ignore?: StringParam): ToComputed<BlobResult>;
  Unicode(value: OnlyStrings): ToComputed<DbNumber>;
  Unicode(value: StringParam): ToComputed<NumberResult>;
  Upper(value: OnlyStrings): ToComputed<DbString>;
  Upper(value: StringParam): ToComputed<StringResult>;
  ToDate(): ComputedString;
  ToDate(time: CompatibleDate): ComputedString;
  ToDate(time: DateParam, ...modifiers: StringParam[]): ToComputed<StringResult>;
  Time(): ComputedString;
  Time(time: CompatibleDate): ComputedString;
  Time(time: DateParam, ...modifiers: StringParam[]): ToComputed<StringResult>;
  DateTime(): ComputedString;
  DateTime(time: CompatibleDate): ComputedString;
  DateTime(time: DateParam, ...modifiers: StringParam[]): ToComputed<StringResult>;
  JulianDay(): ComputedNumber;
  JulianDay(time: CompatibleDate): ComputedNumber;
  JulianDay(time: DateParam, ...modifiers: StringParam[]): ToComputed<NumberResult>;
  UnixEpoch(): ComputedNumber;
  UnixEpoch(time: CompatibleDate): ComputedNumber;
  UnixEpoch(time: DateParam, ...modifiers: StringParam[]): ToComputed<StringResult>;
  StrfTime(format: StringParam, time: DateParam, ...modifiers: StringParam[]): ToComputed<StringResult>;
  TimeDiff(start: CompatibleDate, end: CompatibleDate): ComputedString;
  TimeDiff(start: DateParam, end: DateParam): ToComputed<StringResult>;
  Acos(value: NumericParam): ToComputed<NumberResult>;
  Acosh(value: NumericParam): ToComputed<NumberResult>;
  Asin(value: NumericParam): ToComputed<NumberResult>;
  Asinh(value: NumericParam): ToComputed<NumberResult>;
  Atan(value: NumericParam): ToComputed<NumberResult>;
  Atan2(b: NumericParam, a: NumericParam): ToComputed<NumberResult>;
  Atanh(value: NumericParam): ToComputed<NumberResult>;
  Ceil<T extends NumericParam>(value: T): ToComputed<T>;
  Cos<T extends NumericParam>(value: T): ToComputed<T>;
  Cosh(value: NumericParam): ToComputed<NumberResult>;
  Degrees(value: NumericParam): ToComputed<NumberResult>;
  Exp(value: NumericParam): ToComputed<NumberResult>;
  Floor<T extends NumericParam>(value: T): ToComputed<T>;
  Ln(value: NumericParam): ToComputed<NumberResult>;
  Log(base: NumericParam, value: NumericParam): ToComputed<NumberResult>;
  Mod(value: NumericParam, divider: NumericParam): ToComputed<NumberResult>;
  Pi(): ToComputed<DbNumber>;
  Power(value: NumericParam, exponent: NumericParam): ToComputed<NumberResult>;
  Radians(value: NumericParam): ToComputed<NumberResult>;
  Sin(value: Numeric): ToComputed<DbNumber>;
  Sin(value: NumericParam): ToComputed<NumberResult>;
  Sinh(value: NumericParam): ToComputed<NumberResult>;
  Sqrt(value: NumericParam): ToComputed<NumberResult>;
  Tan(value: NumericParam): ToComputed<NumberResult>;
  Tanh(value: NumericParam): ToComputed<NumberResult>;
  Trunc<T extends NumericParam>(value: T): ToComputed<T>;
  ToJson(param: JsonParam | any[]): ToComputed<StringResult>;
  Extract(json: JsonParam | any[], path: string): any;
  Extract<T, S extends (T) => any>(json: T, extractor: S): ToComputed<ReturnType<S>>;
  Object<T extends { [key: string]: AllowedJson }>(select: T): ToComputed<ToJson<T>>;
  ArrayLength(param: JsonParam | any[]): ToComputed<NumberResult>;

  Plus<T extends NumericParam>(...args: T[]): ToComputed<T>;
  Minus<T extends NumericParam>(...args: T[]): ToComputed<T>;
  Divide<T extends NumericParam>(...args: T[]): ToComputed<T>;
  Multiply<T extends NumericParam>(...args: T[]): ToComputed<T>;

  Not(value: symbol | QueryCompareTypes | QueryCompareTypes[]): ComputedBoolean;
  Not(column: symbol, value: QueryCompareTypes | QueryCompareTypes[]): ComputedBoolean;
  Gt(value: symbol | QueryCompareTypes): ComputedBoolean;
	Gt(column: symbol, value: QueryCompareTypes): ComputedBoolean;
  Gte(value: symbol | QueryCompareTypes): ComputedBoolean;
	Gte(column: symbol, value: QueryCompareTypes): ComputedBoolean;
  Lt(value: symbol | QueryCompareTypes): ComputedBoolean;
	Lt(column: symbol, value: QueryCompareTypes): ComputedBoolean;
  Lte(value: symbol | QueryCompareTypes): ComputedBoolean;
	Lte(column: symbol, value: QueryCompareTypes): ComputedBoolean;
  Like(pattern: DbString | ComputedString | string): ComputedBoolean;
	Like(column: symbol, pattern: QueryCompareTypes): ComputedBoolean;
  Match(pattern: DbString | ComputedString | string): ComputedBoolean;
	Match(column: symbol, pattern: QueryCompareTypes): ComputedBoolean;
  Glob(pattern: DbString | ComputedString | string): ComputedBoolean;
	Glob(column: symbol, pattern: QueryCompareTypes): ComputedBoolean;
  Eq(value: symbol | QueryCompareTypes): ComputedBoolean;
	Eq(column: symbol, value: QueryCompareTypes): ComputedBoolean;
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
  Unindexed: DbString;
}

export class ExternalFTSTable extends FTSTable {
  ExternalRowId?: PkNumber | DbNumber;
}

interface FunctionArgs<T, A> {
  returnType: T;
  options?: FunctionOptions,
  lambda: (...args: A) => PrimitiveNull | undefined
}

export class Database {
  constructor(path?: PathLike, options?: SQLiteConfig);
  getClient<T extends abstract new (...args: any[]) => any, C extends { [key: string]: T }>(classes: C): TypedDb<MakeClient<C>, MakeContext<C>> & MakeClient<C>;
  run(args: { query: any, params?: any }): number;
  all<T>(args: { query: any, params?: any, options?: QueryOptions }): Array<T>;
  exec(query: string): void;
  begin(): void;
  commit(): void;
  rollback(): void;
  close(): void;
  createFunction<T extends AnyParam, A extends ParamType[]>(args: FunctionArgs<T, A>): (...args: A) => T;
  serialize(dbName?: string): Uint8Array;
  deserialize(buffer: Uint8Array): void;
  createSession(options?: { table?: string, db?: string }): Session;
  applyChangeset(changeset: Uint8Array, options?: ApplyChangesetOptions): boolean;
}

export type Insert<T> = ToJsType<ToInsert<ExcludeComputed<ExtractColumns<T>>>>;
export type Where<T> = ToWhere<ToJsType<ExtractColumns<T>>>;
export type Select<T> = ToJsType<ExtractColumns<T>>;

export function pick<T extends ExtractColumns<BaseTable>, K extends readonly (keyof T)[]>(table: T, columns: K): Pick<T, K[number]>;
export function omit<T extends ExtractColumns<BaseTable>, K extends readonly (keyof T)[]>(table: T, columns: K): Omit<T, K[number]>;

export const functions: SubqueryContext;
