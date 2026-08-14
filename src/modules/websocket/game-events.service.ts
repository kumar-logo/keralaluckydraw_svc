import { Injectable } from '@nestjs/common';
import { Observable, Subject, filter } from 'rxjs';

export enum GameEventKind {
  GameUpdate = 'game_update',
  DrawResult = 'draw_result',
  Heartbeat = 'heartbeat',
}

export interface GameRealtimeEvent {
  kind: GameEventKind;
  gameId: number;
  serverTime: number;
  [key: string]: unknown;
}

@Injectable()
export class GameEventsService {
  private readonly stream = new Subject<GameRealtimeEvent>();

  emit(event: GameRealtimeEvent): void {
    this.stream.next(event);
  }

  forGames(gameIds: number[]): Observable<GameRealtimeEvent> {
    if (gameIds.length === 0) {
      return this.stream.asObservable();
    }
    return this.stream
      .asObservable()
      .pipe(filter((event) => gameIds.includes(event.gameId)));
  }
}
