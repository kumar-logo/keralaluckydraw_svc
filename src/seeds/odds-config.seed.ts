import { DataSource } from 'typeorm';
import { GameOddsConfig } from '../entities/game-odds-config.entity';
import { GameList } from '../entities/game-list.entity';

interface OddsSeed {
  betType: string;
  odds: number;
}

const oddsByGameType: Record<string, OddsSeed[]> = {
  color: [
    { betType: 'green', odds: 2 },
    { betType: 'red', odds: 2 },
    { betType: 'violet', odds: 4.5 },
    { betType: 'big', odds: 2 },
    { betType: 'small', odds: 2 },
    { betType: 'number', odds: 9 },
    { betType: 'green_violet', odds: 1.5 },
    { betType: 'red_violet', odds: 1.5 },
    { betType: 'number_0', odds: 9 },
    { betType: 'number_1', odds: 9 },
    { betType: 'number_2', odds: 9 },
    { betType: 'number_3', odds: 9 },
    { betType: 'number_4', odds: 9 },
    { betType: 'number_5', odds: 9 },
    { betType: 'number_6', odds: 9 },
    { betType: 'number_7', odds: 9 },
    { betType: 'number_8', odds: 9 },
    { betType: 'number_9', odds: 9 },
  ],
  dice: [
    { betType: 'sum_big', odds: 1.95 },
    { betType: 'sum_small', odds: 1.95 },
    { betType: 'sum_odd', odds: 1.95 },
    { betType: 'sum_even', odds: 1.95 },
    { betType: 'sum_three', odds: 150 },
    { betType: 'sum_four', odds: 50 },
    { betType: 'sum_five', odds: 18 },
    { betType: 'sum_six', odds: 14 },
    { betType: 'sum_seven', odds: 12 },
    { betType: 'sum_eight', odds: 8 },
    { betType: 'sum_nine', odds: 6 },
    { betType: 'sum_ten', odds: 6 },
    { betType: 'sum_eleven', odds: 6 },
    { betType: 'sum_twelve', odds: 6 },
    { betType: 'sum_thirteen', odds: 8 },
    { betType: 'sum_fourteen', odds: 12 },
    { betType: 'sum_fifteen', odds: 14 },
    { betType: 'sum_sixteen', odds: 18 },
    { betType: 'sum_seventeen', odds: 50 },
    { betType: 'sum_eighteen', odds: 150 },
    { betType: 'single_one', odds: 1.9 },
    { betType: 'single_two', odds: 1.9 },
    { betType: 'single_three', odds: 1.9 },
    { betType: 'single_four', odds: 1.9 },
    { betType: 'single_five', odds: 1.9 },
    { betType: 'single_six', odds: 1.9 },
    { betType: 'double_one', odds: 8 },
    { betType: 'double_two', odds: 8 },
    { betType: 'double_three', odds: 8 },
    { betType: 'double_four', odds: 8 },
    { betType: 'double_five', odds: 8 },
    { betType: 'double_six', odds: 8 },
    { betType: 'leopard_any', odds: 24 },
    { betType: 'leopard_one', odds: 150 },
    { betType: 'leopard_two', odds: 150 },
    { betType: 'leopard_three', odds: 150 },
    { betType: 'leopard_four', odds: 150 },
    { betType: 'leopard_five', odds: 150 },
    { betType: 'leopard_six', odds: 150 },
  ],
  race: [
    { betType: 'champion', odds: 5.4 },
    { betType: 'top3_fixed', odds: 100 },
    { betType: 'winning_group', odds: 5.4 },
    { betType: 'top3_any', odds: 1.85 },
    { betType: 'top3_random', odds: 17 },
  ],
  three_digit: [
    { betType: 'exact', odds: 900 },
    { betType: 'front2', odds: 90 },
    { betType: 'back2', odds: 90 },
    { betType: 'sum_big', odds: 2 },
    { betType: 'sum_small', odds: 2 },
    { betType: 'sum_odd', odds: 2 },
    { betType: 'sum_even', odds: 2 },
  ],
  four_five_digit: [
    { betType: 'big', odds: 2 },
    { betType: 'small', odds: 2 },
    { betType: 'odd', odds: 2 },
    { betType: 'even', odds: 2 },
    { betType: 'first', odds: 9 },
    { betType: 'second', odds: 9 },
    { betType: 'third', odds: 9 },
    { betType: 'fourth', odds: 9 },
    { betType: 'fifth', odds: 9 },
    { betType: 'sum', odds: 5 },
    { betType: 'exact5', odds: 90000 },
    { betType: 'exact4', odds: 9000 },
    { betType: 'first4', odds: 9000 },
    { betType: 'first3', odds: 900 },
    { betType: 'first2', odds: 90 },
    { betType: 'first1', odds: 9 },
  ],
  dubai: [
    { betType: 'number_0', odds: 30 },
    { betType: 'number_1', odds: 30 },
    { betType: 'number_2', odds: 30 },
    { betType: 'number_3', odds: 30 },
    { betType: 'number_4', odds: 30 },
    { betType: 'number_5', odds: 30 },
    { betType: 'number_6', odds: 30 },
    { betType: 'number_7', odds: 30 },
    { betType: 'number_8', odds: 30 },
    { betType: 'number_9', odds: 30 },
    { betType: 'number_10', odds: 30 },
    { betType: 'number_11', odds: 30 },
    { betType: 'number_12', odds: 30 },
    { betType: 'number_13', odds: 30 },
    { betType: 'number_14', odds: 30 },
    { betType: 'number_15', odds: 30 },
    { betType: 'number_16', odds: 30 },
    { betType: 'number_17', odds: 30 },
    { betType: 'number_18', odds: 30 },
    { betType: 'number_19', odds: 30 },
    { betType: 'number_20', odds: 30 },
    { betType: 'number_21', odds: 30 },
    { betType: 'number_22', odds: 30 },
    { betType: 'number_23', odds: 30 },
    { betType: 'number_24', odds: 30 },
    { betType: 'number_25', odds: 30 },
    { betType: 'number_26', odds: 30 },
    { betType: 'number_27', odds: 30 },
    { betType: 'number_28', odds: 30 },
    { betType: 'number_29', odds: 30 },
  ],
  kerala: [
    { betType: 'first', odds: 100000 },
    { betType: 'second', odds: 10000 },
    { betType: 'third', odds: 5000 },
    { betType: 'fourth', odds: 1000 },
    { betType: 'fifth', odds: 500 },
    { betType: 'consolation', odds: 100 },
    { betType: 'last4', odds: 20 },
    { betType: 'last3', odds: 10 },
    { betType: 'last2', odds: 5 },
    { betType: 'last1', odds: 2 },
  ],
};

export async function seedOddsConfig(ds: DataSource) {
  const gameRepo = ds.getRepository(GameList);
  const oddsRepo = ds.getRepository(GameOddsConfig);

  console.log('[OddsConfig] Clearing existing odds data...');
  await oddsRepo.clear();

  const games = await gameRepo.find({ where: { status: 1 } });
  let created = 0;

  for (const game of games) {
    const oddsForType = oddsByGameType[game.gameType];
    if (!oddsForType) continue;

    for (const o of oddsForType) {
      await oddsRepo.save(
        oddsRepo.create({
          gameId: game.id,
          gameType: game.gameType,
          betType: o.betType,
          odds: o.odds,
        }),
      );
      created++;
    }
  }

  console.log(`[OddsConfig] Created: ${created} odds entries`);
}
