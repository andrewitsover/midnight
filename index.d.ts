import { PathLike } from 'node:fs';
import { FunctionOptions, Session, ApplyChangesetOptions } from 'node:sqlite';

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
  [K in keyof T]: T[K] | ((column: T) => void);
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

type DateModifierKeyword =
  | 'ceiling'
  | 'floor'
  | 'start of month'
  | 'start of year'
  | 'start of day'
  | 'unixepoch'
  | 'julianday'
  | 'auto'
  | 'localtime'
  | 'utc'
  | 'subsec'
  | 'subsecond';

type Sign = '+' | '-';

type DurationUnit =
  | 'days'
  | 'hours'
  | 'minutes'
  | 'seconds'
  | 'months'
  | 'years';

type DurationModifier = `${number} ${DurationUnit}`;

type HH = `${number}${number}`;
type MM = `${number}${number}`;
type SS = `${number}${number}`;

type TimeOffsetModifier =
  | `${Sign}${HH}:${MM}`
  | `${Sign}${HH}:${MM}:${SS}`
  | `${Sign}${HH}:${MM}:${SS}.${number}`;

type YYYY = `${number}${number}${number}${number}`;
type MM2 = `${number}${number}`;
type DD = `${number}${number}`;

type DatePart = `${YYYY}-${MM2}-${DD}`;

type DateModifier =
  | `${Sign}${DatePart}`
  | `${Sign}${DatePart} ${HH}:${MM}`
  | `${Sign}${DatePart} ${HH}:${MM}:${SS}`
  | `${Sign}${DatePart} ${HH}:${MM}:${SS}.${number}`;

type WeekdayModifier = `weekday ${number}`;

type Modifier =
  | DateModifierKeyword
  | DurationModifier
  | TimeOffsetModifier
  | DateModifier
  | WeekdayModifier;

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
  T extends AnyStringType ? DbString :
  T extends AnyNumberType ? DbNumber :
  T extends AnyBigIntType ? DbBigInt :
  T extends AnyBlobType ? DbBlob :
  T extends AnyBooleanType ? DbBoolean :
  T extends AnyDurationType ? DbDuration :
  T extends AnyInstantType ? DbInstant :
  T extends AnyPlainDateType ? DbPlainDate :
  T extends AnyPlainDateTimeType ? DbPlainDateTime :
  T extends AnyPlainMonthDayType ? DbPlainMonthDay :
  T extends AnyPlainTimeType ? DbPlainTime :
  T extends AnyPlainYearMonthType ? DbPlainYearMonth :
  T extends AnyZonedDateTimeType ? DbZonedDateTime :
  T extends number ? DbNumber :
  T extends bigint ? DbBigInt :
  T extends string ? DbString :
  T extends Temporal.Duration ? DbDuration :
  T extends Temporal.Instant ? DbInstant :
  T extends Temporal.PlainDate ? DbPlainDate :
  T extends Temporal.PlainDateTime ? DbPlainDateTime :
  T extends Temporal.PlainMonthDay ? DbPlainMonthDay :
  T extends Temporal.PlainTime ? DbPlainTime :
  T extends Temporal.PlainYearMonth ? DbPlainYearMonth :
  T extends Temporal.ZonedDateTime ? DbZonedDateTime :
  T extends boolean ? DbBoolean :
  T extends null ? DbNull :
  T extends Json ? DbJson :
  T;

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
  T extends DbNull ? null :
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
  lag<T extends AnyParam>(options: WindowOptions & LagOptions<T>): T;
  lead<T extends AnyParam>(options: WindowOptions & LagOptions<T>): T;
  firstValue<T extends AnyParam>(options: WindowOptions & { expression: T }): T;
  lastValue<T extends AnyParam>(options: WindowOptions & { expression: T }): T;
  nthValue<T extends AnyParam>(options: WindowOptions & { expression: T, row: number | DbNumber }): T;
  group<T extends AllowedJson>(select: T): T[];
  group<T>(select: ToDbInterface<T>): T[];
  group<T extends AllowedJson>(key: DbString, value: T): Record<string, T>;
  windowGroup<T extends AllowedJson>(options: WindowOptions & { select: T }): T[];
  windowGroup<T>(options: WindowOptions & { select: ToDbInterface<T> }): T[];
  windowGroup<T extends AllowedJson>(options: WindowOptions & { key: DbString, value: T }): Record<string, T>;
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

