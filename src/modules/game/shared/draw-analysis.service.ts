import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameRound } from '../../../entities/game-round.entity';
import { Order } from '../../../entities/order.entity';
import { GameList } from '../../../entities/game-list.entity';
import { ResultEngineService } from './result-engine.service';

export interface RoundAnalysis {
  roundId: number;
  roundNo: string;
  gameId: number;
  gameType: string;
  gameName: string;
  status: number;
  drawTime: string;
  totalOrders: number;
  totalStake: number;
  uniquePlayers: number;
  betDistribution: Record<string, { count: number; totalAmount: number }>;
}

export interface ResultPreview {
  proposedResult: any;
  totalWinners: number;
  totalPayout: number;
  totalStake: number;
  profitLoss: number;
  winRate: number;
  winners: {
    userId: string;
    orderNo: string;
    betContent: any;
    amount: number;
    winAmount: number;
    prizeLevel?: string;
  }[];
}

export interface ResultRecommendation {
  result: any;
  strategy: string;
  totalPayout: number;
  totalWinners: number;
  profitLoss: number;
  description: string;
}

@Injectable()
export class DrawAnalysisService {
  private readonly logger = new Logger(DrawAnalysisService.name);

  constructor(
    @InjectRepository(GameRound) private roundRepo: Repository<GameRound>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(GameList) private gameRepo: Repository<GameList>,
    private readonly resultEngine: ResultEngineService,
  ) {}

  async analyzeRound(roundId: number): Promise<RoundAnalysis> {
    const round = await this.roundRepo.findOne({ where: { id: roundId } });
    if (!round) throw new NotFoundException('Round not found');

    const game = await this.gameRepo.findOne({ where: { id: round.gameId } });

    const orders = await this.orderRepo.find({
      where: { gameId: round.gameId, roundNo: round.roundNo, status: 0 },
    });

    const playerSet = new Set(orders.map((o) => o.userId));
    const totalStake = orders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );

    const betDistribution: Record<
      string,
      { count: number; totalAmount: number }
    > = {};
    for (const o of orders) {
      const betContent = o.betContent as { betCode?: string } | null;
      const key = o.betType || betContent?.betCode || 'unknown';
      if (!betDistribution[key])
        betDistribution[key] = { count: 0, totalAmount: 0 };
      betDistribution[key].count++;
      betDistribution[key].totalAmount += Number(o.totalAmount);
    }

    return {
      roundId: round.id,
      roundNo: round.roundNo,
      gameId: round.gameId,
      gameType: round.gameType,
      gameName: game ? game.gameName : round.gameType,
      status: round.status,
      drawTime: round.drawTime as any,
      totalOrders: orders.length,
      totalStake,
      uniquePlayers: playerSet.size,
      betDistribution,
    };
  }

  previewResult(roundId: number, proposedResult: any): Promise<ResultPreview> {
    return this.resultEngine.previewForRound(roundId, proposedResult);
  }

  recommendResult(roundId: number): Promise<ResultRecommendation[]> {
    return this.resultEngine.recommendForRound(roundId);
  }
}
