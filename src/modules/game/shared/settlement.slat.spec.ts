import { SettlementService } from './settlement.service';
import { OddsService } from './odds.service';
import { SlatDigit3Mechanic } from './mechanics/slat.mechanic';
import { GameMechanicsConfig } from './game-config.types';
import { GameRound } from '../../../entities/game-round.entity';
import { GameList } from '../../../entities/game-list.entity';
import { Order } from '../../../entities/order.entity';
import { SlatMatchMode } from '../../../common/enums';

const CFG: GameMechanicsConfig = {
  family: 'digit3',
  digitCount: 3,
  slatProducts: [
    {
      id: 541,
      digitCount: 3,
      price: 11,
      matchMode: SlatMatchMode.Group,
      title: 'Slat-1D',
      status: 1,
      tiers: [
        { label: 'A', positions: [0], winAmount: 100, tierRank: 0 },
        { label: 'B', positions: [1], winAmount: 100, tierRank: 0 },
        { label: 'C', positions: [2], winAmount: 100, tierRank: 0 },
      ],
    },
    {
      id: 542,
      digitCount: 3,
      price: 12,
      matchMode: SlatMatchMode.Group,
      title: 'Slat-2D',
      status: 1,
      tiers: [
        { label: 'AB', positions: [0, 1], winAmount: 1000, tierRank: 0 },
        { label: 'BC', positions: [1, 2], winAmount: 1000, tierRank: 0 },
        { label: 'AC', positions: [0, 2], winAmount: 1000, tierRank: 0 },
      ],
    },
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

const slatOrder = (
  id: number,
  productId: number,
  label: string,
  numbers: string,
  positions: number[],
  quantity: number,
  price: number,
  winPrice: number,
): Order =>
  Object.assign(new Order(), {
    id,
    orderNo: `O${id}`,
    userId: `U${id}`,
    gameId: 604,
    roundNo: 'R1',
    gameType: 'three_digit',
    betType: label,
    betContent: {
      numbers,
      betType: label,
      slatProductId: productId,
      position: label,
      positions,
      slot: price,
      winPrice,
    },
    amount: price,
    quantity,
    totalAmount: price * quantity,
    odds: 1,
    status: 0,
  });

const buildService = (drawResult: Record<string, string>, orders: Order[]) => {
  const round = Object.assign(new GameRound(), {
    id: 77,
    gameId: 604,
    roundNo: 'R1',
    gameType: 'three_digit',
    status: 1,
    result: drawResult,
    totalBet: 0,
  });
  const roundRepo = {
    findOne: jest.fn().mockResolvedValue(round),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const orderRepo = {
    find: jest.fn().mockResolvedValue(orders),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    isTransactionActive: true,
    manager: {
      getRepository: (target: typeof GameRound | typeof Order) =>
        target === GameRound ? roundRepo : orderRepo,
    },
  };
  const gameEngine = {
    getDataSource: () => ({ createQueryRunner: () => queryRunner }),
    getOddsForGame: jest.fn().mockResolvedValue({}),
    getMechanic: () => SlatDigit3Mechanic,
    creditBalance: jest.fn().mockResolvedValue(undefined),
  };
  const game = Object.assign(new GameList(), {
    id: 604,
    gameType: 'three_digit',
    gameName: 'Quick 3D',
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
  return { service, roundRepo, orderRepo, queryRunner, gameEngine };
};

describe('SettlementService slat rounds', () => {
  it('pays exact slot matches prize x quantity and settles partial matches as lost', async () => {
    const orders = [
      slatOrder(1, 543, 'ABC', '123', [0, 1, 2], 2, 25, 12500),
      slatOrder(2, 543, 'ABC', '923', [0, 1, 2], 1, 25, 12500),
      slatOrder(3, 543, 'ABC', '993', [0, 1, 2], 4, 25, 12500),
      slatOrder(4, 542, 'BC', '23', [1, 2], 3, 12, 1000),
      slatOrder(5, 542, 'AB', '13', [0, 1], 1, 12, 1000),
      slatOrder(6, 541, 'A', '1', [0], 10, 11, 100),
      slatOrder(7, 541, 'A', '2', [0], 1, 11, 100),
    ];
    const { service, roundRepo, orderRepo, gameEngine } = buildService(
      { drawResult: '123' },
      orders,
    );

    const report = await service.settleRound(77);

    expect(report.wonOrders).toBe(3);
    expect(report.lostOrders).toBe(4);
    expect(report.totalPayout).toBe(25000 + 3000 + 1000);

    const updates = new Map(
      orderRepo.update.mock.calls.map(
        ([id, patch]: [number, Record<string, string | number | Date>]) => [
          id,
          patch,
        ],
      ),
    );
    expect(updates.get(1)).toEqual({
      status: 1,
      winAmount: 25000,
      odds: 0,
      settledAt: expect.any(Date),
    });
    expect(updates.get(4)).toEqual({
      status: 1,
      winAmount: 3000,
      odds: 0,
      settledAt: expect.any(Date),
    });
    expect(updates.get(6)).toEqual({
      status: 1,
      winAmount: 1000,
      odds: 0,
      settledAt: expect.any(Date),
    });
    for (const lostId of [2, 3, 5, 7]) {
      expect(updates.get(lostId)).toEqual({
        status: 2,
        winAmount: 0,
        settledAt: expect.any(Date),
      });
    }
    for (const patch of updates.values()) {
      expect(Object.keys(patch)).not.toContain('betContent');
    }

    expect(
      gameEngine.creditBalance.mock.calls.map((c) => [c[0], c[1]]),
    ).toEqual([
      ['U1', 25000],
      ['U4', 3000],
      ['U6', 1000],
    ]);
    expect(roundRepo.update).toHaveBeenLastCalledWith(77, {
      status: 2,
      totalPayout: 29000,
      settledAt: expect.any(Date),
    });
  });

  it('rolls back without paying anyone when the round result has no drawResult', async () => {
    const orders = [slatOrder(1, 543, 'ABC', '123', [0, 1, 2], 1, 25, 12500)];
    const { service, orderRepo, queryRunner, gameEngine } = buildService(
      { number: '123' },
      orders,
    );

    await expect(service.settleRound(77)).rejects.toThrow(
      'Slat evaluation requires a drawResult',
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(orderRepo.update).not.toHaveBeenCalled();
    expect(gameEngine.creditBalance).not.toHaveBeenCalled();
  });
});
