import 'dotenv/config';
import { webcrypto } from 'node:crypto';
if (!(globalThis as { crypto?: unknown }).crypto) {
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { DataSource } from 'typeorm';
import type { Request, Response, NextFunction } from 'express';
import type { Pool, PoolConnection } from 'mysql2';
import { AppModule } from './app.module';
import { SpaWsService } from './modules/websocket/spa-ws.service';
import { appConfig } from './config/app.config';
import { buildCorsOptions } from './config/cors.config';
import { APP_TIME_ZONE_OFFSET } from './config/database.config';

interface MysqlPoolDriver {
  pool?: Pool;
}

function pinDatabaseSessionTimeZone(dataSource: DataSource): void {
  const driver = dataSource.driver as unknown as MysqlPoolDriver;
  const pool = driver.pool;
  if (!pool) return;
  const setStatement = `SET time_zone = '${APP_TIME_ZONE_OFFSET}'`;
  pool.on('connection', (connection: PoolConnection) => {
    connection.query(setStatement);
  });
  pool.query(setStatement);
}

function registerProcessSafetyNet(): void {
  const logger = new Logger('Process');
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error(
      `Unhandled promise rejection: ${
        reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)
      }`,
    );
  });
  process.on('uncaughtException', (error: Error) => {
    logger.error(`Uncaught exception: ${error.stack ?? error.message}`);
  });
}

async function bootstrap() {
  registerProcessSafetyNet();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.set('trust proxy', 1);

  app.useBodyParser('json', { limit: '15mb' });
  app.useBodyParser('urlencoded', { limit: '15mb', extended: true });

  if (
    appConfig().jwt.secret === 'change-this-secret-in-production' &&
    process.env.NODE_ENV === 'production'
  ) {
    throw new Error('JWT_SECRET must be set in production');
  }

  const ds = app.get(DataSource);
  if (!ds.isInitialized) {
    console.error(
      'DATABASE NOT CONNECTED — check MySQL is running and .env DB settings are correct',
    );
  } else {
    console.log('Database connected successfully');
    pinDatabaseSessionTimeZone(ds);
  }

  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'");
      res.setHeader('Content-Disposition', 'inline');
    },
  });

  app.use(compression());
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'img-src': ["'self'", 'data:', 'blob:', 'https:', 'http:'],
        },
      },
    }),
  );

  app.enableCors(buildCorsOptions());

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/uploads')) {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle(process.env.APP_NAME || 'Kerala Lottery API')
    .setDescription(
      process.env.APP_DESCRIPTION || 'Kerala Lottery Platform Backend API',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'Token', in: 'header' }, 'Token')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const spaWs = app.get(SpaWsService);
  const httpServer = app.getHttpServer();
  spaWs.attachToServer(httpServer);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error(
    `Fatal bootstrap error: ${
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    }`,
  );
  process.exit(1);
});
