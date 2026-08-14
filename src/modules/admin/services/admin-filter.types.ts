export interface DateRangeFilter {
  startDate?: string;
  endDate?: string;
}

export interface PageQuery {
  pageNo: number;
  pageSize: number;
}

export type GameScope = 'all' | 'in_house' | 'lottery';

export interface GameOptionsQuery {
  scope?: GameScope;
  search?: string;
}

export interface GameOption {
  id: number;
  name: string;
  gameType: string;
  isLottery: number;
  isThirdParty: number;
}

export interface OrdersListQuery extends PageQuery, DateRangeFilter {
  userId?: string;
  gameType?: string;
  gameIds?: number[];
  status?: number;
}

export interface GameRoundsListQuery extends PageQuery, DateRangeFilter {
  gameId?: number;
  gameIds?: number[];
  gameType?: string;
  status?: number;
  search?: string;
}

export interface UserBetsQuery extends PageQuery, DateRangeFilter {
  gameType?: string;
  gameIds?: number[];
  status?: number;
}

export interface UserTransactionsQuery extends PageQuery, DateRangeFilter {
  sourceType?: string;
}

export interface UserTransfersQuery extends PageQuery, DateRangeFilter {}

export const trimDate = (value: string | undefined): string =>
  value ? value.trim() : '';
