import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FcmService } from '../../modules/fcm/fcm.service';

interface AuthedRequest {
  user?: { userId?: string };
  headers: Record<string, string | string[] | undefined>;
}

const DEDUPE_TTL_MS = 10 * 60 * 1000;
const MAX_TRACKED = 5000;

@Injectable()
export class FcmTokenHeaderInterceptor implements NestInterceptor {
  private readonly seen = new Map<string, number>();

  constructor(private readonly fcm: FcmService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      this.registerFromHeader(
        context.switchToHttp().getRequest<AuthedRequest>(),
      );
    }
    return next.handle();
  }

  private registerFromHeader(request: AuthedRequest): void {
    const userId = request.user?.userId;
    if (!userId) return;

    const raw = request.headers['fcminstancetoken'];
    const token = Array.isArray(raw) ? raw[0] : raw;
    if (!token || token === 'null' || token.trim().length === 0) return;

    const key = `${userId}:${token}`;
    const now = Date.now();
    const last = this.seen.get(key);
    if (last !== undefined && now - last < DEDUPE_TTL_MS) return;

    if (this.seen.size >= MAX_TRACKED) this.prune(now);
    this.seen.set(key, now);

    void this.fcm.registerToken(userId, token).catch(() => undefined);
  }

  private prune(now: number): void {
    for (const [key, ts] of this.seen) {
      if (now - ts >= DEDUPE_TTL_MS) this.seen.delete(key);
    }
    if (this.seen.size >= MAX_TRACKED) this.seen.clear();
  }
}
