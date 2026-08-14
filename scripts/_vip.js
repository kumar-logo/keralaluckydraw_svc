const mysql = require('mysql2/promise');
require('dotenv').config();
(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  const [v] = await db.query(
    'SELECT level,level_name,min_bet,min_recharge,daily_reward,monthly_reward,status FROM vip_config ORDER BY level',
  );
  console.log('vip_config:');
  console.table(v);
  const [c] = await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='app_config' AND column_name LIKE '%vip%' OR (table_schema=DATABASE() AND table_name='app_config' AND column_name LIKE '%salary%')",
  );
  console.log('app_config vip/salary cols:', JSON.stringify(c));
  await db.end();
})().catch((e) => console.error('ERR', e.message));
