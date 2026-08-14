import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../../entities/order.entity';

interface LotteryDailyRow {
  date: string;
  totalBet: number;
  totalPayout: number;
  orderCount: number;
  playerCount: number;
}

interface LotteryTopPlayerRow {
  userId: string;
  totalBet: number;
  totalWin: number;
  orderCount: number;
}

@Injectable()
export class AdminLotteryReportingService {
  constructor(@InjectRepository(Order) private orderRepo: Repository<Order>) {}

  async getLotteryPnL(
    gameId: number,
    dto: { startDate: string; endDate: string },
  ) {
    const endDate = `${dto.endDate} 23:59:59`;
    const daily = await this.orderRepo
      .createQueryBuilder('o')
      .select('DATE(o.created_at)', 'date')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'totalBet')
      .addSelect('COALESCE(SUM(o.win_amount), 0)', 'totalPayout')
      .addSelect('COUNT(*)', 'orderCount')
      .addSelect('COUNT(DISTINCT o.user_id)', 'playerCount')
      .where('o.game_id = :gid', { gid: gameId })
      .andWhere('o.created_at >= :start AND o.created_at <= :end', {
        start: dto.startDate,
        end: endDate,
      })
      .groupBy('DATE(o.created_at)')
      .orderBy('date', 'ASC')
      .getRawMany<LotteryDailyRow>();

    const topPlayers = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.user_id', 'userId')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'totalBet')
      .addSelect('COALESCE(SUM(o.win_amount), 0)', 'totalWin')
      .addSelect('COUNT(*)', 'orderCount')
      .where('o.game_id = :gid', { gid: gameId })
      .andWhere('o.created_at >= :start AND o.created_at <= :end', {
        start: dto.startDate,
        end: endDate,
      })
      .groupBy('o.user_id')
      .orderBy('totalBet', 'DESC')
      .limit(20)
      .getRawMany<LotteryTopPlayerRow>();

    const summary = daily.reduce(
      (acc, r) => {
        acc.totalBet += Number(r.totalBet);
        acc.totalPayout += Number(r.totalPayout);
        acc.totalOrders += Number(r.orderCount);
        return acc;
      },
      { totalBet: 0, totalPayout: 0, totalOrders: 0 },
    );

    return {
      summary: {
        ...summary,
        profit: Number((summary.totalBet - summary.totalPayout).toFixed(2)),
        margin:
          summary.totalBet > 0
            ? Number(
                (
                  ((summary.totalBet - summary.totalPayout) /
                    summary.totalBet) *
                  100
                ).toFixed(2),
              )
            : 0,
      },
      daily: daily.map((r) => ({
        date: r.date,
        totalBet: Number(r.totalBet),
        totalPayout: Number(r.totalPayout),
        netRevenue: Number(
          (Number(r.totalBet) - Number(r.totalPayout)).toFixed(2),
        ),
        orderCount: Number(r.orderCount),
        playerCount: Number(r.playerCount),
      })),
      topPlayers: topPlayers.map((r) => ({
        userId: r.userId,
        totalBet: Number(r.totalBet),
        totalWin: Number(r.totalWin),
        orderCount: Number(r.orderCount),
      })),
    };
  }
}
