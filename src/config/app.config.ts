export const appConfig = () => ({
  port: parseInt(process.env.PORT ?? '', 10) || 3000,
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret-in-production',
    expiresIn: (process.env.JWT_EXPIRES || '30d') as any,
  },
  sms: {
    provider: process.env.SMS_PROVIDER || 'mock',
    apiKey: process.env.SMS_API_KEY || '',
    apiSecret: process.env.SMS_API_SECRET || '',
  },
  upload: {
    maxSize: 5 * 1024 * 1024,
    dest: process.env.UPLOAD_DIR || './uploads',
  },
});
