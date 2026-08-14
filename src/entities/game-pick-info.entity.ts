import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('game_pick_info')
export class GamePickInfo {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'pick_info_id', type: 'int' })
  pickInfoId: number;

  @Column({ name: 'pick_level', type: 'int' })
  pickLevel: number;

  @Column({ name: 'pick_title', type: 'varchar', length: 50 })
  pickTitle: string;

  @Column({ name: 'pick_amount', type: 'int', default: 0 })
  pickAmount: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
