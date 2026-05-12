type ExtractKeys<U> = U extends Record<string, any> ? keyof U : keyof {};

interface Keywords<T, K> {
  orderBy?: K | ((column: T, method: ComputeMethods) => void);
  desc?: boolean;
  limit?: number;
  offset?: number;
  distinct?: boolean;
  log?: boolean | ((info: LogInfo) => void);
}

type ReadQueries<P, T> = Pick<ToQuery<P, T>, 'get' | 'many' | 'query' | 'first' | 'count' | 'avg' | 'sum' | 'min' | 'max' | 'exists'>;

type ObjectFunction = {
  [key: string]: (...args: any) => any;
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
  limit?: number;
  offset?: number;
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
  limit?: number;
  offset?: number;
}

interface GroupArrayKeywords<W, K> {
  where?: W;
  orderBy?: K;
  desc?: boolean;
  limit?: number;
  offset?: number;
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
  max<A extends string>(params: GroupQueryAggregateColumn<A, T, W & ToWhere<{ avg: number }>, K | 'max'>): Array<Pick<T, K> & { [key in A]: number }>;
  max<A extends string>(params: GroupQueryAggregateDistinct<A, T, W & ToWhere<{ avg: number }>, K | 'max'>): Array<Pick<T, K> & { [key in A]: number }>;
  min<A extends string>(params: GroupQueryAggregateColumn<A, T, W & ToWhere<{ avg: number }>, K | 'min'>): Array<Pick<T, K> & { [key in A]: number }>;
  min<A extends string>(params: GroupQueryAggregateDistinct<A, T, W & ToWhere<{ avg: number }>, K | 'min'>): Array<Pick<T, K> & { [key in A]: number }>;
  sum<A extends string>(params: GroupQueryAggregateColumn<A, T, W & ToWhere<{ avg: number }>, K | 'sum'>): Array<Pick<T, K> & { [key in A]: number }>;
  sum<A extends string>(params: GroupQueryAggregateDistinct<A, T, W & ToWhere<{ avg: number }>, K | 'sum'>): Array<Pick<T, K> & { [key in A]: number }>;
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
  abs(n: OnlyNumbers): DbNumber;
  abs(n: NumberParam): NumberResult;
  cast(value: any, to: 'real'): DbNumber;
  cast(value: any, to: 'integer'): DbNumber;
  coalesce<T extends DbAny | DbTypes | DbNull>(a: T, b: T, ...rest: T[]): ToDbType<T>;
  concat(...args: any[]): DbString;
  concatWs(...args: any[]): DbString;
  format(format: OnlyStrings, ...args: any[]): DbString;
  format(format: StringParam, ...args: any[]): StringResult;
  if<T extends DbTypes | DbAny>(...args: IfOddArgs<T>): ToDbType<T>;
  if<T extends DbTypes | DbAny>(...args: IfEvenArgs<T>): ToDbType<T | null>;
  if(...args: any[]): AnyResult;
  instr(a: OnlyStrings, b: OnlyStrings): DbNumber;
  instr(a: StringBlobParam, b: StringBlobParam): NumberResult;
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
  replace(value: OnlyStrings, occurrences: OnlyStrings, substitute: OnlyStrings): DbString;
  replace(value: StringParam, occurrences: StringParam, substitute: StringParam): StringResult;
  round(value: OnlyNumbers, places?: NumberParam): DbNumber;
  round(value: NumberParam, places?: NumberParam): NumberResult;
  rtrim<T extends StringParam>(value: T, remove?: StringParam): T;
  sign(value: OnlyNumbers): -1 | 0 | 1;
  sign(value: any): NumberResult;
  substring<T extends StringParam>(value: T, start: NumberParam, length?: NumberParam): T;
  trim<T extends StringParam>(value: T, remove?: StringParam): T;
  unhex(hex: StringParam, ignore?: StringParam): BlobResult;
  unicode(value: OnlyStrings): DbNumber;
  unicode(value: StringParam): NumberResult;
  upper(value: OnlyStrings): DbString;
  upper(value: StringParam): StringResult;
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
  unixEpoch(time: DateParam, ...modifiers: StringParam[]): StringResult;
  strfTime(format: StringParam, time: DateParam, ...modifiers: StringParam[]): StringResult;
  timeDiff(start: CompatibleDate, end: CompatibleDate): DbString;
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
  highlight(column: DbString, before: string, after: string): DbString;
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
  T extends AnyDateType ? DbString :
  T extends (infer U)[] ? U extends AnyDateType ? DbString[] : U[] :
  T extends object ? { 
    [K in keyof T]: T[K] extends AnyDateType 
      ? DbString : T[K] 
  } : T;

type ToDbType<T> =
  T extends null ? DbNull :
  T extends infer U ? (
    U extends number ? DbNumber :
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
    T extends DefaultNumber ? number :
    T extends DbString ? string :
    T extends PkString ? string :
    T extends ComputedString ? string :
    T extends DefaultString ? string :
    T extends AnyDurationType ? Temporal.Duration :
    T extends AnyInstantType ? Temporal.Instant :
    T extends AnyPlainDateType ? Temporal.PlainDate :
    T extends AnyPlainDateTimeType ? Temporal.PlainDateTime :
    T extends AnyPlainMonthDayType ? Temporal.PlainMonthDay :
    T extends AnyPlainTimeType ? Temporal.PlainTime :
    T extends AnyPlainYearMonthType ? Temporal.PlainYearMonth :
    T extends AnyZonedDateTimeType ? Temporal.ZonedDateTime :
    T extends DbBoolean ? boolean :
    T extends ComputedBoolean ? boolean :
    T extends DefaultBoolean ? boolean :
    T extends DbJson ? Json :
    T extends ComputedJson ? Json :
    T extends DefaultJson ? Json :
    T extends DbBlob ? Uint8Array :
    T extends PkBlob ? Uint8Array :
    T extends ComputedBlob ? Uint8Array :
    T extends DefaultBlob ? Uint8Array :
    T extends string ? string :
    T extends number ? number :
    T extends boolean ? boolean :
    T extends Temporal.Duration ? Temporal.Duration :
    T extends Temporal.Instant ? Temporal.Instant :
    T extends Temporal.PlainDate ? Temporal.PlainDate :
    T extends Temporal.PlainDateTime ? Temporal.PlainDateTime :
    T extends Temporal.PlainMonthDay ? Temporal.PlainMonthDay :
    T extends Temporal.PlainTime ? Temporal.PlainTime :
    T extends Temporal.PlainYearMonth ? Temporal.PlainYearMonth :
    T extends Temporal.ZonedDateTime ? Temporal.ZonedDateTime :
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
  group<T extends AllowedJson>(select: T): ToJson<T>[];
  group<T>(select: ToDbInterface<T>): ToJson<T>[];
  group<T extends AllowedJson>(key: DbString, value: T): Record<string, ToJson<T>>;
  windowGroup<T extends AllowedJson>(options: WindowOptions & { select: T }): ToJson<T>[];
  windowGroup<T>(options: WindowOptions & { select: ToDbInterface<T> }): ToJson<T>[];
  windowGroup<T extends AllowedJson>(options: WindowOptions & { key: DbString, value: T }): Record<string, ToJson<T>>;
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
  insertMany(params: Array<I>): void;
  update(options: UpdateQuery<W, I>): number;
  upsert<K extends keyof T>(options: UpsertQuery<I, K>): R;
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
	like: (pattern: NonNullable<T>) => symbol;
	match: (pattern: NonNullable<T>) => symbol;
	glob: (pattern: NonNullable<T>) => symbol;
	eq: (value: T) => symbol;
}

type UpdateCompareMethods = {
  not<T>(column: T, value: T): DbBoolean;
	gt<T>(column: T, value: NonNullable<T>): DbBoolean;
  gte<T>(column: T, value: NonNullable<T>): DbBoolean;
	lt<T>(column: T, value: NonNullable<T>): DbBoolean;
	lte<T>(column: T, value: NonNullable<T>): DbBoolean;
	like<T>(column: T, pattern: NonNullable<T>): DbBoolean;
	match<T>(column: T, pattern: NonNullable<T>): DbBoolean;
	glob<T>(column: T, pattern: NonNullable<T>): DbBoolean;
	eq<T>(column: T, value: T): DbBoolean;
}

type SymbolCompareMethods<T> = {
  not: (column: symbol, value: T) => DbBoolean;
	gt: (column: symbol, value: NonNullable<T>) => DbBoolean;
  gte: (column: symbol, value: NonNullable<T>) => DbBoolean;
	lt: (column: symbol, value: NonNullable<T>) => DbBoolean;
	lte: (column: symbol, value: NonNullable<T>) => DbBoolean;
	like: (column: symbol, pattern: NonNullable<T>) => DbBoolean;
	match: (column: symbol, pattern: NonNullable<T>) => DbBoolean;
	glob: (column: symbol, pattern: NonNullable<T>) => DbBoolean;
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

type Primitive = string | number | boolean | AnyTemporal;

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

type DbAny = DefaultBoolean | DefaultBlob | AnyDateType | DefaultJson | DefaultNumber | DefaultString | ComputedBoolean | ComputedBlob | ComputedJson | ComputedNumber | ComputedString | PkNumber | PkString | PkBlob | DbNumber | DbString | DbBlob | DbJson | DbBoolean;
type AnyParam = DbAny | DbNull | ComputedNull;

type AllowedJson = DefaultBoolean | AnyDateType | DefaultJson | DefaultNumber | DefaultString | ComputedBoolean | ComputedJson | ComputedNumber | ComputedString | PkNumber | PkString | DbNumber | DbString | DbJson | DbBoolean | DbNull | { [key: string]: AllowedJson } | AllowedJson[];
type SelectType = AllowedJson | AllowedJson[] | SelectType[] | { [key: string | symbol]: AllowedJson };

type OnlyNumbers = number | DbNumber | PkNumber | ComputedNumber | DefaultNumber;
type NumberParam = number | null | DefaultNumber | ComputedNumber | PkNumber | DbNumber | DbNull | ComputedNull;
type NumberResult = DbNumber | DbNull;

type OnlyStrings = string | DbString | PkString | ComputedString | DefaultString;
type StringParam = string | null | PkString | DefaultString | ComputedString | DbString | DbNull | ComputedNull;
type StringResult = DbString | DbNull;

type NumberBlobParam = number | Uint8Array | null | DbNumber | PkNumber | DefaultNumber | ComputedNumber | PkBlob | DefaultBlob | ComputedBlob | DbBlob | DbNull | ComputedNull;
type StringBlobParam = string | Uint8Array | null | DbString | PkString | DefaultString | ComputedString | DbBlob | DbNull | ComputedNull;

type AnyResult = DbString | DbNumber | DateTypes | DbBoolean | DbJson | DbBlob | DbNull;

type BlobResult = DbBlob | DbNull;

type DateParam = number | string | null | DbNumber | DbString | PkNumber | PkString | DefaultNumber | ComputedNumber | ComputedString | CompatibleDate | DbNull;

type BooleanParam = boolean | DbBoolean | ComputedBoolean | DefaultBoolean;
type BooleanResult = DbBoolean | DbNull;

type JsonParam = string | Uint8Array | null | DbString | DbBlob | DbJson | DbNull;
type ExtractResult = DbString | DbNumber | DbBoolean | DbNull;
type JsonResult = DbJson | DbNull;

type DbTypes = number | string | boolean | AnyTemporal | Uint8Array | null;
type DefaultTypes = DefaultNumber | DefaultString | DefaultBoolean | DefaultDateTypes | DefaultBlob;

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
  never;

type PkToDbType<T> = 
  T extends PkNumber ? DbNumber :
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
    ? K extends `${infer First}${infer Rest}`
      ? First extends Uppercase<First>
        ? Rest extends Uncapitalize<Rest>
          ? never
          : K
        : K
      : never
    : never]: IsAny<ToDbType<T[K]>> extends true
      ? DbString
      : ToDefaultType<T[K]>;
};

