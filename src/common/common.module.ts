import { Global, Module } from '@nestjs/common';
import { GameInfoCacheStore } from './game-info-cache.store';

@Global()
@Module({
  providers: [GameInfoCacheStore],
  exports: [GameInfoCacheStore],
})
export class CommonModule {}
