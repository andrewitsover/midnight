export interface Keywords<T> {
  select: T;
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

export interface KeywordsWithoutSelect {
  orderBy?: Array<string> | string;
  desc?: boolean;
  limit?: number;
  offset?: number;
  distinct?: boolean;
}

export interface KeywordsWithCount {
  distinct?: boolean;
  count: true;
}

export interface SingularQueries<T, I, W, R> {
  [key: string]: any;
  insert(params: I): Promise<R>;
  update(query: W | null, params: Partial<T>): Promise<number>;
  get(params?: W | null): Promise<T | undefined>;
  get<K extends keyof T>(params: W | null, columns: K[]): Promise<Pick<T, K> | undefined>;
  get<K extends keyof T>(params: W | null, column: K): Promise<T[K] | undefined>;
  get(params: W | null, keywords: KeywordsWithoutSelect): Promise<T | undefined>;
  get(params: W | null, keywords: KeywordsWithCount): Promise<number>;
  get<K extends keyof T>(params: W | null, keywords: Keywords<K>): Promise<T[K] | undefined>;
  get<K extends keyof T>(params: W | null, keywords: Keywords<K[]>): Promise<Pick<T, K> | undefined>;
  get<K extends keyof T>(params: W | null, keywords: KeywordsWithExclude<K[]>): Promise<Omit<T, K> | undefined>;
  remove(params?: W): Promise<number>;
}

export interface MultipleQueries<T, I, W> {
  [key: string]: any;
  insert(params: Array<I>): Promise<void>;
  update(query: W | null, params: Partial<T>): Promise<number>;
  get(params?: W): Promise<Array<T>>;
  get<K extends keyof T>(params: W | null, columns: K[]): Promise<Array<Pick<T, K>>>;
  get<K extends keyof T>(params: W | null, column: K): Promise<Array<T[K]>>;
  get(params: W | null, keywords: KeywordsWithoutSelect): Promise<Array<T>>;
  get<K extends keyof T>(params: W | null, keywords: Keywords<K>): Promise<Array<T[K]>>;
  get<K extends keyof T>(params: W | null, keywords: Keywords<K[]>): Promise<Array<Pick<T, K>>>;
  get<K extends keyof T>(params: W | null, keywords: KeywordsWithExclude<K[]>): Promise<Array<Omit<T, K>>>;
  remove(params?: W): Promise<number>;
}

export interface WeightClass {
  id: number;
  name: string;
  weightLbs: number;
  gender: string;
}

export interface InsertWeightClass {
  id?: number;
  name: string;
  weightLbs: number;
  gender: string;
}

export interface WhereWeightClass {
  id?: number | Array<number>;
  name?: string | Array<string> | RegExp;
  weightLbs?: number | Array<number>;
  gender?: string | Array<string> | RegExp;
}

export interface Location {
  id: number;
  name: string;
  address: string;
  lat: number;
  long: number;
}

export interface InsertLocation {
  id?: number;
  name: string;
  address: string;
  lat: number;
  long: number;
}

export interface WhereLocation {
  id?: number | Array<number>;
  name?: string | Array<string> | RegExp;
  address?: string | Array<string> | RegExp;
  lat?: number | Array<number>;
  long?: number | Array<number>;
}

export interface LocationsByMethod {
  id: number;
  name: string;
  count: number;
}

export interface LocationsQueries {
  byMethod(params: { id: any; }): Promise<Array<LocationsByMethod>>;
}

export interface LocationQueries {
  byMethod(params: { id: any; }): Promise<LocationsByMethod | undefined>;
}

export interface Event {
  id: number;
  name: string;
  startTime: Date;
  locationId: number | null;
}

export interface InsertEvent {
  id?: number;
  name: string;
  startTime: Date;
  locationId?: number;
}

export interface WhereEvent {
  id?: number | Array<number>;
  name?: string | Array<string> | RegExp;
  startTime?: Date | Array<Date>;
  locationId?: number | Array<number> | null;
}

export interface EventsGetById {
  id: number;
  name: string;
  cards: Array<{
    id: number;
    cardName: string;
    fights: Array<{
      id: number;
      blue: { id: number; name: string; social: any };
      red: { id: number; name: string; social: any };
    }>;
  }>;
}

export interface EventsQueries {
  getById(params: { id: any; }): Promise<Array<EventsGetById>>;
}

export interface EventQueries {
  getById(params: { id: any; }): Promise<EventsGetById | undefined>;
}

export interface Card {
  id: number;
  eventId: number;
  cardName: string;
  cardOrder: number;
  startTime: Date | null;
}

export interface InsertCard {
  id?: number;
  eventId: number;
  cardName: string;
  cardOrder: number;
  startTime?: Date;
}

export interface WhereCard {
  id?: number | Array<number>;
  eventId?: number | Array<number>;
  cardName?: string | Array<string> | RegExp;
  cardOrder?: number | Array<number>;
  startTime?: Date | Array<Date> | null;
}

export interface Coach {
  id: number;
  name: string;
  city: string;
}

export interface InsertCoach {
  id?: number;
  name: string;
  city: string;
}

export interface WhereCoach {
  id?: number | Array<number>;
  name?: string | Array<string> | RegExp;
  city?: string | Array<string> | RegExp;
}

export interface Fighter {
  id: number;
  name: string;
  nickname: string | null;
  born: string | null;
  heightCm: number | null;
  reachCm: number | null;
  hometown: string;
  social: any;
  isActive: boolean;
}

export interface InsertFighter {
  id?: number;
  name: string;
  nickname?: string;
  born?: string;
  heightCm?: number;
  reachCm?: number;
  hometown: string;
  social?: any;
  isActive: boolean;
}

export interface WhereFighter {
  id?: number | Array<number>;
  name?: string | Array<string> | RegExp;
  nickname?: string | Array<string> | RegExp | null;
  born?: string | Array<string> | RegExp | null;
  heightCm?: number | Array<number> | null;
  reachCm?: number | Array<number> | null;
  hometown?: string | Array<string> | RegExp;
  social?: any | Array<any> | RegExp | null;
  isActive?: boolean | Array<boolean>;
}

export interface FightersCommon {
  red: { id: number; name: string };
  blue: { id: number; name: string };
  winnerId: number | null;
  method: string;
  description: string | null;
  event: { id: number; name: string; date: Date };
}

export interface FightersLeft {
  id: number;
  winner?: { id: number; name: string };
}

export interface FightersMethods {
  method: string;
  count: number;
}

export interface FightersOpponents {
  opponentId: number;
  name: string;
}

export interface FightersRight {
  id: number;
  winner: { id: number; name: string };
}

export interface FightersQueries {
  common(params: { fighter1: any; fighter2: any; }): Promise<Array<FightersCommon>>;
  left(): Promise<Array<FightersLeft>>;
  methods(params: { id: any; }): Promise<Array<FightersMethods>>;
  opponents(): Promise<Array<FightersOpponents>>;
  right(): Promise<Array<FightersRight>>;
}

export interface FighterQueries {
  common(params: { fighter1: any; fighter2: any; }): Promise<FightersCommon | undefined>;
  left(): Promise<FightersLeft | undefined>;
  methods(params: { id: any; }): Promise<FightersMethods | undefined>;
  opponents(): Promise<FightersOpponents | undefined>;
  right(): Promise<FightersRight | undefined>;
}

export interface OtherName {
  id: number;
  fighterId: number;
  name: string;
}

export interface InsertOtherName {
  id?: number;
  fighterId: number;
  name: string;
}

export interface WhereOtherName {
  id?: number | Array<number>;
  fighterId?: number | Array<number>;
  name?: string | Array<string> | RegExp;
}

export interface FighterCoach {
  id: number;
  coachId: number;
  fighterId: number;
  startDate: string;
  endDate: string | null;
}

export interface InsertFighterCoach {
  id?: number;
  coachId: number;
  fighterId: number;
  startDate: string;
  endDate?: string;
}

export interface WhereFighterCoach {
  id?: number | Array<number>;
  coachId?: number | Array<number>;
  fighterId?: number | Array<number>;
  startDate?: string | Array<string> | RegExp;
  endDate?: string | Array<string> | RegExp | null;
}

export interface Ranking {
  id: number;
  fighterId: number;
  weightClassId: number;
  rank: number;
  isInterim: boolean;
}

export interface InsertRanking {
  id?: number;
  fighterId: number;
  weightClassId: number;
  rank: number;
  isInterim: boolean;
}

export interface WhereRanking {
  id?: number | Array<number>;
  fighterId?: number | Array<number>;
  weightClassId?: number | Array<number>;
  rank?: number | Array<number>;
  isInterim?: boolean | Array<boolean>;
}

export interface Method {
  id: number;
  name: string;
  abbreviation: string;
}

export interface InsertMethod {
  id?: number;
  name: string;
  abbreviation: string;
}

export interface WhereMethod {
  id?: number | Array<number>;
  name?: string | Array<string> | RegExp;
  abbreviation?: string | Array<string> | RegExp;
}

export interface MethodsByFighter {
  method: string;
  count: number;
}

export interface MethodsQueries {
  byFighter(params: { fighterId: any; }): Promise<Array<MethodsByFighter>>;
  topSubmission(): Promise<Array<string | null>>;
}

export interface MethodQueries {
  byFighter(params: { fighterId: any; }): Promise<MethodsByFighter | undefined>;
  topSubmission(): Promise<string | null | undefined>;
}

export interface Fight {
  id: number;
  cardId: number;
  fightOrder: number;
  blueId: number;
  redId: number;
  winnerId: number | null;
  methodId: number | null;
  methodDescription: string | null;
  endRound: number | null;
  endSeconds: number | null;
  titleFight: boolean;
  isInterim: boolean;
  weightClassId: number | null;
  oddsBlue: number | null;
  oddsRed: number | null;
  catchweightLbs: number | null;
}

export interface InsertFight {
  id?: number;
  cardId: number;
  fightOrder: number;
  blueId: number;
  redId: number;
  winnerId?: number;
  methodId?: number;
  methodDescription?: string;
  endRound?: number;
  endSeconds?: number;
  titleFight: boolean;
  isInterim: boolean;
  weightClassId?: number;
  oddsBlue?: number;
  oddsRed?: number;
  catchweightLbs?: number;
}

export interface WhereFight {
  id?: number | Array<number>;
  cardId?: number | Array<number>;
  fightOrder?: number | Array<number>;
  blueId?: number | Array<number>;
  redId?: number | Array<number>;
  winnerId?: number | Array<number> | null;
  methodId?: number | Array<number> | null;
  methodDescription?: string | Array<string> | RegExp | null;
  endRound?: number | Array<number> | null;
  endSeconds?: number | Array<number> | null;
  titleFight?: boolean | Array<boolean>;
  isInterim?: boolean | Array<boolean>;
  weightClassId?: number | Array<number> | null;
  oddsBlue?: number | Array<number> | null;
  oddsRed?: number | Array<number> | null;
  catchweightLbs?: number | Array<number> | null;
}

export interface FightsByFighter {
  opponent: string;
  win: boolean | null;
  winnerId: number | null;
  method: string;
  methodDescription: string | null;
  eventName: string;
  startTime: Date;
  endRound: number | null;
  endSeconds: number | null;
  titleFight: boolean;
  name: string;
}

export interface FightsQueries {
  byFighter(params: { id: any; }): Promise<Array<FightsByFighter>>;
}

export interface FightQueries {
  byFighter(params: { id: any; }): Promise<FightsByFighter | undefined>;
}

export interface CancelledFight {
  id: number;
  cardId: number;
  cardOrder: number;
  blueId: number;
  redId: number;
  cancelledAt: Date;
  cancellationReason: string | null;
}

export interface InsertCancelledFight {
  id?: number;
  cardId: number;
  cardOrder: number;
  blueId: number;
  redId: number;
  cancelledAt: Date;
  cancellationReason?: string;
}

export interface WhereCancelledFight {
  id?: number | Array<number>;
  cardId?: number | Array<number>;
  cardOrder?: number | Array<number>;
  blueId?: number | Array<number>;
  redId?: number | Array<number>;
  cancelledAt?: Date | Array<Date>;
  cancellationReason?: string | Array<string> | RegExp | null;
}

export interface TitleRemoval {
  id: number;
  fighterId: number;
  weightClassId: number;
  isInterim: boolean;
  removedAt: Date;
  reason: string;
}

export interface InsertTitleRemoval {
  id?: number;
  fighterId: number;
  weightClassId: number;
  isInterim: boolean;
  removedAt: Date;
  reason: string;
}

export interface WhereTitleRemoval {
  id?: number | Array<number>;
  fighterId?: number | Array<number>;
  weightClassId?: number | Array<number>;
  isInterim?: boolean | Array<boolean>;
  removedAt?: Date | Array<Date>;
  reason?: string | Array<string> | RegExp;
}

export interface Opponent {
  fighterId: number;
  opponentId: number;
}

export interface InsertOpponent {
  fighterId: number;
  opponentId: number;
}

export interface WhereOpponent {
  fighterId?: number | Array<number>;
  opponentId?: number | Array<number>;
}

export interface TypedDb {
  [key: string]: any,
  weightClasses: MultipleQueries<WeightClass, InsertWeightClass, WhereWeightClass>,
  weightClass: SingularQueries<WeightClass, InsertWeightClass, WhereWeightClass, number>,
  locations: MultipleQueries<Location, InsertLocation, WhereLocation> & LocationsQueries,
  location: SingularQueries<Location, InsertLocation, WhereLocation, number> & LocationQueries,
  events: MultipleQueries<Event, InsertEvent, WhereEvent> & EventsQueries,
  event: SingularQueries<Event, InsertEvent, WhereEvent, number> & EventQueries,
  cards: MultipleQueries<Card, InsertCard, WhereCard>,
  card: SingularQueries<Card, InsertCard, WhereCard, number>,
  coaches: MultipleQueries<Coach, InsertCoach, WhereCoach>,
  coach: SingularQueries<Coach, InsertCoach, WhereCoach, number>,
  fighters: MultipleQueries<Fighter, InsertFighter, WhereFighter> & FightersQueries,
  fighter: SingularQueries<Fighter, InsertFighter, WhereFighter, number> & FighterQueries,
  otherNames: MultipleQueries<OtherName, InsertOtherName, WhereOtherName>,
  otherName: SingularQueries<OtherName, InsertOtherName, WhereOtherName, number>,
  fighterCoaches: MultipleQueries<FighterCoach, InsertFighterCoach, WhereFighterCoach>,
  fighterCoach: SingularQueries<FighterCoach, InsertFighterCoach, WhereFighterCoach, number>,
  rankings: MultipleQueries<Ranking, InsertRanking, WhereRanking>,
  ranking: SingularQueries<Ranking, InsertRanking, WhereRanking, number>,
  methods: MultipleQueries<Method, InsertMethod, WhereMethod> & MethodsQueries,
  method: SingularQueries<Method, InsertMethod, WhereMethod, number> & MethodQueries,
  fights: MultipleQueries<Fight, InsertFight, WhereFight> & FightsQueries,
  fight: SingularQueries<Fight, InsertFight, WhereFight, number> & FightQueries,
  cancelledFights: MultipleQueries<CancelledFight, InsertCancelledFight, WhereCancelledFight>,
  cancelledFight: SingularQueries<CancelledFight, InsertCancelledFight, WhereCancelledFight, number>,
  titleRemovals: MultipleQueries<TitleRemoval, InsertTitleRemoval, WhereTitleRemoval>,
  titleRemoval: SingularQueries<TitleRemoval, InsertTitleRemoval, WhereTitleRemoval, number>,
  opponents: Pick<MultipleQueries<Opponent, InsertOpponent, WhereOpponent>, "get">,
  opponent: Pick<SingularQueries<Opponent, InsertOpponent, WhereOpponent, number>, "get">,
  begin(): Promise<void>,
  commit(): Promise<void>,
  rollback(): Promise<void>
}

declare const db: TypedDb;

export {
  db
}