type PkType = PkNumber | PkString | PkDateTypes | PkBlob;
type ComputedType = ComputedNumber | ComputedString | ComputedDateTypes | ComputedBoolean | ComputedJson | ComputedBlob;

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
  { use<T>(context: T): T } &
  { hint(column: any, table: any): void }

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
  desc?: boolean | DbBoolean | ComputedBoolean;
  offset?: number | ComputedNumber | DbNumber | PkNumber;
  limit?: number | ComputedNumber | DbNumber | PkNumber;
  bm25?: { [key: symbol]: number | ComputedNumber | DbNumber | PkNumber };
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

interface TypedDb<P, C, N> {
  exec(sql: string): void;
  begin(type?: N): void;
  commit(): void;
  rollback(): void;
  migrate(sql: string): void;
  getSchema(): any[];
  diff(schema?: any[]): string;
  first<S extends SelectType, K extends ObjectReturn<S>, T extends (context: SubqueryContext & C) => K>(expression: T): ToJsType<ReturnType<T>['select'] & ReturnType<T>['distinct'] & MakeOptional<NonNullable<ReturnType<T>['maybe']>> & RemoveNull<ReturnType<T>['certain']>> | undefined;
  firstValue<S extends SelectType, K extends ValueReturn<S>, T extends (context: SubqueryContext & C) => K>(expression: T): GetDefined<ReturnType<T>> | undefined;
  query<S extends SelectType, K extends ObjectReturn<S>, T extends (context: SubqueryContext & C) => K>(expression: T): ToJsType<ReturnType<T>['select'] & ReturnType<T>['distinct'] & MakeOptional<NonNullable<ReturnType<T>['maybe']>> & RemoveNull<ReturnType<T>['certain']>>[];
  queryValues<S extends SelectType, K extends ValueReturn<S>, T extends (context: SubqueryContext & C) => K>(expression: T): GetDefined<ReturnType<T>>[];
  subquery<S extends SelectType, K extends ObjectReturn<S>, T extends (context: SubqueryContext & C) => K>(expression: T): ReturnType<T>['select'] & ReturnType<T>['distinct'] & MakeOptional<NonNullable<ReturnType<T>['maybe']>> & RemoveNull<ReturnType<T>['certain']>;
  use<S>(query: S): ReadQueries<P, S>;
}

