/*
 * Full money-path audit (manual, runnable): for every game family it places winning + losing
 * bets via the REAL service, sets a controlled result, settles via the REAL SettlementService,
 * then asserts the credited win_amount, the user balance delta, AND that the my-orders order-list
 * returns each winner's win amount. Covers color, dice, race, three_digit, four_five, dubai.
 *
 * Run with the API server STOPPED (this boots its own app context):
 *     node scripts/audit-money-path.js
 *
 * Pure unit rule-coverage lives in src/modules/game/shared/mechanics/<game>.rules.spec.ts (npm test).
 * This script proves the end-to-end chain incl. the my-orders page win display.
 */
const { NestFactory } = require('@nestjs/core');
const { DataSource } = require('typeorm');
const { getRepositoryToken } = require('@nestjs/typeorm');
const { AppModule } = require('../dist/app.module');
const { GameList } = require('../dist/entities/game-list.entity');
const {
  SettlementService,
} = require('../dist/modules/game/shared/settlement.service');
const {
  GameConfigService,
} = require('../dist/modules/game/shared/game-config.service');
const { ColorService } = require('../dist/modules/game/color/color.service');
const { DiceService } = require('../dist/modules/game/dice/dice.service');
const { RaceService } = require('../dist/modules/game/race/race.service');
const {
  ThreeDigitService,
} = require('../dist/modules/game/three-digit/three-digit.service');
const {
  FourFiveDigitService,
} = require('../dist/modules/game/four-five-digit/four-five-digit.service');
const { DubaiService } = require('../dist/modules/game/dubai/dubai.service');

let pass = 0,
  fail = 0;
