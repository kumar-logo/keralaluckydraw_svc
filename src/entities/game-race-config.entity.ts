import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('game_race_config')
export class GameRaceConfig {
  @PrimaryColumn({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'runner_count', type: 'int', default: 6 })
  runnerCount: number;

  @Column({ name: 'race_frames', type: 'int', default: 20 })
  raceFrames: number;
}
