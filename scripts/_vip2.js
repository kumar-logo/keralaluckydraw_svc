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
    'SELECT level,level_name,daily_reward,monthly_reward,status FROM vip_config ORDER BY level',
  );
  console.log('vip_config rows:');
  console.table(v);
  const hasZero = v.some(
    (r) => Number(r.level) === 0 && Number(r.status) === 1,
  );
  console.log('VIP0 active config exists?', hasZero);
  await db.end();
})().catch((e) => console.error('ERR', e.message));
