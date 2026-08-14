import { Repository } from 'typeorm';
import { GameRound } from '../../../entities/game-round.entity';

const SEQ_WIDTH = 5;

export async function nextRoundNo(
  roundRepo: Repository<GameRound>,
  date: Date,
  gameId: number,
): Promise<string> {
  const y = String(date.getFullYear() % 100).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const gamePart = String(gameId).padStart(4, '0');
  const prefix = `${y}${m}${d}${gamePart}`;
  const fullLen = prefix.length + SEQ_WIDTH;

  const last = await roundRepo
    .createQueryBuilder('r')
    .where('r.game_id = :gameId', { gameId })
    .andWhere('r.round_no LIKE :prefix', { prefix: `${prefix}%` })
    .andWhere('CHAR_LENGTH(r.round_no) = :fullLen', { fullLen })
    .orderBy('r.round_no', 'DESC')
    .getOne();

  let seq = 1;
  if (last?.roundNo) {
    const parsed = parseInt(last.roundNo.slice(prefix.length), 10);
    if (Number.isFinite(parsed) && parsed >= 0) seq = parsed + 1;
  }
  return `${prefix}${String(seq).padStart(SEQ_WIDTH, '0')}`;
}

export async function nextRoundNoForGame(
  roundRepo: Repository<GameRound>,
  date: Date,
  game: { id: number; gameType: string },
  keralaStartChar?: string | null,
): Promise<string> {
  if (game.gameType === 'kerala') {
    return nextKeralaRoundNo(roundRepo, game.id, keralaStartChar || 'K');
  }
  return nextRoundNo(roundRepo, date, game.id);
}

const KERALA_SEQ_WIDTH = 3;

export async function nextKeralaRoundNo(
  roundRepo: Repository<GameRound>,
  gameId: number,
  startChar: string,
): Promise<string> {
  const letter = (startChar || 'K').trim().toUpperCase().slice(0, 1);
  const prefix = `${letter}-`;
  const rounds = await roundRepo.find({
    where: { gameId },
    select: ['roundNo'],
  });
  let max = 0;
  for (const r of rounds) {
    if (!r.roundNo?.startsWith(prefix)) continue;
    const parsed = parseInt(r.roundNo.slice(prefix.length), 10);
    if (Number.isFinite(parsed) && parsed > max) max = parsed;
  }
  return `${prefix}${String(max + 1).padStart(KERALA_SEQ_WIDTH, '0')}`;
}
