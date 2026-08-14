import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const APP_TIME_ZONE_OFFSET = '+05:30';

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '', 10) || 3306,
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'keralaluckydraw',
  entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
  migrationsRun: false,
  logging: ['error', 'warn', 'schema', 'migration'],
  charset: 'utf8mb4',
  timezone: APP_TIME_ZONE_OFFSET,
  extra: {
    connectionLimit: 20,
  },
});