declare const intDefault1: unique symbol;
declare const intDefault2: unique symbol;

type DefaultNumber = typeof intDefault1 | typeof intDefault2;

declare const bigIntPk1: unique symbol;
declare const bigIntPk2: unique symbol;

type PkBigInt = typeof bigIntPk1 | typeof bigIntPk2;

declare const bigIntDefault1: unique symbol;
declare const bigIntDefault2: unique symbol;

type DefaultBigInt = typeof bigIntDefault1 | typeof bigIntDefault2;

declare const stringPk1: unique symbol;
declare const stringPk2: unique symbol;

type PkString = typeof stringPk1 | typeof stringPk2;

declare const stringDefault1: unique symbol;
declare const stringDefault2: unique symbol;

type DefaultString = typeof stringDefault1 | typeof stringDefault2;

declare const blobPk1: unique symbol;
declare const blobPk2: unique symbol;

type PkBlob = typeof blobPk1 | typeof blobPk2;

declare const blobDefault1: unique symbol;
declare const blobDefault2: unique symbol;

type DefaultBlob = typeof blobDefault1 | typeof blobDefault2;

declare const boolDefault1: unique symbol;
declare const boolDefault2: unique symbol;

type DefaultBoolean = typeof boolDefault1 | typeof boolDefault2;

declare const jsonDefault1: unique symbol;
declare const jsonDefault2: unique symbol;

type DefaultJson = typeof jsonDefault1 | typeof jsonDefault2;

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

type DateTypes = DbDuration | DbInstant | DbPlainDate | DbPlainDateTime | DbPlainMonthDay | DbPlainTime | DbPlainYearMonth | DbZonedDateTime;
type PkDateTypes = PkDuration | PkInstant | PkPlainDate | PkPlainDateTime | PkPlainMonthDay | PkPlainTime | PkPlainYearMonth | PkZonedDateTime;
type DefaultDateTypes = DefaultDuration | DefaultInstant | DefaultPlainDate | DefaultPlainDateTime | DefaultPlainMonthDay | DefaultPlainTime | DefaultPlainYearMonth | DefaultZonedDateTime;
type AnyDateType = DateTypes | PkDateTypes | DefaultDateTypes;
type CompatibleDateTypes = DbInstant | DbPlainDate | DbPlainDateTime | DbPlainMonthDay | DbPlainTime | DbPlainYearMonth;
type CompatiblePrimaryDateTypes = PkInstant | PkPlainDate | PkPlainDateTime | PkPlainMonthDay | PkPlainTime | PkPlainYearMonth;
type CompatibleDefaultDateTypes = DefaultInstant | DefaultPlainDate | DefaultPlainDateTime | DefaultPlainMonthDay | DefaultPlainTime | DefaultPlainYearMonth;
type CompatibleDate = CompatibleDateTypes | CompatiblePrimaryDateTypes | CompatibleDefaultDateTypes;

type AnyDurationType = DefaultDuration | PkDuration | DbDuration;
type AnyInstantType = DefaultInstant | PkInstant | DbInstant;
type AnyPlainDateType = DefaultPlainDate | PkPlainDate | DbPlainDate;
type AnyPlainDateTimeType = DefaultPlainDateTime | PkPlainDateTime | DbPlainDateTime;
type AnyPlainMonthDayType = DefaultPlainMonthDay | PkPlainMonthDay | DbPlainMonthDay;
type AnyPlainTimeType = DefaultPlainTime | PkPlainTime | DbPlainTime;
type AnyPlainYearMonthType = DefaultPlainYearMonth | PkPlainYearMonth | DbPlainYearMonth;
type AnyZonedDateTimeType = DefaultZonedDateTime | PkZonedDateTime | DbZonedDateTime;
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

