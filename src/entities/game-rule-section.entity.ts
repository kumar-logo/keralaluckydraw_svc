import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('game_rule_section')
export class GameRuleSection {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
