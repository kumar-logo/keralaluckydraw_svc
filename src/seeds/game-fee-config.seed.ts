import { DataSource } from 'typeorm';
import { GameFeeConfig } from '../entities/game-fee-config.entity';
import { GameList } from '../entities/game-list.entity';

const WIN_FEE_RATE = 0.05;

export async function seedGameFeeConfig(ds: DataSource) {
  const feeRepo = ds.getRepository(GameFeeConfig);
  const gameRepo = ds.getRepository(GameList);

  console.log('[GameFeeConfig] Clearing existing fee configs...');
  await feeRepo.clear();

  const lotteries = await gameRepo.find({ where: { isLottery: 1 } });

  let created = 0;
  for (const g of lotteries) {
    await feeRepo.save(
      feeRepo.create({
        gameId: g.id,
        gameType: g.gameType,
        feeType: 'win_deduction',
        feeRate: WIN_FEE_RATE,
        fixedFee: 0,
        status: 1,
      }),
    );
    created++;
  }

  console.log(`[GameFeeConfig] Created: ${created} fee configs`);
}