type AnyNumberType = DbNumber | DefaultNumber | PkNumber;
type AnyBigIntType = DbBigInt | DefaultBigInt | PkBigInt;
type AnyBooleanType = DbBoolean | DefaultBoolean;
type AnyStringType = DbString | DefaultString | PkString;
type AnyBlobType = DbBlob | DefaultBlob | PkBlob;
type AnyJsonType = DbJson | DefaultJson;

type DbAny = AnyNumberType | AnyBigIntType | AnyBooleanType | AnyStringType | AnyBlobType | AnyJsonType | AnyDateType;
type AnyParam = DbAny | DbNull;

type AllowedJson = AnyNumberType | AnyBigIntType | AnyBooleanType | AnyStringType | AnyBlobType | AnyJsonType | AnyDateType | DbNull | { [key: string]: AllowedJson | Primitive | null } | AllowedJson[];
type SelectType = (() => SelectType) | Primitive | AllowedJson | AllowedJson[] | SelectType[] | { [key: string | symbol]: AllowedJson | Primitive | (() => SelectType) };

type Numeric = number | bigint | AnyNumberType | AnyBigIntType;
type NumericParam = number | bigint | AnyNumberType | null | DbNull;
type NumberResult = DbNumber | DbNull;

type OnlyStrings = string | AnyStringType;
type StringParam = string | AnyStringType | null | DbNull;
type StringResult = DbString | DbNull;

type NumberBlobParam = number | Uint8Array | null | AnyNumberType | AnyBlobType | DbNull;
type StringBlobParam = string | Uint8Array | null | AnyStringType | AnyBlobType | DbNull;

type AnyResult = DbString | DbNumber | DbBigInt | DateTypes | DbBoolean | DbJson | DbBlob | DbNull;

type DateParam = number | string | null | AnyStringType | AnyNumberType | CompatibleDate | DbNull;

type BooleanParam = boolean | AnyBooleanType;

type JsonParam = string | Uint8Array | null | DbString | DbBlob | DbJson | DbNull;
type ExtractResult = DbString | DbNumber | DbBoolean | DbNull;

type DbTypes = number | bigint | string | boolean | AnyTemporal | Uint8Array | null;
type DefaultTypes = DefaultNumber | DefaultBigInt | DefaultString | DefaultBoolean | DefaultDateTypes | DefaultBlob;

type ParamType = PrimitiveNull | AnyParam;

type ToNumericResult<T> =
  T extends bigint | AnyBigIntType ? DbBigInt :
  T extends number | AnyNumberType ? DbNumber :
  T extends null | DbNull ? DbNull :
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
  [K in StringKeys<T>]:
    IsAny<ToDbType<T[K]>> extends true
      ? DbString
      : ToDefaultType<T[K]>;
};

type PkType = PkNumber | PkBigInt | PkString | PkDateTypes | PkBlob;

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

type QueryCompareTypes = AnyTemporal | number | bigint | boolean | null | string | Uint8Array | symbol;

type MakeOptional<T> = {
  [K in keyof T]:
    T[K] extends object
      ? T[K]
      : T[K] | DbNull;
};

type StringKeys<T> = Exclude<keyof T, symbol>;

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
  rank?: boolean | DbBoolean;
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

type ForeignActions = 'no action' | 'restrict' | 'set null' | 'set default' | 'cascade';

type TypedJson = AnyParam | { [key: string]: AnyParam | TypedJson | TypedJson[] };

export class BaseTable {}

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
  [prefix]?: number | number[];
  [tokenizer]?: Unicode61 | Ascii | Trigram;
}

export class ExternalFTSTable extends FTSTable {
  [externalRowId]?: PkNumber | DbNumber;
}