type ToComputed<T> =
  T extends DbString ? ComputedString :
  T extends DbBoolean ? ComputedBoolean :
  T extends DbDuration ? ComputedDuration :
  T extends DbInstant ? ComputedInstant :
  T extends DbPlainDate ? ComputedPlainDate :
  T extends DbPlainDateTime ? ComputedPlainDateTime :
  T extends DbPlainMonthDay ? ComputedPlainMonthDay :
  T extends DbPlainTime ? ComputedPlainTime :
  T extends DbPlainYearMonth ? ComputedPlainYearMonth :
  T extends DbZonedDateTime ? ComputedZonedDateTime :
  T extends DbNull ? ComputedNull :
  T extends DbJson ? ComputedJson :
  T extends DbNumber ? ComputedNumber :
  T extends boolean ? ComputedBoolean :
  T extends number ? ComputedNumber :
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

interface Null {
  Int: DbNumber | DbNull;
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
  }): GetPrimaryKey<InstanceType<T>> | DbNull;
  References<T extends abstract new (...args: any[]) => any, K extends keyof RemoveUpperCase<InstanceType<T>>>(table: T, options?: {
    column: K,
    onDelete?: ForeignActions,
    onUpdate?: ForeignActions,
    index?: false
  }): PkToDbType<InstanceType<T>[K]> | DbNull;
  Cascade<T extends abstract new (...args: any[]) => any>(table: T, options?: {
    index?: false
  }): GetPrimaryKey<InstanceType<T>> | DbNull;
  Cascade<T extends abstract new (...args: any[]) => any, K extends keyof RemoveUpperCase<InstanceType<T>>>(table: T, options?: {
    column: K,
    index?: false
  }): PkToDbType<InstanceType<T>[K]> | DbNull;

  Default<T extends Primitive>(value: T): ToDefaultType<T> | DbNull;
}

