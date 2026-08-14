require('dotenv').config();
const mysql = require('mysql2/promise');
(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  const [g] = await db.query(
    'SELECT id,game_name,result_house_edge_target,max_profit FROM game_list WHERE id IN (1201,1202)',
  );
  console.log('box game edge config:', JSON.stringify(g));
  const [led] = await db.query(
    'SELECT * FROM game_payout_ledger WHERE game_id IN (1201,1202,1203) ORDER BY game_id',
  );
  console.log('payout ledger:', JSON.stringify(led));
  // global default in app_config / config table
  const [cfg] = await db
    .query('SELECT * FROM app_config LIMIT 1')
    .catch(() => [[{}]]);
  const keys = Object.keys(cfg[0] || {}).filter((k) =>
    /edge|house|profit/i.test(k),
  );
  console.log(
    'app_config edge keys:',
    JSON.stringify(keys.map((k) => ({ [k]: cfg[0][k] }))),
  );
  await db.end();
})().catch((e) => console.error(e.message));
