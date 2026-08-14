import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('cashrain_window')
export class CashrainWindow {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'day_start', type: 'smallint', default: 1 })
  dayStart: number;

  @Column({ name: 'day_end', type: 'smallint', default: 31 })
  dayEnd: number;

  @Column({ name: 'start_minute', type: 'smallint' })
  startMinute: number;

  @Column({ name: 'end_minute', type: 'smallint' })
  endMinute: number;

  @Column({ name: 'max_claims_per_user', type: 'smallint', default: 1 })
  maxClaimsPerUser: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'tinyint', default: 1 })
  status: number;
}