interface FunctionArgs<T, A> {
  returnType: T;
  options?: FunctionOptions;
  function: (...args: A) => ToJsType<T> | undefined;
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

type ToType<T> = ToJsType<T> | null | T | DbNull;

type NumberType = ToType<AnyNumberType>;
type BigIntType = ToType<AnyBigIntType>;
type StringType = ToType<AnyStringType>;
type BlobType = ToType<AnyBlobType>;
type BooleanType = ToType<AnyBooleanType>;
type DurationType = ToType<AnyDurationType>;
type InstantType = ToType<AnyInstantType>;
type PlainDateType = ToType<AnyPlainDateType>;
type PlainDateTimeType = ToType<AnyPlainDateTimeType>;
type PlainMonthDayType = ToType<AnyPlainMonthDayType>;
type PlainTimeType = ToType<AnyPlainTimeType>;
type PlainYearMonthType = ToType<AnyPlainYearMonthType>;
type ZonedDateTimeType = ToType<AnyZonedDateTimeType>;

export function pick<T extends ExtractColumns<BaseTable>, K extends readonly (keyof T)[]>(table: T, columns: K): Pick<T, K[number]>;
export function omit<T extends ExtractColumns<BaseTable>, K extends readonly (keyof T)[]>(table: T, columns: K): Omit<T, K[number]>;
export function abs<T extends NumericParam>(n: T): ToDbType<T>;
export function cast(value: any, to: 'real' | 'integer'): DbNumber;
export function coalesce<A extends NumberType, B extends NumberType, T extends readonly NumberType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function coalesce<A extends BigIntType, B extends BigIntType, T extends readonly BigIntType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function coalesce<A extends StringType, B extends StringType, T extends readonly StringType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function coalesce<A extends BlobType, B extends BlobType, T extends readonly BlobType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function coalesce<A extends BooleanType, B extends BooleanType, T extends readonly BooleanType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function coalesce<A extends DurationType, B extends DurationType, T extends readonly DurationType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function coalesce<A extends InstantType, B extends InstantType, T extends readonly InstantType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function coalesce<A extends PlainDateType, B extends PlainDateType, T extends readonly PlainDateType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function coalesce<A extends PlainDateTimeType, B extends PlainDateTimeType, T extends readonly PlainDateTimeType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function coalesce<A extends PlainMonthDayType, B extends PlainMonthDayType, T extends readonly PlainMonthDayType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function coalesce<A extends PlainTimeType, B extends PlainTimeType, T extends readonly PlainTimeType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function coalesce<A extends PlainYearMonthType, B extends PlainYearMonthType, T extends readonly PlainYearMonthType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function coalesce<A extends ZonedDateTimeType, B extends ZonedDateTimeType, T extends readonly ZonedDateTimeType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function concat(...args: any[]): DbString;
export function concatWs(...args: any[]): DbString;
export function format<T extends StringParam>(format: T, ...args: any[]): ToDbType<T>;
export function iif<A extends DbTypes | AnyParam>(when: BooleanParam, then: A): ToDbType<A | null>;
export function iif<A extends DbTypes | AnyParam, B extends DbTypes | AnyParam>(when1: BooleanParam, then1: A, when2: BooleanParam, then2: B): ToDbType<A | B | null>;
export function iif<A extends DbTypes | AnyParam, B extends DbTypes | AnyParam>(when: BooleanParam, then: A, otherwise: B): ToDbType<A | B>;
export function iif<A extends DbTypes | AnyParam, B extends DbTypes | AnyParam, C extends DbTypes | AnyParam, D extends DbTypes | AnyParam>(when1: BooleanParam, then1: A, otherwise1: B, when2: BooleanParam, then2: C, otherwise2: D): ToDbType<A | B | C | D>;
export function iif(...args: any[]): AnyResult;
export function instr(a: OnlyStrings, b: OnlyStrings): DbNumber;
export function instr(a: StringBlobParam, b: StringBlobParam): DbNumber | DbNull;
export function length(value: any): DbNumber | DbNull;
export function lower<T extends StringParam>(value: T): ToDbType<T>;
export function ltrim(value: StringParam, remove?: StringParam): DbString | DbNull;
export function max<A extends NumberType, B extends NumberType, T extends readonly NumberType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function min<A extends NumberType, B extends NumberType, T extends readonly NumberType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function max<A extends BigIntType, B extends BigIntType, T extends readonly BigIntType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function min<A extends BigIntType, B extends BigIntType, T extends readonly BigIntType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function max<A extends StringType, B extends StringType, T extends readonly StringType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function min<A extends StringType, B extends StringType, T extends readonly StringType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function max<A extends BlobType, B extends BlobType, T extends readonly BlobType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function min<A extends BlobType, B extends BlobType, T extends readonly BlobType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function max<A extends InstantType, B extends InstantType, T extends readonly InstantType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function min<A extends InstantType, B extends InstantType, T extends readonly InstantType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function max<A extends PlainDateType, B extends PlainDateType, T extends readonly PlainDateType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function min<A extends PlainDateType, B extends PlainDateType, T extends readonly PlainDateType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function max<A extends PlainDateTimeType, B extends PlainDateTimeType, T extends readonly PlainDateTimeType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function min<A extends PlainDateTimeType, B extends PlainDateTimeType, T extends readonly PlainDateTimeType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function max<A extends PlainMonthDayType, B extends PlainMonthDayType, T extends readonly PlainMonthDayType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function min<A extends PlainMonthDayType, B extends PlainMonthDayType, T extends readonly PlainMonthDayType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function max<A extends PlainTimeType, B extends PlainTimeType, T extends readonly PlainTimeType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function min<A extends PlainTimeType, B extends PlainTimeType, T extends readonly PlainTimeType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function max<A extends PlainYearMonthType, B extends PlainYearMonthType, T extends readonly PlainYearMonthType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function min<A extends PlainYearMonthType, B extends PlainYearMonthType, T extends readonly PlainYearMonthType[]>(a: A, b: B, ...rest: T): ToDbType<A | B | T[number]>;
export function nullif<T>(a: T, b: any): ToDbType<T> | DbNull;
export function octetLength(value: any): DbNumber | DbNull;
export function replace<T extends StringParam>(value: T, occurrences: T, substitute: T): ToDbType<T>;
export function round<T extends Numeric>(value: T, places?: NumericParam): ToDbType<T>;
export function rtrim<T extends StringParam>(value: T, remove?: StringParam): T;
export function sign(value: Numeric): -1 | 0 | 1;
export function substring<T extends StringParam>(value: T, start: NumericParam, length?: NumericParam): T;
export function trim<T extends StringParam>(value: T, remove?: StringParam): T;
export function unhex(hex: StringParam, ignore?: StringParam): DbBlob | DbNull;
export function unicode(value: OnlyStrings): DbNumber;
export function unicode(value: StringParam): DbNumber | DbNull;
export function upper<T extends StringParam>(value: T): ToDbType<T>;
export function date(): DbString;
export function date(time: AnyDateType, ...modifiers: Modifier[]): DbString;
export function date(time: DateParam, ...modifiers: Modifier[]): DbString | DbNull;
export function time(): DbString;
export function time(modifier: 'subsec' | 'subsecond'): DbString;
export function time(time: AnyDateType, ...modifiers: Modifier[]): DbString;
export function time(time: DateParam, ...modifiers: Modifier[]): DbString | DbNull;
export function dateTime(): DbString;
export function dateTime(time: CompatibleDate, ...modifiers: Modifier[]): DbString;
export function dateTime(time: DateParam, ...modifiers: Modifier[]): DbString | DbNull;
export function julianDay(): DbNumber;
export function julianDay(time: CompatibleDate, ...modifiers: Modifier[]): DbNumber;
export function julianDay(time: DateParam, ...modifiers: Modifier[]): DbNumber | DbNull;
export function unixEpoch(): DbNumber;
export function unixEpoch(modifier: 'subsec' | 'subsecond'): DbNumber;
export function unixEpoch(time: CompatibleDate, ...modifiers: Modifier[]): DbNumber;
export function unixEpoch(time: DateParam, ...modifiers: Modifier[]): DbNumber | DbNull;
export function strfTime(format: StringParam, time: DateParam, ...modifiers: StringParam[]): DbString | DbNull;
export function timeDiff(start: CompatibleDate, end: CompatibleDate): DbString;
export function timeDiff(start: DateParam, end: DateParam): DbString | DbNull;
export function acos(value: NumericParam): DbNumber | DbNull;
export function acosh(value: NumericParam): DbNumber | DbNull;
export function asin(value: NumericParam): DbNumber | DbNull;
export function asinh(value: NumericParam): DbNumber | DbNull;
export function atan(value: NumericParam): DbNumber | DbNull;
export function atan2(b: NumericParam, a: NumericParam): DbNumber | DbNull;
export function atanh(value: NumericParam): DbNumber | DbNull;
export function ceil<T extends NumericParam>(value: T): ToDbType<T>;
export function cos<T extends NumericParam>(value: T): ToDbType<T>;
export function cosh(value: NumericParam): DbNumber | DbNull;
export function degrees(value: NumericParam): DbNumber | DbNull;
export function exp(value: NumericParam): DbNumber | DbNull;
export function floor<T extends NumericParam>(value: T): ToDbType<T>;
export function ln(value: NumericParam): DbNumber | DbNull;
export function log(base: NumericParam, value: NumericParam): DbNumber | DbNull;
export function mod(value: NumericParam, divider: NumericParam): DbNumber | DbNull;
export function pi(): DbNumber;
export function power(value: NumericParam, exponent: NumericParam): DbNumber | DbNull;
export function radians(value: NumericParam): DbNumber | DbNull;
export function sin(value: Numeric): DbNumber;
export function sin(value: NumericParam): DbNumber | DbNull;
export function sinh(value: NumericParam): DbNumber | DbNull;
export function sqrt(value: NumericParam): DbNumber | DbNull;
export function tan(value: NumericParam): DbNumber | DbNull;
export function tanh(value: NumericParam): DbNumber | DbNull;
export function trunc<T extends NumericParam>(value: T): ToDbType<T>;
export function toJson(param: JsonParam | any[]): DbString | DbNull;
export function extract(json: JsonParam | any[], path: string): DbString | DbNumber | DbNull;
export function extract<T, S extends (json: T) => any>(json: T, extractor: S): ReturnType<S>;
export function each<T extends unknown[], S extends (json: T[number]) => EachSelector>(json: T, extractor: S): ReturnType<S>['select'][];
export function plus<A extends NumberType, B extends NumberType, T extends readonly NumberType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function plus<A extends BigIntType, B extends BigIntType, T extends readonly BigIntType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function minus<A extends NumberType, B extends NumberType, T extends readonly NumberType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function minus<A extends BigIntType, B extends BigIntType, T extends readonly BigIntType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function divide<A extends NumberType, B extends NumberType, T extends readonly NumberType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function divide<A extends BigIntType, B extends BigIntType, T extends readonly BigIntType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function multiply<A extends NumberType, B extends NumberType, T extends readonly NumberType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function multiply<A extends BigIntType, B extends BigIntType, T extends readonly BigIntType[]>(a: A, b: B, ...args: T): ToDbType<A | B | T[number]>;
export function object<T extends { [key: string]: AllowedJson }>(select: T): ToDbType<T>;
export function arrayLength(param: JsonParam | any[]): DbNumber | DbNull;
export function highlight(column: DbString, before: string, after: string): DbString;
export function symbol<T>(json: T): T extends DbNull ? DbJson | DbNull : DbJson;
export function not(value: QueryCompareTypes | QueryCompareTypes[]): symbol;
export function gt(value: NonNullable<QueryCompareTypes>): symbol;
export function gte(value: NonNullable<QueryCompareTypes>): symbol;
export function lt(value: NonNullable<QueryCompareTypes>): symbol;
export function lte(value: NonNullable<QueryCompareTypes>): symbol;
export function like(pattern: string | AnyStringType | RegExp): symbol;
export function match(pattern: string | AnyStringType): symbol;
export function glob(pattern: string | AnyStringType): symbol;
export function eq(value: QueryCompareTypes): symbol;
export function not(column: symbol, value: QueryCompareTypes): DbBoolean;
export function gt(column: symbol, value: NonNullable<QueryCompareTypes>): DbBoolean;
export function gte(column: symbol, value: NonNullable<QueryCompareTypes>): DbBoolean;
export function lt(column: symbol, value: NonNullable<QueryCompareTypes>): DbBoolean;
export function lte(column: symbol, value: NonNullable<QueryCompareTypes>): DbBoolean;
export function like(column: symbol, pattern: string | AnyStringType | RegExp): DbBoolean;
export function match(column: symbol, pattern: string | AnyStringType): DbBoolean;
export function glob(column: symbol, pattern: string | AnyStringType): DbBoolean;
export function eq(column: symbol, value: QueryCompareTypes): DbBoolean;
export function count(): DbNumber;
export function count(column: AnyResult): DbNumber;
export function count(options: WindowOptions & { distinct: AnyResult }): DbNumber;
export function count(options: WindowOptions & { column: AnyResult }): DbNumber;
export function min<T extends AnyParam>(column: T): T;
export function min<T extends AnyParam>(options: WindowOptions & { distinct: T }): T;
export function min<T extends AnyParam>(options: WindowOptions & { column: T }): T;
export function max<T extends AnyParam>(column: T): T;
export function max<T extends AnyParam>(options: WindowOptions & { distinct: T }): T;
export function max<T extends AnyParam>(options: WindowOptions & { column: T }): T;
export function avg<T extends NumberResult>(column: T): T;
export function avg<T extends NumberResult>(options: WindowOptions & { distinct: T }): T;
export function avg<T extends NumberResult>(options: WindowOptions & { column: T }): T;
export function sum<T extends NumberResult>(column: T): T;
export function sum<T extends NumberResult>(options: WindowOptions & { distinct: T }): T;
export function sum<T extends NumberResult>(options: WindowOptions & { column: T }): T;
export function rowNumber(options?: WindowOptions): DbNumber;
export function rank(options?: WindowOptions): DbNumber;
export function denseRank(options?: WindowOptions): DbNumber;
export function percentRank(options?: WindowOptions): DbNumber;
export function cumeDist(options?: WindowOptions): DbNumber;
export function ntile(options: WindowOptions & { groups: number | DbNumber }): DbNumber;
export function lag<T extends AnyParam>(options: WindowOptions & LagOptions<T>): T;
export function lead<T extends AnyParam>(options: WindowOptions & LagOptions<T>): T;
export function firstValue<T extends AnyParam>(options: WindowOptions & { expression: T }): T;
export function lastValue<T extends AnyParam>(options: WindowOptions & { expression: T }): T;
export function nthValue<T extends AnyParam>(options: WindowOptions & { expression: T, row: number | DbNumber }): T;
export function group<T extends AllowedJson>(select: T): T[];
export function group<T>(select: ToDbInterface<T>): T[];
export function group<T extends AllowedJson>(key: DbString, value: T): Record<string, T>;
export function windowGroup<T extends AllowedJson>(options: WindowOptions & { select: T }): T[];
export function windowGroup<T>(options: WindowOptions & { select: ToDbInterface<T> }): T[];
export function windowGroup<T extends AllowedJson>(options: WindowOptions & { key: DbString, value: T }): Record<string, T>;

export declare const attributes: unique symbol;
export declare const prefix: unique symbol;
export declare const tokenizer: unique symbol;
export declare const externalRowId: unique symbol;

export const text: DbString;
export const int: DbNumber;
export const real: DbNumber;
export const bool: DbBoolean;
export const json: DbJson;
export const bigInt: DbBigInt;
export const blob: DbBlob;
export const duration: DbDuration;
export const instant: DbInstant;
export const plainDate: DbPlainDate;
export const plainDateTime: DbPlainDateTime;
export const plainTime: DbPlainTime;
export const plainYearMonth: DbPlainYearMonth;
export const zonedDateTime: DbZonedDateTime;
export const unindexed: DbString;

interface Now {
  instant: DefaultInstant;
  plainDate: DefaultPlainDate;
  plainDateTime: DefaultPlainDateTime;
  plainTime: DefaultPlainTime;
  zonedDateTime: DefaultZonedDateTime;
}

interface NilNow {
  instant: DefaultInstant | DbNull;
  plainDate: DefaultPlainDate | DbNull;
  plainDateTime: DefaultPlainDateTime | DbNull;
  plainTime: DefaultPlainTime | DbNull;
  zonedDateTime: DefaultZonedDateTime | DbNull;
}

export const now: Now;

interface Nil {
  text: DbString | DbNull;
  int: DbNumber | DbNull;
  real: DbNumber | DbNull;
  bool: DbBoolean | DbNull;
  json: DbJson | DbNull;
  bigInt: DbBigInt | DbNull;
  blob: DbBlob | DbNull;
  duration: DbDuration | DbNull;
  instant: DbInstant | DbNull;
  plainDate: DbPlainDate | DbNull;
  plainDateTime: DbPlainDateTime | DbNull;
  plainTime: DbPlainTime | DbNull;
  plainYearMonth: DbPlainYearMonth | DbNull;
  zonedDateTime: DbZonedDateTime | DbNull;

