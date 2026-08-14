import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const CANONICAL_PRODUCTION_ORIGINS: readonly string[] = [
  'https://keralaluckydraw.com',
  'https://www.keralaluckydraw.com',
  'https://admin.keralaluckydraw.com',
];

const LOCAL_DEVELOPMENT_ORIGIN_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const SPA_REQUEST_HEADERS: readonly string[] = [
  'Content-Type',
  'Authorization',
  'Token',
  'X-Requested-With',
  'packageId',
  'packageInfo',
  'standalone',
  'channel',
  'channelId',
  'reqDate',
  'lang',
  'origin_lang',
  'visitor',
  'versionCode',
  'FCMInstanceToken',
  'pixelid',
  'fbp',
  'fbc',
];

function parseEnvOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry !== '*');
}

function resolveAllowedOrigins(): Set<string> {
  const origins = new Set<string>(CANONICAL_PRODUCTION_ORIGINS);
  for (const origin of parseEnvOrigins(process.env.CORS_ORIGIN)) {
    origins.add(origin);
  }
  return origins;
}

function isOriginAllowed(origin: string, allowed: Set<string>): boolean {
  if (allowed.has(origin)) return true;
  return LOCAL_DEVELOPMENT_ORIGIN_PATTERN.test(origin);
}

export function buildCorsOptions(): CorsOptions {
  const allowed = resolveAllowedOrigins();
  return {
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ): void => {
      if (origin === undefined || isOriginAllowed(origin, allowed)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [...SPA_REQUEST_HEADERS],
    exposedHeaders: ['Content-Disposition'],
    credentials: true,
    optionsSuccessStatus: 204,
  };
}
