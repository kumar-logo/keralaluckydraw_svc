import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('game_number_prefix')
export class GameNumberPrefix {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ type: 'varchar', length: 4 })
  prefix: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
