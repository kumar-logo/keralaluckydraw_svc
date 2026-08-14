import { Controller, Sse, Query } from '@nestjs/common';
import { Observable, interval, map, merge } from 'rxjs';
import { Public } from '../../common/decorators/public.decorator';
import { SkipResponseTransform } from '../../common/decorators/skip-response-transform.decorator';
import {
  GameEventsService,
  GameEventKind,
  GameRealtimeEvent,
} from './game-events.service';

interface SseMessage {
  data: GameRealtimeEvent;
}

const HEARTBEAT_INTERVAL_MS = 10000;

@Controller('game/api/events')
export class GameEventsController {
  constructor(private readonly gameEvents: GameEventsService) {}

  @Public()
  @SkipResponseTransform()
  @Sse('stream')
  stream(@Query('gameIds') gameIds?: string): Observable<SseMessage> {
    const ids =
      gameIds === undefined
        ? []
        : gameIds
            .split(',')
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0);

    const events = this.gameEvents
      .forGames(ids)
      .pipe(map((event): SseMessage => ({ data: event })));

    const heartbeat = interval(HEARTBEAT_INTERVAL_MS).pipe(
      map(
        (): SseMessage => ({
          data: {
            kind: GameEventKind.Heartbeat,
            gameId: 0,
            serverTime: Date.now(),
          },
        }),
      ),
    );

    return merge(events, heartbeat);
  }
}
