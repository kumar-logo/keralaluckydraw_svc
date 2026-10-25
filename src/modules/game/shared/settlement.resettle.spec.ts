import { SettlementService } from './settlement.service';
import { OddsService } from './odds.service';
import { SlatDigit3Mechanic } from './mechanics/slat.mechanic';
import { GameMechanicsConfig } from './game-config.types';
import { GameRound } from '../../../entities/game-round.entity';
import { GameList } from '../../../entities/game-list.entity';
import { Order } from '../../../entities/order.entity';
import { User } from '../../../entities/user.entity';
import { Transaction } from '../../../entities/transaction.entity';
import {
  OrderStatus,
  RoundStatus,
  SlatMatchMode,
  TransactionType,
} from '../../../common/enums';

const CFG: GameMechanicsConfig = {
  family: 'digit3',
  digitCount: 3,
  slatProducts: [
    {
      id: 543,
      digitCount: 3,
      price: 25,
      matchMode: SlatMatchMode.Ladder,
      title: 'Slat-3D',
      status: 1,
      tiers: [
        { label: 'ABC', positions: [0, 1, 2], winAmount: 12500, tierRank: 3 },
        { label: 'BC', positions: [1, 2], winAmount: 500, tierRank: 2 },
        { label: 'C', positions: [2], winAmount: 50, tierRank: 1 },
      ],
    },
  ],
};

const ticket = (
  id: number,
  userId: string,
  numbers: string,
  status: OrderStatus,
  winAmount: number,
  position = 'ABC',
): Order =>
  Object.assign(new Order(), {
    id,
    orderNo: `O${id}`,
    userId,
    gameId: 6714,
    roundNo: 'R1',
    gameType: 'three_digit',
    betType: 'ABC',
    betContent: {
      numbers,
      betType: 'ABC',
      slatProductId: 543,
      position,
      positions: [0, 1, 2],
      slot: 25,
      winPrice: status === OrderStatus.Won ? winAmount : 12500,
    },
    amount: 25,
    quantity: 1,
    totalAmount: 25,
    odds: 1,
    winAmount,
    status,
  });

interface Harness {
  round: GameRound;
  users: Map<string, User>;
  orderUpdates: Map<number, Record<string, unknown>>;
  userSets: Map<string, Record<string, unknown>>;
  txns: Transaction[];
  roundUpdates: Record<string, unknown>[];
  credits: [string, number][];
  queryRunner: { commitTransaction: jest.Mock; rollbackTransaction: jest.Mock };
  service: SettlementService;
}

