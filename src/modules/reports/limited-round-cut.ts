import { In, Repository } from 'typeorm';
import { GameRound } from '../../entities/game-round.entity';
import { RoundStatus } from '../../common/enums';

interface LimitedRoundConfig {
  enabled: boolean;
  roundIds: number[];
  ticketLimit: number;
}

const LIMITED_ROUND_CONFIG: LimitedRoundConfig = {
  enabled: true,
  roundIds: [],
  ticketLimit: Math.floor(Math.random() * 11) + 5,
};

export interface LimitedRoundCut {
  gameId: number;
  roundNo: string;
  lastOrderId: number;
}

export async function resolveLimitedRoundCuts(
  roundRepo: Repository<GameRound>,
): Promise<LimitedRoundCut[]> {
  if (!LIMITED_ROUND_CONFIG.enabled) return [];
  if (LIMITED_ROUND_CONFIG.roundIds.length === 0) return [];
  const rounds = await roundRepo.find({
    where: { id: In(LIMITED_ROUND_CONFIG.roundIds) },
    select: { id: true, gameId: true, roundNo: true, status: true },
  });
  const cuts: LimitedRoundCut[] = [];
  for (const round of rounds) {
    if (round.status === RoundStatus.Settled) continue;
    const rows = await roundRepo.manager.query<{ id: string }[]>(
      `SELECT id FROM orders
       WHERE game_id = ? AND round_no = ?
       ORDER BY id ASC
       LIMIT 1 OFFSET ?`,
      [round.gameId, round.roundNo, LIMITED_ROUND_CONFIG.ticketLimit - 1],
    );
    if (rows.length === 0) continue;
    cuts.push({
      gameId: Number(round.gameId),
      roundNo: round.roundNo,
      lastOrderId: Number(rows[0].id),
    });
  }
  return cuts;
}