interface Now {
  Instant: DbInstant;
  PlainDate: DbPlainDate;
  PlainDateTime: DbPlainDateTime;
  PlainTime: DbPlainTime;
  ZonedDateTime: DbZonedDateTime;
}

interface NullNow {
  Instant: DefaultInstant | DbNull;
  PlainDate: DefaultPlainDate | DbNull;
  PlainDateTime: DefaultPlainDateTime | DbNull;
  PlainTime: DefaultPlainTime | DbNull;
  ZonedDateTime: DefaultZonedDateTime | DbNull;
}

export class BaseTable {
  Int: DbNumber;
  IntPrimary: PkNumber;
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

  Function<T>(type: T, lambda: () => ToDbType<T>): T;

  References<T extends abstract new (...args: any[]) => any>(table: T, options?: {
    onDelete?: ForeignActions,
    onUpdate?: ForeignActions,
    index?: false
  }): GetPrimaryKey<InstanceType<T>>;
  References<T extends abstract new (...args: any[]) => any, K extends keyof RemoveUpperCase<InstanceType<T>>>(table: T, options?: {
    column: K,
    onDelete?: ForeignActions,
    onUpdate?: ForeignActions,
    index?: false
  }): PkToDbType<InstanceType<T>[K]>;
  Cascade<T extends abstract new (...args: any[]) => any>(table: T, options?: {
    index?: false
  }): GetPrimaryKey<InstanceType<T>>;
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
  Default<T extends Primitive>(value: T): ToDefaultType<T>;

