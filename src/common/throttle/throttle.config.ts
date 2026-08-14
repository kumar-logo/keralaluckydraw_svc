import { ThrottlerModuleOptions } from '@nestjs/throttler';

export enum ThrottleProfile {
  Default = 'default',
}

const TEN_SECONDS_MS = 10_000;
const ONE_MINUTE_MS = 60_000;
const FIVE_MINUTES_MS = 300_000;

export const CHAT_SEND_LIMIT = { ttl: TEN_SECONDS_MS, limit: 15 } as const;
export const CHAT_UPLOAD_LIMIT = { ttl: ONE_MINUTE_MS, limit: 20 } as const;
export const OTP_SEND_LIMIT = { ttl: FIVE_MINUTES_MS, limit: 3 } as const;
export const OTP_VERIFY_LIMIT = { ttl: FIVE_MINUTES_MS, limit: 5 } as const;
export const LOGIN_LIMIT = { ttl: ONE_MINUTE_MS, limit: 10 } as const;
export const FINANCE_LIMIT = { ttl: ONE_MINUTE_MS, limit: 10 } as const;

export const throttleConfig: ThrottlerModuleOptions = [
  {
    name: ThrottleProfile.Default,
    ttl: ONE_MINUTE_MS,
    limit: 120,
  },
];
