import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ConfigLoaderService } from '../../modules/config/config-loader.service';
import { GameInfoCacheStore } from '../game-info-cache.store';

const ANONYMOUS_USER_KEY = 'anon';

interface CacheableRequest {
  method?: string;
  originalUrl: string;
  user?: { userId?: number | string; sub?: number | string };
}

@Injectable()
export class GameInfoCacheInterceptor implements NestInterceptor {
  private ttlMs = 1000;
  private nextTtlReload = 0;

  constructor(
    private readonly configLoader: ConfigLoaderService,
    private readonly store: GameInfoCacheStore,
  ) {}

  private async reloadTtl(now: number): Promise<void> {
    if (now < this.nextTtlReload) return;
    this.nextTtlReload = now + 30000;
    this.ttlMs = await this.configLoader.getGameinfoCacheTtlMs();
  }

  private isCacheable(req: CacheableRequest): boolean {
    if (req.method !== 'GET') return false;
    const url = req.originalUrl;
    if (!url.includes('/game/api/')) return false;
    return url.includes('/game/info') || url.includes('/info/query');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<CacheableRequest>();
    if (!this.isCacheable(req)) return next.handle();

    const now = Date.now();
    void this.reloadTtl(now);
    if (this.ttlMs <= 0) return next.handle();

    const user = req.user;
    const identifier =
      user === undefined ? undefined : (user.userId ?? user.sub);
    const userKey =
      identifier === undefined ? ANONYMOUS_USER_KEY : String(identifier);
    const key = req.originalUrl + '|u:' + userKey;
    const hit = this.store.get(key, now);
    if (hit !== undefined) {
      return of(hit);
    }

    return next.handle().pipe(
      tap((data) => {
        this.store.set(key, data, now + this.ttlMs);
      }),
    );
  }
}
