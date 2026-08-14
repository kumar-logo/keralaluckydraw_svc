import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('game_prize_tier')
export class GamePrizeTier {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ type: 'int' })
  level: number;

  @Column({ name: 'tier_name', type: 'varchar', length: 30, nullable: true })
  tierName: string;

  @Column({ name: 'match_rule', type: 'varchar', length: 30, nullable: true })
  matchRule: string;

  @Column({ name: 'prize_label', type: 'varchar', length: 30, nullable: true })
  prizeLabel: string;

  @Column({
    name: 'prize_value',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  prizeValue: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