  now: NilNow;

  references<T extends abstract new (...args: any[]) => any>(table: T, options?: {
    onDelete?: ForeignActions,
    onUpdate?: ForeignActions,
    index?: false
  }): GetPrimaryKey<RemoveUpperCase<InstanceType<T>>> | DbNull;
  references<T extends abstract new (...args: any[]) => any, K extends keyof RemoveUpperCase<InstanceType<T>>>(table: T, options?: {
    column: K,
    onDelete?: ForeignActions,
    onUpdate?: ForeignActions,
    index?: false
  }): PkToDbType<InstanceType<T>[K]> | DbNull;
  cascade<T extends abstract new (...args: any[]) => any>(table: T, options?: {
    index?: false
  }): GetPrimaryKey<RemoveUpperCase<InstanceType<T>>> | DbNull;
  cascade<T extends abstract new (...args: any[]) => any, K extends keyof RemoveUpperCase<InstanceType<T>>>(table: T, options?: {
    column: K,
    index?: false
  }): PkToDbType<InstanceType<T>[K]> | DbNull;

  default<T extends PrimitiveNull>(value: T): ToDefaultType<T> | DbNull;

  typedArray<T extends TypedJson>(type: T): T[] | DbNull;
  typedObject<T extends TypedJson>(type: T): T | DbNull;
}

export const nil: Nil;

interface Primary {
  text: PkString;
  int: PkNumber;
  real: PkNumber;
  bigInt: PkBigInt;
  blob: PkBlob;
  duration: PkDuration;
  instant: PkInstant;
  plainDate: PkPlainDate;
  plainDateTime: PkPlainDateTime;
  plainTime: PkPlainTime;
  plainYearMonth: PkPlainYearMonth;
  zonedDateTime: PkZonedDateTime;
}

export const primary: Primary;

export function references<T extends abstract new (...args: any[]) => any>(table: T, options?: {
    onDelete?: ForeignActions,
    onUpdate?: ForeignActions,
    index?: false
  }): GetPrimaryKey<RemoveUpperCase<InstanceType<T>>>;
export function references<T extends abstract new (...args: any[]) => any, K extends keyof RemoveUpperCase<InstanceType<T>>>(table: T, options?: {
    column: K,
    onDelete?: ForeignActions,
    onUpdate?: ForeignActions,
    index?: false
  }): PkToDbType<InstanceType<T>[K]>;
export function cascade<T extends abstract new (...args: any[]) => any>(table: T, options?: {
    index?: false
  }): GetPrimaryKey<RemoveUpperCase<InstanceType<T>>>;
export function cascade<T extends abstract new (...args: any[]) => any, K extends keyof RemoveUpperCase<InstanceType<T>>>(table: T, options?: {
    column: K,
    index?: false
  }): PkToDbType<InstanceType<T>[K]>;

export function index<T>(type: T): ToDefaultType<T>;
export function index<T>(type: T, expression: (column: T) => { where: { [key: symbol]: any }}): ToDefaultType<T>;
export function index(...args: [any, ...any[]]): void;
export function index(...args: [any, ...any[], { where: { [key: symbol]: any }}]): void;
export function unique<T>(type: T): ToDefaultType<T>;
export function unique<T>(type: T, expression: (column: T) => { where: { [key: symbol]: any }}): ToDefaultType<T>;
export function unique(...args: [any, ...any[]]): void;
export function unique(...args: [any, ...any[], { where: { [key: symbol]: any }}]): void;
export function check(where: SymbolWhere): void;
export function check<T>(type: T, ...checks: ({ in: DbTypes[] } | { is: any })[]): ToDefaultType<T>;

export function typedArray<T extends TypedJson>(type: T): T[];
export function typedObject<T extends TypedJson>(type: T): T;
