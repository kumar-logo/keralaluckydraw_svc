import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { App, cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { FirebaseConfig } from '../../entities/firebase-config.entity';
import { UserFcmToken } from '../../entities/user-fcm-token.entity';

const FCM_APP_NAME = 'kerala-fcm';
const INVALID_TOKEN_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
];

export interface FcmWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
  vapidKey: string;
}

export interface FcmPushPayload {
  title: string;
  body: string;
  data: Record<string, string>;
  image?: string;
}

interface ServiceAccountShape {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private app: App | null = null;
  private messaging: Messaging | null = null;
  private initializedFingerprint: string | null = null;

  constructor(
    @InjectRepository(FirebaseConfig)
    private readonly firebaseConfigRepo: Repository<FirebaseConfig>,
    @InjectRepository(UserFcmToken)
    private readonly tokenRepo: Repository<UserFcmToken>,
  ) {}

  async getConfig(): Promise<FirebaseConfig> {
    let config = await this.firebaseConfigRepo.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (!config) {
      config = await this.firebaseConfigRepo.save(
        this.firebaseConfigRepo.create({
          id: 1,
          apiKey: '',
          authDomain: '',
          projectId: '',
          storageBucket: '',
          messagingSenderId: '',
          appId: '',
          measurementId: '',
          vapidKey: '',
          serviceAccountJson: '',
        }),
      );
    }
    return config;
  }

  async saveConfig(data: Partial<FirebaseConfig>): Promise<FirebaseConfig> {
    const rest: Partial<FirebaseConfig> = { ...data };
    delete rest.id;
    delete rest.createdAt;
    delete rest.updatedAt;
    const existing = await this.firebaseConfigRepo.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (existing) {
      await this.firebaseConfigRepo.update(existing.id, rest);
    } else {
      await this.firebaseConfigRepo.save(
        this.firebaseConfigRepo.create({ ...rest, id: 1 }),
      );
    }
    this.resetApp();
    return this.getConfig();
  }

  getWebConfig(config: FirebaseConfig): FcmWebConfig {
    return {
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
      measurementId: config.measurementId,
      vapidKey: config.vapidKey,
    };
  }

  async registerToken(userId: string, token: string): Promise<void> {
    const trimmed = token.trim();
    if (trimmed.length === 0) return;
    const existing = await this.tokenRepo.findOne({
      where: { token: trimmed },
    });
    if (existing) {
      if (existing.userId !== userId) {
        await this.tokenRepo.update(existing.id, { userId });
      }
      return;
    }
    await this.tokenRepo.save(
      this.tokenRepo.create({ userId, token: trimmed }),
    );
  }

  async sendToUser(userId: string, payload: FcmPushPayload): Promise<void> {
    const tokens = await this.loadTokens([userId]);
    await this.dispatch(tokens, payload);
  }

  async sendBroadcast(payload: FcmPushPayload): Promise<void> {
    const rows = await this.tokenRepo.find();
    const tokens = rows.map((row) => row.token);
    await this.dispatch(tokens, payload);
  }

  private async loadTokens(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await this.tokenRepo.find({
      where: { userId: In(userIds) },
    });
    return rows.map((row) => row.token);
  }

  private async dispatch(
    tokens: string[],
    payload: FcmPushPayload,
  ): Promise<void> {
    if (tokens.length === 0) return;
    const messaging = await this.getMessaging();
    if (!messaging) return;
    const invalidTokens: string[] = [];
    for (const token of tokens) {
      try {
        await messaging.send({
          token,
          notification: {
            title: payload.title,
            body: payload.body,
            ...(payload.image ? { imageUrl: payload.image } : {}),
          },
          data: payload.data,
          ...(payload.image
            ? {
                android: { notification: { imageUrl: payload.image } },
                webpush: { notification: { image: payload.image } },
                apns: { fcmOptions: { imageUrl: payload.image } },
              }
            : {}),
        });
      } catch (error) {
        if (this.isInvalidTokenError(error)) {
          invalidTokens.push(token);
        } else {
          this.logger.warn(
            `FCM send failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
    await this.pruneTokens(invalidTokens);
  }

  private async pruneTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.tokenRepo.delete({ token: In(tokens) });
    this.logger.log(`Pruned ${tokens.length} invalid FCM token(s)`);
  }

  private isInvalidTokenError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' && INVALID_TOKEN_CODES.includes(code);
  }

  private async getMessaging(): Promise<Messaging | null> {
    const config = await this.getConfig();
    const raw = config.serviceAccountJson;
    if (raw === null || raw.trim().length === 0) {
      this.logger.log(
        'FCM service account JSON is empty; skipping push (in-app notification unaffected)',
      );
      this.resetApp();
      return null;
    }
    if (this.messaging && this.initializedFingerprint === raw) {
      return this.messaging;
    }
    this.resetApp();
    const account = this.parseServiceAccount(raw);
    if (!account) return null;
    try {
      this.app = initializeApp(
        {
          credential: cert({
            projectId: account.project_id,
            clientEmail: account.client_email,
            privateKey: account.private_key,
          }),
        },
        FCM_APP_NAME,
      );
      this.messaging = getMessaging(this.app);
      this.initializedFingerprint = raw;
      this.logger.log('Firebase Admin initialized for FCM push delivery');
      return this.messaging;
    } catch (error) {
      this.logger.error(
        `Failed to initialize Firebase Admin: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.resetApp();
      return null;
    }
  }

  private parseServiceAccount(raw: string): Required<ServiceAccountShape> | null {
    let parsed: ServiceAccountShape;
    try {
      parsed = JSON.parse(raw) as ServiceAccountShape;
    } catch {
      this.logger.error('Firebase service account JSON is not valid JSON');
      return null;
    }
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      this.logger.error(
        'Firebase service account JSON missing project_id/client_email/private_key',
      );
      return null;
    }
    return {
      project_id: parsed.project_id,
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    };
  }

  private resetApp(): void {
    if (this.app) {
      void deleteApp(this.app).catch(() => undefined);
    }
    this.app = null;
    this.messaging = null;
    this.initializedFingerprint = null;
  }
}