const out = [];
const ok = (label, cond, detail) => {
  if (cond) {
    pass++;
    out.push(`    ✓ ${label}`);
  } else {
    fail++;
    out.push(`    ✗ ${label} — ${detail}`);
  }
};
const STAKE = 10;

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    const ds = app.get(DataSource);
    const gameRepo = app.get(getRepositoryToken(GameList));
    const settlement = app.get(SettlementService);
    const gameConfig = app.get(GameConfigService);
    const svc = {
      color: app.get(ColorService),
      dice: app.get(DiceService),
      race: app.get(RaceService),
      three_digit: app.get(ThreeDigitService),
      four_five: app.get(FourFiveDigitService),
      dubai: app.get(DubaiService),
    };
    const [u] = await ds.query(
      'SELECT user_id FROM users ORDER BY id ASC LIMIT 1',
    );
    const userId = u.user_id;

    const scenarios = [
      {
        fam: 'color',
        gid: 101,
        result: { number: 1, drawResult: '1' },
        bets: [
          ['green', true],
          ['red', false],
          ['small', true],
          ['big', false],
          ['1', true],
          ['2', false],
        ],
        place: async (r, bets) => {
          for (const [n] of bets)
            await svc.color.createOrder(userId, {
              colorID: 101,
              roundNo: r,
              orders: [{ betType: n, betNum: n, amount: STAKE }],
            });
        },
      },
      {
        fam: 'dice',
        gid: 201,
        result: { dice: [1, 2, 4], drawResult: '1,2,4' },
        bets: [
          ['sum_small', true],
          ['sum_big', false],
          ['sum_odd', true],
          ['sum_even', false],
          ['single_one', true],
          ['single_six', false],
          ['sum_seven', true],
        ],
        place: async (r, bets) => {
          for (const [n] of bets)
            await svc.dice.createOrder(userId, {
              diceID: 201,
              roundNo: r,
              orders: [{ betType: n, betNum: n, amount: STAKE }],
            });
        },
      },
      {
        fam: 'race',
        gid: 301,
        result: {
          positions: [3, 7, 1, 5, 9, 2, 11, 4, 6, 8, 10, 12],
          runnerCount: 12,
          champion: 3,
          top3: '3,7,1',
        },
        bets: [
          ['champ-3', true, 1, '3'],
          ['champ-5', false, 1, '5'],
          ['top3fixed-WIN', true, 2, '3,7,1'],
          ['top3fixed-LOSE', false, 2, '7,3,1'],
        ],
        place: async (r, bets) => {
          for (const [, , type, num] of bets)
            await svc.race.createOrder(userId, {
              gameID: 301,
              roundNo: r,
              orders: [{ betType: type, numbers: num, amount: STAKE }],
            });
        },
      },
      {
        fam: 'three_digit',
        gid: 601,
        result: {
          number: '2345',
          digits: [2, 3, 4, 5],
          drawResult: '2345',
          sum: 14,
        },
        bets: [
          ['slat-ABC WIN', true, '2345'],
          ['slat-ABC LOSE', false, '8888'],
        ],
        place: async (r, bets) => {
          const sp = (await gameConfig.getSlatProducts(601)).find(
            (p) => p.matchMode === 'ladder',
          );
          for (const [, , tk] of bets)
            await svc.three_digit.createOrder(userId, {
              gameID: 601,
              roundNo: r,
              pickInfos: [
                {
                  betType: 'ABC',
                  numbers: tk,
                  slatProductId: sp.id,
                  count: 1,
                  amount: sp.price,
                },
              ],
            });
        },
      },
      {
        fam: 'four_five',
        gid: 801,
        result: {
          number: '54321',
          digits: [5, 4, 3, 2, 1],
          drawResult: '54321',
          sum: 15,
        },
        bets: [
          ['exact5 WIN', true, 'exact5', '54321'],
          ['exact5 LOSE', false, 'exact5', '11111'],
        ],
        place: async (r, bets) => {
          for (const [, , bt, num] of bets)
            await svc.four_five.createOrder(userId, {
              gameID: 801,
              roundNo: r,
              pickInfos: [{ betType: bt, numbers: num, amount: STAKE }],
            });
        },
      },
      {
        fam: 'dubai',
        gid: 1101,
        result: { number: 3, drawResult: '3' },
        bets: [
          ['number-3 WIN', true, 3],
          ['number-5 LOSE', false, 5],
        ],
        place: async (r, bets) => {
          for (const [, , num] of bets)
            await svc.dubai.createOrder(userId, {
              gameID: 1101,
              roundNo: r,
              orders: [{ number: num, amount: STAKE }],
            });
        },
      },
    ];

    for (const sc of scenarios) {
      out.push(`\n=== ${sc.fam.toUpperCase()} (game ${sc.gid}) ===`);
      const game = await gameRepo.findOne({ where: { id: sc.gid } });
      if (!game) {
        ok(sc.fam, false, 'game not found');
        continue;
      }
      await ds.query('UPDATE users SET balance=100000000 WHERE user_id=?', [
        userId,
      ]);
      const [{ balance: balBefore }] = await ds.query(
        'SELECT balance FROM users WHERE user_id=?',
        [userId],
      );
      const roundNo = 'AUD' + sc.gid + Date.now();
      await ds.query(
        'INSERT INTO game_rounds (game_id, game_type, round_no, draw_time, status, total_bet, created_at) VALUES (?,?,?,?,0,0,NOW())',
        [sc.gid, game.gameType, roundNo, new Date(Date.now() + 86400000)],
      );
      const [rnd] = await ds.query(
        'SELECT id FROM game_rounds WHERE game_id=? AND round_no=?',
        [sc.gid, roundNo],
      );
      try {
        await sc.place(roundNo, sc.bets);
        await ds.query('UPDATE game_rounds SET result=?, status=1 WHERE id=?', [
          JSON.stringify(sc.result),
          rnd.id,
        ]);
        await settlement.settleRound(rnd.id);
        const orders = await ds.query(
          'SELECT status, total_amount, win_amount, odds FROM orders WHERE round_no=? ORDER BY id',
          [roundNo],
        );
        let totalWon = 0,
          totalStaked = 0;
        for (let i = 0; i < sc.bets.length; i++) {
          const o = orders[i];
          const b = sc.bets[i];
          const expWon = b[1];
          if (!o) {
            ok(`${b[0]}`, false, 'no order');
            continue;
          }
          totalStaked += Number(o.total_amount);
          totalWon += Number(o.win_amount);
          const winOk = expWon
            ? o.status === 1 && Number(o.win_amount) > 0
            : o.status === 2 && Number(o.win_amount) === 0;
          ok(
            `${b[0]}: status=${o.status} win=${o.win_amount} (odds ${o.odds})`,
            winOk,
            `expected ${expWon ? 'WIN' : 'LOSE'}`,
          );
        }
        const [{ balance: balAfter }] = await ds.query(
          'SELECT balance FROM users WHERE user_id=?',
          [userId],
        );
        ok(
          `balance delta = -${totalStaked} + ${totalWon}`,
          Math.abs(
            Number(balAfter) - Number(balBefore) - (-totalStaked + totalWon),
          ) < 0.01,
          `delta=${Number(balAfter) - Number(balBefore)}`,
        );
        const olist = svc[sc.fam].orderList || svc[sc.fam].getOrderList;
        const resp = await olist.call(svc[sc.fam], userId, {
          gameID: sc.gid,
          colorID: sc.gid,
          diceID: sc.gid,
          pageNo: 1,
          pageSize: 30,
        });
        const txt = JSON.stringify(resp);
        const winners = orders.filter((o) => Number(o.win_amount) > 0);
        const allShown = winners.every(
          (o) =>
            txt.includes(Number(o.win_amount).toFixed(2)) ||
            txt.includes(String(Number(o.win_amount))),
        );
        ok(
          'my-orders page shows round + every win amount',
          txt.includes(roundNo) && allShown,
          `winners=${winners.map((o) => o.win_amount).join(',')}`,
        );
      } catch (e) {
        ok(`${sc.fam} place/settle`, false, e.message);
      }
      await ds.query('DELETE FROM orders WHERE round_no=?', [roundNo]);
      await ds.query('DELETE FROM game_rounds WHERE id=?', [rnd.id]);
    }
    console.log(out.join('\n'));
    console.log(`\n===== MONEY-PATH AUDIT: ${pass} PASS / ${fail} FAIL =====`);
    process.exitCode = fail === 0 ? 0 : 1;
  } catch (e) {
    console.log(out.join('\n'));
    console.error('\nAUDIT ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
})();