const build = (
  roundPatch: Partial<GameRound>,
  orders: Order[],
  balances: Record<string, number>,
): Harness => {
  const round = Object.assign(new GameRound(), {
    id: 9,
    gameId: 6714,
    roundNo: 'R1',
    gameType: 'three_digit',
    status: RoundStatus.Settled,
    result: { drawResult: '123' },
    totalBet: 100,
    totalPayout: 12550,
    ...roundPatch,
  });
  const users = new Map(
    Object.entries(balances).map(([userId, balance]) => [
      userId,
      Object.assign(new User(), {
        userId,
        balance,
        withdrawableBalance: balance,
        version: 1,
      }),
    ]),
  );
  const orderUpdates = new Map<number, Record<string, unknown>>();
  const userSets = new Map<string, Record<string, unknown>>();
  const txns: Transaction[] = [];
  const roundUpdates: Record<string, unknown>[] = [];
  const credits: [string, number][] = [];

  const roundRepo = {
    findOne: jest.fn().mockResolvedValue(round),
    update: jest.fn((_id: number, patch: Record<string, unknown>) => {
      roundUpdates.push(patch);
      return Promise.resolve(undefined);
    }),
  };
  const orderRepo = {
    find: jest.fn().mockResolvedValue(orders),
    update: jest.fn((id: number, patch: Record<string, unknown>) => {
      orderUpdates.set(id, patch);
      return Promise.resolve(undefined);
    }),
  };
  const userRepo = {
    findOne: jest.fn(({ where }: { where: { userId: string } }) =>
      Promise.resolve(users.get(where.userId) ?? null),
    ),
    find: jest.fn(() => Promise.resolve([...users.values()])),
    createQueryBuilder: () => {
      let values: Record<string, unknown> = {};
      const chain = {
        update: () => chain,
        set: (v: Record<string, unknown>) => {
          values = v;
          return chain;
        },
        where: (_sql: string, params: { userId: string }) => {
          userSets.set(params.userId, values);
          return chain;
        },
        execute: () => Promise.resolve({ affected: 1 }),
      };
      return chain;
    },
  };
  const txnRepo = {
    create: (t: Partial<Transaction>) => Object.assign(new Transaction(), t),
    save: jest.fn((t: Transaction) => {
      txns.push(t);
      return Promise.resolve(t);
    }),
  };
  const repoFor = (target: unknown) => {
    if (target === GameRound) return roundRepo;
    if (target === Order) return orderRepo;
    if (target === User) return userRepo;
    return txnRepo;
  };
  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    isTransactionActive: true,
    manager: { getRepository: repoFor },
  };
  const gameEngine = {
    getDataSource: () => ({
      createQueryRunner: () => queryRunner,
      getRepository: repoFor,
    }),
    getOddsForGame: jest.fn().mockResolvedValue({}),
    getMechanic: () => SlatDigit3Mechanic,
    creditBalance: jest.fn((userId: string, amount: number) => {
      credits.push([userId, amount]);
      return Promise.resolve(undefined);
    }),
  };
  const game = Object.assign(new GameList(), {
    id: 6714,
    gameType: 'three_digit',
    gameName: 'Dear 3DLottery',
  });
  const service = new SettlementService(
    gameEngine as never,
    { getMechanicsConfig: jest.fn().mockResolvedValue(CFG) } as never,
    {
      getOddsAliasMap: async () => ({}),
      getOddsMissingPolicy: async () => 'use_stored',
      getBigwinMinAmount: async () => Number.MAX_SAFE_INTEGER,
      getBigwinTemplate: async () => '',
    } as never,
    {} as never,
    new OddsService(),
    { findOne: jest.fn().mockResolvedValue(game) } as never,
    { findOne: jest.fn().mockResolvedValue(null) } as never,
  );
  return {
    round,
    users,
    orderUpdates,
    userSets,
    txns,
    roundUpdates,
    credits,
    queryRunner,
    service,
  };
};

const slatContent = (numbers: string, position: string, winPrice: number) => ({
  numbers,
  betType: 'ABC',
  slatProductId: 543,
  position,
  positions: [0, 1, 2],
  slot: 25,
  winPrice,
});

const ORDERS = (): Order[] => [
  ticket(1, 'U1', '123', OrderStatus.Won, 12500),
  ticket(2, 'U2', '923', OrderStatus.Won, 50, 'C'),
  ticket(3, 'U3', '123', OrderStatus.Lost, 0),
  ticket(4, 'U4', '777', OrderStatus.Pending, 0),
  ticket(5, 'U5', '456', OrderStatus.Won, 50, 'C'),
];

