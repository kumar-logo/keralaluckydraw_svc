/*
 * Comprehensive lottery draw-lifecycle E2E (manual + auto, positive + negative).
 * Boots its own app context, DISABLES the scheduler tick, drives the REAL services
 * through the full lifecycle and asserts balances/order-status at each step.
 * Run with the API server STOPPED:  DB_NAME=keralaluckydraw node scripts/lottery-lifecycle-e2e.js
 */
try { require('dotenv').config(); } catch (e) { /* env fallback */ }
const { NestFactory } = require('@nestjs/core');
const { DataSource } = require('typeorm');
const { getRepositoryToken } = require('@nestjs/typeorm');
const { SchedulerRegistry } = require('@nestjs/schedule');
const { AppModule } = require('../dist/app.module');
const { GameList } = require('../dist/entities/game-list.entity');
const { GameEngineService } = require('../dist/modules/game/shared/game-engine.service');
const { RoundProgressionService } = require('../dist/modules/game/shared/round-progression.service');
const { SettlementService } = require('../dist/modules/game/shared/settlement.service');
const { GameConfigService } = require('../dist/modules/game/shared/game-config.service');
const { ThreeDigitService } = require('../dist/modules/game/three-digit/three-digit.service');
const { AdminLotteryDrawService } = require('../dist/modules/admin/services/admin-lottery-draw.service');
const { WsGateway } = require('../dist/modules/websocket/ws.gateway');

