import { Injectable } from '@nestjs/common';

interface CacheEntry {
  expiresAt: number;
  data: unknown;
}

// Shared, invalidatable store behind GameInfoCacheInterceptor. The scheduler
// clears it on every round transition (draw / new round) so getGameInfo can
// never serve a round, countdown, or last-result that straddles a draw
// boundary — the root cause of the "old/wrong result + time conflict" symptom.
@Injectable()
export class GameInfoCacheStore {
  private store = new Map<string, CacheEntry>();

  get(key: string, now: number): unknown | undefined {
    const hit = this.store.get(key);
    if (hit && hit.expiresAt > now) return hit.data;
    return undefined;
  }

  set(key: string, data: unknown, expiresAt: number): void {
    this.store.set(key, { expiresAt, data });
    if (this.store.size > 5000) {
      const now = Date.now();
      for (const [k, entry] of this.store) {
        if (entry.expiresAt <= now) this.store.delete(k);
      }
    }
  }

  invalidateAll(): void {
    this.store.clear();
  }
}