  Abs(n: OnlyNumbers): ToComputed<DbNumber>;
  Abs(n: NumberParam): ToComputed<NumberResult>;
  Cast(value: any, to: 'real'): ToComputed<DbNumber>;
  Cast(value: any, to: 'integer'): ToComputed<DbNumber>;
  Coalesce<T extends DbAny | DbTypes | DbNull>(a: T, b: T, ...rest: T[]): ToComputed<T>;
  Concat(...args: any[]): ToComputed<DbString>;
  ConcatWs(...args: any[]): ToComputed<DbString>;
  Format(format: OnlyStrings, ...args: any[]): ToComputed<DbString>;
  Format(format: StringParam, ...args: any[]): ToComputed<StringResult>;
  If<T extends DbTypes | DbAny>(...args: IfOddArgs<T>): ToComputed<ToDbType<T>>;
  If<T extends DbTypes | DbAny>(...args: IfEvenArgs<T>): ToComputed<ToDbType<T | null>>;
  If(...args: any[]): ToComputed<AnyResult>;
  Instr(a: OnlyStrings, b: OnlyStrings): ToComputed<DbNumber>;
  Instr(a: StringBlobParam, b: StringBlobParam): ToComputed<NumberResult>;
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
  Replace(value: OnlyStrings, occurrences: OnlyStrings, substitute: OnlyStrings): ToComputed<DbString>;
  Replace(value: StringParam, occurrences: StringParam, substitute: StringParam): ToComputed<StringResult>;
  Round(value: OnlyNumbers, places?: NumberParam): ToComputed<DbNumber>;
  Round(value: NumberParam, places?: NumberParam): ToComputed<NumberResult>;
  Rtrim<T extends StringParam>(value: T, remove?: StringParam): ToComputed<T>;
  Sign(value: OnlyNumbers): ToComputed<-1 | 0 | 1>;
  Sign(value: any): ToComputed<NumberResult>;
  Substring<T extends StringParam>(value: T, start: NumberParam, length?: NumberParam): ToComputed<T>;
  Trim<T extends StringParam>(value: T, remove?: StringParam): ToComputed<T>;
  Unhex(hex: StringParam, ignore?: StringParam): ToComputed<BlobResult>;
  Unicode(value: OnlyStrings): ToComputed<DbNumber>;
  Unicode(value: StringParam): ToComputed<NumberResult>;
  Upper(value: OnlyStrings): ToComputed<DbString>;
  Upper(value: StringParam): ToComputed<StringResult>;
  ToDate(): ToComputed<DbString>;
  ToDate(time: CompatibleDate): ToComputed<DbString>;
  ToDate(time: DateParam, ...modifiers: StringParam[]): ToComputed<StringResult>;
  Time(): ToComputed<DbString>;
  Time(time: CompatibleDate): ToComputed<DbString>;
  Time(time: DateParam, ...modifiers: StringParam[]): ToComputed<StringResult>;
  DateTime(): ToComputed<DbString>;
  DateTime(time: CompatibleDate): ToComputed<DbString>;
  DateTime(time: DateParam, ...modifiers: StringParam[]): ToComputed<StringResult>;
  JulianDay(): ToComputed<DbNumber>;
  JulianDay(time: CompatibleDate): ToComputed<DbNumber>;
  JulianDay(time: DateParam, ...modifiers: StringParam[]): ToComputed<NumberResult>;
  UnixEpoch(): ToComputed<DbNumber>;
  UnixEpoch(time: CompatibleDate): ToComputed<DbNumber>;
  UnixEpoch(time: DateParam, ...modifiers: StringParam[]): ToComputed<StringResult>;
  StrfTime(format: StringParam, time: DateParam, ...modifiers: StringParam[]): ToComputed<StringResult>;
  TimeDiff(start: CompatibleDate, end: CompatibleDate): ToComputed<DbString>;
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
  Unindexed: DbString;
}

export class ExternalFTSTable extends FTSTable {
  ExternalRowId?: PkNumber | DbNumber;
}

export class Database {
  constructor(path?: string | URL, options?: SQLiteConfig);
  getClient<T extends abstract new (...args: any[]) => any, C extends { [key: string]: T }>(classes: C): TypedDb<MakeClient<C>, MakeContext<C>, 'deferred' | 'immediate'> & MakeClient<C>;
  run(args: { query: any, params?: any }): number;
  all<T>(args: { query: any, params?: any, options?: QueryOptions }): Array<T>;
  exec(query: string): void;
  begin(): void;
  commit(): void;
  rollback(): void;
  close(): void;
}

export type Insert<T> = ToJsType<ToInsert<ExcludeComputed<ExtractColumns<T>>>>;
export type Where<T> = ToWhere<ToJsType<ExtractColumns<T>>>;
export type Select<T> = ToJsType<ExtractColumns<T>>;

export function pick<T extends ExtractColumns<BaseTable>, K extends readonly (keyof T)[]>(table: T, columns: K): Pick<T, K[number]>;
export function omit<T extends ExtractColumns<BaseTable>, K extends readonly (keyof T)[]>(table: T, columns: K): Omit<T, K[number]>;
