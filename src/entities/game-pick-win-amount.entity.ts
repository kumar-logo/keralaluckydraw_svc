import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('game_pick_win_amount')
export class GamePickWinAmount {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'pick_info_id', type: 'int', unsigned: true })
  pickInfoId: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  amount: number;
}