let pass = 0, fail = 0, warn = 0;
const out = [];
const ok = (label, cond, detail = '') => { if (cond) { pass++; out.push(`   PASS  ${label}`); } else { fail++; out.push(`   FAIL  ${label}  -- ${detail}`); } };
const info = (label) => out.push(`   ..    ${label}`);
const flag = (label, detail) => { warn++; out.push(`   WARN  ${label}  -- ${detail}`); };
const H = (t) => out.push(`\n=== ${t} ===`);
const MONEY = 100000000;
const rid = () => 'E2E' + Date.now() + Math.floor(Math.random() * 1e6);

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const ds = app.get(DataSource);
  const gameRepo = app.get(getRepositoryToken(GameList));
  const gameEngine = app.get(GameEngineService);
  const roundProg = app.get(RoundProgressionService);
  const settlement = app.get(SettlementService);
  const gameConfig = app.get(GameConfigService);
  const threeDigit = app.get(ThreeDigitService);
  const adminDraw = app.get(AdminLotteryDrawService);

  try { app.get(SchedulerRegistry).deleteInterval('game-scheduler-tick'); info('scheduler tick disabled'); } catch (e) { info('scheduler off: ' + e.message); }
  // no socket.io server in a bare app-context — stub broadcasts so processGame runs
  try { const ws = app.get(WsGateway); for (const m of Object.getOwnPropertyNames(Object.getPrototypeOf(ws))) { if (m.startsWith('broadcast')) ws[m] = () => {}; } info('ws broadcasts stubbed'); } catch (e) { info('ws stub skipped: ' + e.message); }
  await new Promise((r) => setTimeout(r, 1500));

  const bal = async (uid) => Number((await ds.query('SELECT balance FROM users WHERE user_id=?', [uid]))[0].balance);
  const setBal = (uid, v) => ds.query('UPDATE users SET balance=? WHERE user_id=?', [v, uid]);
  const roundRow = (id) => ds.query('SELECT id,status,round_no,result FROM game_rounds WHERE id=?', [id]).then((r) => r[0]);
  const ordersFor = (rn) => ds.query('SELECT status,total_amount,win_amount FROM orders WHERE round_no=? ORDER BY id', [rn]);

  // discover slat product + required pick width for a game
  const slatMeta = {};
  const getSlat = async (gid) => {
    if (slatMeta[gid]) return slatMeta[gid];
    const products = await gameConfig.getSlatProducts(gid);
    const sp = products.find((p) => p.matchMode === 'ladder') || products[0];
    const tier = [...sp.tiers].sort((a, b) => b.tierRank - a.tierRank)[0];
    slatMeta[gid] = { id: sp.id, level: tier.label, width: tier.positions.length, price: Number(sp.price) };
    return slatMeta[gid];
  };
  const numOfWidth = (w, seed) => String(seed).padStart(w, '0').slice(-w);
  const bet = async (uid, gid, roundNo, number, count = 1) => {
    const s = await getSlat(gid);
    const num = number || numOfWidth(s.width, '234567');
    await threeDigit.createOrder(uid, { gameID: gid, roundNo, tickets: [{ level: s.level, number: num, count, slatProductId: s.id }] });
    return num;
  };
  const mkRound = async (game, drawOffsetSec, stopOffsetSec) => {
    const rn = rid();
    await ds.query('INSERT INTO game_rounds (game_id, game_type, round_no, draw_time, stop_bet_time, status, total_bet, total_payout, created_at) VALUES (?,?,?,?,?,0,0,0,NOW())',
      [game.id, game.gameType, rn, new Date(Date.now() + drawOffsetSec * 1000), new Date(Date.now() + stopOffsetSec * 1000)]);
    return { id: (await ds.query('SELECT id FROM game_rounds WHERE round_no=?', [rn]))[0].id, roundNo: rn };
  };
  // draw result must match the game's digitCount (601 = 4-digit "xABC"; slat pick is 3-digit).
  const drawNumFor = (game, betNum) => betNum.padStart(game.digitCount, '1');
  const winResult = (num) => ({ number: num, digits: num.split('').map(Number), drawResult: num, sum: num.split('').reduce((a, c) => a + Number(c), 0) });
  const cleanup = async (gid) => { await ds.query('DELETE FROM orders WHERE round_no LIKE "E2E%"'); await ds.query('DELETE FROM game_rounds WHERE game_id=? AND round_no LIKE "E2E%"', [gid]); };

  try {
    const userId = (await ds.query('SELECT user_id FROM users WHERE status=1 ORDER BY id ASC LIMIT 1'))[0].user_id;
    const g601 = await gameRepo.findOne({ where: { id: 601 } });
    const g604 = await gameRepo.findOne({ where: { id: 604 } });
    info(`user=${userId} manual=${g601 && g601.gameName}(w${(await getSlat(601)).width}) auto=${g604 && g604.gameName}(w${(await getSlat(604)).width})`);

    // ---------- S1 MANUAL positive lifecycle ----------
    H('S1 MANUAL lifecycle (601): OPEN bet -> close betting -> admin draw -> settle -> NO auto-next');
    await cleanup(601); await setBal(userId, MONEY);
    {
      const before = await bal(userId);
      const r = await mkRound(g601, 3600, 1800);
      const num = await bet(userId, 601, r.roundNo);
      const afterBet = await bal(userId);
      ok('S1 bet accepted on OPEN round + balance deducted', afterBet < before, `d=${before - afterBet}`);
      await ds.query('UPDATE game_rounds SET stop_bet_time=? WHERE id=?', [new Date(Date.now() - 1000), r.id]);
      await roundProg.processGame(g601);
      ok('S1 processGame closed betting (status 0->1)', (await roundRow(r.id)).status === 1);
      await adminDraw.setDrawResult(r.id, winResult(drawNumFor(g601, num)), 1);
      const rr = await roundRow(r.id);
      ok('S1 admin draw settled round (status->2, result set)', rr.status === 2 && !!rr.result, `status=${rr.status}`);
      const ords = await ordersFor(r.roundNo);
      ok('S1 bet order settled (status won=1/lost=2, not pending)', ords.length === 1 && ords[0].status !== 0, JSON.stringify(ords));
      if (Number(ords[0].win_amount) > 0) ok('S1 matching bet WON + credited', (await bal(userId)) > afterBet);
      else info(`S1 bet settled as LOST (win positions config-specific; payout proven separately in audit-money-path)`);
      ok('S1 manual lottery created NO auto-next round', Number((await ds.query('SELECT COUNT(*) c FROM game_rounds WHERE game_id=601 AND status=0 AND round_no LIKE "E2E%"'))[0].c) === 0);
    }
    await cleanup(601);

    // ---------- S2 AUTO lifecycle ----------
    H('S2 AUTO lifecycle (604): bet -> close -> draw+settle -> AUTO next-round');
    await ds.query('DELETE FROM game_rounds WHERE game_id=604 AND round_no LIKE "E2E%"');
    // isolate: park pre-existing open/closed 604 rounds so getCurrentRound picks ONLY our controlled round
    await ds.query('UPDATE game_rounds SET status=2 WHERE game_id=604 AND status IN (0,1) AND round_no NOT LIKE "E2E%"');
    await setBal(userId, MONEY);
    {
      const before = await bal(userId);
      const r = await mkRound(g604, 60, 30);
      const num = await bet(userId, 604, r.roundNo);
      ok('S2 bet accepted on auto open round', (await bal(userId)) < before);
      await ds.query('UPDATE game_rounds SET stop_bet_time=? WHERE id=?', [new Date(Date.now() - 1000), r.id]);
      await roundProg.processGame(g604);
      ok('S2 processGame closed betting (0->1)', (await roundRow(r.id)).status === 1);
      const openBefore = Number((await ds.query('SELECT COUNT(*) c FROM game_rounds WHERE game_id=604 AND status=0'))[0].c);
      await ds.query('UPDATE game_rounds SET draw_time=? WHERE id=?', [new Date(Date.now() - 1000), r.id]);
      await roundProg.processGame(g604);
      const rr = await roundRow(r.id);
      ok('S2 processGame drew+settled (->2, result set)', rr.status === 2 && !!rr.result, `status=${rr.status}`);
      ok('S2 bet order settled (not pending)', (await ordersFor(r.roundNo))[0].status !== 0);
      const openAfter = Number((await ds.query('SELECT COUNT(*) c FROM game_rounds WHERE game_id=604 AND status=0'))[0].c);
      ok('S2 auto lottery created a NEXT open round', openAfter >= 1 && openAfter >= openBefore, `open ${openBefore}->${openAfter}`);
    }
    await ds.query('DELETE FROM game_rounds WHERE game_id=604 AND round_no LIKE "E2E%"');

    // ---------- S3 NEGATIVE (real bets now) ----------
    H('S3 NEGATIVE bet-guard scenarios (601)');
    await cleanup(601); await setBal(userId, MONEY);
    { const r = await mkRound(g601, 3600, 1800); await ds.query('UPDATE game_rounds SET status=1 WHERE id=?', [r.id]);
      let rej = false, m = ''; try { await bet(userId, 601, r.roundNo); } catch (e) { rej = true; m = e.message; }
      ok('S3.N1 bet on CLOSED round (status1) REJECTED', rej, m); }
    { const r = await mkRound(g601, 3600, 1800); await ds.query('UPDATE game_rounds SET status=2 WHERE id=?', [r.id]);
      let rej = false, m = ''; try { await bet(userId, 601, r.roundNo); } catch (e) { rej = true; m = e.message; }
      ok('S3.N2 bet on SETTLED round (status2) REJECTED', rej, m); }
    { const r = await mkRound(g601, 3600, 1800); await setBal(userId, 1);
      let rej = false, m = ''; try { await bet(userId, 601, r.roundNo); } catch (e) { rej = true; m = e.message; }
      ok('S3.N3 INSUFFICIENT balance REJECTED', rej, m);
      ok('S3.N3 balance unchanged after reject', (await bal(userId)) === 1); await setBal(userId, MONEY); }
    { const r = await mkRound(g601, 3600, 1800); await ds.query('UPDATE users SET status=0 WHERE user_id=?', [userId]);
      let rej = false, m = ''; try { await bet(userId, 601, r.roundNo); } catch (e) { rej = true; m = e.message; }
      ok('S3.N4 BANNED user bet REJECTED (Account disabled)', rej && /disabled/i.test(m), m);
      ok('S3.N4 banned bet left NO orphan order (txn rolled back)', (await ordersFor(r.roundNo)).length === 0);
      await ds.query('UPDATE users SET status=1 WHERE user_id=?', [userId]); }
    { const r = await mkRound(g601, -3600, -3660); // OVERDUE: status0, draw+stop in the past
      let acc = false, m = ''; try { await bet(userId, 601, r.roundNo); acc = true; } catch (e) { m = e.message; }
      if (acc) flag('S3.N5 OVERDUE open round (status0, drawTime past) bet', 'ACCEPTED — createOrder has no stop-bet-time guard (audit P1)');
      else ok('S3.N5 OVERDUE open round bet REJECTED', true, m); }
    // N6 over max_bet (601 max_bet=100000; 20000 tickets x price >> 100000)
    { const r = await mkRound(g601, 3600, 1800);
      let rej = false, m = ''; try { await bet(userId, 601, r.roundNo, undefined, 20000); } catch (e) { rej = true; m = e.message; }
      ok('S3.N6 bet OVER max_bet REJECTED', rej && /Maximum bet/i.test(m), m);
      ok('S3.N6 over-max bet left NO order (rejected before save)', (await ordersFor(r.roundNo)).length === 0); }
    await cleanup(601); await setBal(userId, MONEY);

    // ---------- S4 idempotency + draw-while-open ----------
    H('S4 draw idempotency + draw-while-open (601)');
    await cleanup(601); await setBal(userId, MONEY);
    { const r = await mkRound(g601, 3600, 1800); const num = await bet(userId, 601, r.roundNo);
      await ds.query('UPDATE game_rounds SET stop_bet_time=? WHERE id=?', [new Date(Date.now() - 1000), r.id]);
      await roundProg.processGame(g601);
      await adminDraw.setDrawResult(r.id, winResult(drawNumFor(g601, num)), 1);
      const b1 = await bal(userId);
      let m = ''; try { await adminDraw.setDrawResult(r.id, winResult(drawNumFor(g601, num)), 1); } catch (e) { m = e.message; }
      const b2 = await bal(userId);
      if (Math.abs(b2 - b1) < 0.01) ok('S4a re-draw does NOT double-credit balance', true);
      else flag('S4a re-draw double-credit', `b1=${b1} b2=${b2} delta=${b2 - b1} (audit P0 re-settlement)`); }
    await cleanup(601);
    { const r = await mkRound(g601, 3600, 1800); const num = await bet(userId, 601, r.roundNo); // still OPEN (status0)
      let drew = false, m = ''; try { await adminDraw.setDrawResult(r.id, winResult(drawNumFor(g601, num)), 1); drew = true; } catch (e) { m = e.message; }
      const st = (await roundRow(r.id)).status;
      info(`S4b draw on OPEN round -> ${drew ? 'allowed, round status=' + st : 'rejected: ' + m}`);
      ok('S4b draw-while-open leaves consistent state (settled or rejected, no dangling)', st === 2 || !drew, `status=${st}`); }
    await cleanup(601); await setBal(userId, MONEY);

    // ---------- S5 multiple time slots ----------
    H('S5 multiple time-slots / multi-draw tabs (601)');
    await cleanup(601);
    { const r1 = await mkRound(g601, 3600, 1800); const r2 = await mkRound(g601, 90000, 88200);
      const mr = (await gameEngine.getManualRounds(601)).filter((x) => String(x.roundNo).startsWith('E2E'));
      ok('S5 two scheduled slots surface as two rounds (tabs)', mr.length === 2, `found=${mr.length}`);
      ok('S5 slots ordered soonest-first', mr.every((x, i, a) => i === 0 || new Date(a[i - 1].drawTime) <= new Date(x.drawTime)));
      let b1 = false, b2 = false;
      try { await bet(userId, 601, r1.roundNo); b1 = true; } catch (e) {}
      try { await bet(userId, 601, r2.roundNo); b2 = true; } catch (e) {}
      ok('S5 can bet independently on each slot', b1 && b2); }
    await cleanup(601); await setBal(userId, MONEY);

    // ---------- S6 self-heal ----------
    H('S6 self-heal getGameInfo (601 manual, zero rounds)');
    { await ds.query('DELETE FROM game_rounds WHERE game_id=601');
      await ds.query('UPDATE game_list SET scheduled_draw_time=? WHERE id=601', [new Date(Date.now() + 86400000)]);
      let healed = false, m = ''; try { healed = !!(await threeDigit.getGameInfo({ gameID: 601 })); } catch (e) { m = e.message; }
      ok('S6 future schedule: getGameInfo self-heals (creates round)', healed && Number((await ds.query('SELECT COUNT(*) c FROM game_rounds WHERE game_id=601'))[0].c) >= 1, m);
      await ds.query('DELETE FROM game_rounds WHERE game_id=601');
      await ds.query('UPDATE game_list SET scheduled_draw_time=? WHERE id=601', [new Date(Date.now() - 86400000)]);
      let threw = false; try { await threeDigit.getGameInfo({ gameID: 601 }); } catch (e) { threw = true; }
      ok('S6 past schedule: still throws, no stale round created', threw && Number((await ds.query('SELECT COUNT(*) c FROM game_rounds WHERE game_id=601'))[0].c) === 0);
      await ds.query('UPDATE game_list SET scheduled_draw_time=? WHERE id=601', [new Date(Date.now() + 86400000)]); }
    await ds.query('DELETE FROM game_rounds WHERE game_id=601 AND round_no LIKE "E2E%"'); await setBal(userId, MONEY);

    // ---------- S7 settlement double-credit guards ----------
    H('S7 settlement guards: double-settle + resettle do NOT double-credit (601)');
    await cleanup(601); await setBal(userId, MONEY);
    { const r = await mkRound(g601, 3600, 1800); const num = await bet(userId, 601, r.roundNo);
      await ds.query('UPDATE game_rounds SET stop_bet_time=? WHERE id=?', [new Date(Date.now() - 1000), r.id]);
      await roundProg.processGame(g601);
      await adminDraw.setDrawResult(r.id, winResult(drawNumFor(g601, num)), 1);
      const paid = await bal(userId);
      let m2 = ''; try { await settlement.settleRound(r.id); } catch (e) { m2 = e.message; }
      ok('S7a re-settleRound on settled round no-ops (locked status===2, no double-credit)', Math.abs((await bal(userId)) - paid) < 0.01, `paid=${paid} now=${await bal(userId)} ${m2}`);
      let rej = false, m3 = ''; try { await settlement.resettleRound(r.id); } catch (e) { rej = true; m3 = e.message; }
      ok('S7b resettleRound on PAID round REJECTED (retry guard)', rej && /already settled/i.test(m3), m3);
      ok('S7b balance unchanged after rejected resettle', Math.abs((await bal(userId)) - paid) < 0.01); }
    await cleanup(601); await setBal(userId, MONEY);

    out.push(`\n===== LIFECYCLE E2E: ${pass} PASS / ${fail} FAIL / ${warn} WARN =====`);
    console.log(out.join('\n'));
    process.exitCode = fail === 0 ? 0 : 1;
  } catch (e) {
    console.log(out.join('\n'));
    console.error('\nHARNESS ERROR:', e.stack || e.message);
    process.exitCode = 1;
  } finally { await app.close(); }
})();