describe('SettlementService.resettleRound', () => {
  it('pays the ladder tier each ticket really matched and takes back a wrong payout', async () => {
    const h = build({}, ORDERS(), { U1: 0, U2: 0, U3: 0, U4: 0, U5: 30 });

    const report = await h.service.resettleRound(9);

    expect(report.totalOrders).toBe(5);
    expect(report.changedOrders).toBe(4);
    expect(report.previousPayout).toBe(12600);
    expect(report.nextPayout).toBe(25500);
    expect(report.creditTotal).toBe(12950);
    expect(report.debitTotal).toBe(50);
    expect(report.debitApplied).toBe(30);
    expect(report.debitShortfall).toBe(20);

    expect(h.orderUpdates.has(1)).toBe(false);
    expect(h.orderUpdates.get(2)).toEqual({
      status: OrderStatus.Won,
      winAmount: 500,
      odds: 0,
      settledAt: expect.any(Date),
      betContent: slatContent('923', 'BC', 500),
    });
    expect(h.orderUpdates.get(3)).toEqual({
      status: OrderStatus.Won,
      winAmount: 12500,
      odds: 0,
      settledAt: expect.any(Date),
      betContent: slatContent('123', 'ABC', 12500),
    });
    expect(h.orderUpdates.get(4)).toEqual({
      status: OrderStatus.Lost,
      winAmount: 0,
      settledAt: expect.any(Date),
    });
    expect(h.orderUpdates.get(5)).toEqual({
      status: OrderStatus.Lost,
      winAmount: 0,
      settledAt: expect.any(Date),
      betContent: slatContent('456', 'ABC', 12500),
    });

    expect(h.credits).toEqual([
      ['U3', 12500],
      ['U2', 450],
    ]);
    expect(h.userSets.get('U5')).toEqual({
      balance: 0,
      withdrawableBalance: 0,
      version: expect.any(Function),
    });
    expect(h.txns).toHaveLength(1);
    expect(h.txns[0]).toMatchObject({
      userId: 'U5',
      sourceType: TransactionType.WinReversal,
      amount: -30,
      balance: 0,
      refId: 'O5',
    });
    expect(h.txns[0].description).toContain('uncollected 20');

    expect(h.roundUpdates[h.roundUpdates.length - 1]).toEqual({
      status: RoundStatus.Settled,
      totalPayout: 25500,
      settledAt: expect.any(Date),
    });
    expect(h.queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('changes nothing when the stored settlement already matches', async () => {
    const h = build(
      {},
      [
        ticket(1, 'U1', '123', OrderStatus.Won, 12500),
        ticket(2, 'U2', '993', OrderStatus.Won, 50, 'C'),
        ticket(3, 'U3', '999', OrderStatus.Lost, 0),
      ],
      { U1: 0, U2: 0, U3: 0 },
    );

    const report = await h.service.resettleRound(9);

    expect(report.changedOrders).toBe(0);
    expect(h.orderUpdates.size).toBe(0);
    expect(h.credits).toEqual([]);
    expect(h.txns).toEqual([]);
  });

  it('refuses a round that is still open for betting', async () => {
    const h = build({ status: RoundStatus.BettingOpen }, ORDERS(), {});
    await expect(h.service.resettleRound(9)).rejects.toThrow(
      'still open for betting',
    );
    expect(h.queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('refuses a cancelled round', async () => {
    const h = build({ status: RoundStatus.Cancelled }, ORDERS(), {});
    await expect(h.service.resettleRound(9)).rejects.toThrow('cancelled');
  });

  it('refuses a round without a draw result', async () => {
    const h = build(
      { status: RoundStatus.BettingClosed, result: null },
      ORDERS(),
      {},
    );
    await expect(h.service.resettleRound(9)).rejects.toThrow('no draw result');
  });
});

describe('SettlementService.settleRound ladder slots', () => {
  it('pays the highest ladder tier that matched and records it on the ticket', async () => {
    const h = build(
      { status: RoundStatus.BettingClosed, totalPayout: 0 },
      [
        ticket(1, 'U1', '123', OrderStatus.Pending, 0),
        ticket(2, 'U2', '923', OrderStatus.Pending, 0),
        ticket(3, 'U3', '993', OrderStatus.Pending, 0),
        ticket(4, 'U4', '999', OrderStatus.Pending, 0),
      ],
      { U1: 0, U2: 0, U3: 0, U4: 0 },
    );

    const report = await h.service.settleRound(9);

    expect(report.wonOrders).toBe(3);
    expect(report.lostOrders).toBe(1);
    expect(report.totalPayout).toBe(12500 + 500 + 50);
    expect(h.orderUpdates.get(1)).toMatchObject({
      status: OrderStatus.Won,
      winAmount: 12500,
      betContent: slatContent('123', 'ABC', 12500),
    });
    expect(h.orderUpdates.get(2)).toMatchObject({
      status: OrderStatus.Won,
      winAmount: 500,
      betContent: slatContent('923', 'BC', 500),
    });
    expect(h.orderUpdates.get(3)).toMatchObject({
      status: OrderStatus.Won,
      winAmount: 50,
      betContent: slatContent('993', 'C', 50),
    });
    expect(h.orderUpdates.get(4)).toEqual({
      status: OrderStatus.Lost,
      winAmount: 0,
      settledAt: expect.any(Date),
    });
    expect(h.credits).toEqual([
      ['U1', 12500],
      ['U2', 500],
      ['U3', 50],
    ]);
  });
});

describe('SettlementService.previewResettle', () => {
  it('reports the impact and the uncollectable shortfall without writing', async () => {
    const h = build({}, ORDERS(), { U1: 0, U2: 0, U3: 0, U4: 0, U5: 30 });

    const preview = await h.service.previewResettle(9);

    expect(preview.changedOrders).toBe(4);
    expect(preview.creditTotal).toBe(12950);
    expect(preview.debitTotal).toBe(50);
    expect(preview.shortfallTotal).toBe(20);
    expect(preview.shortfallUsers).toBe(1);
    expect(h.orderUpdates.size).toBe(0);
    expect(h.credits).toEqual([]);
    expect(h.txns).toEqual([]);
  });
});
