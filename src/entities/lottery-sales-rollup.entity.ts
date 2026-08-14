import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  UpdateDateColumn,
} from 'typeorm';

@Entity('lottery_sales_rollup')
@Index(
  'uk_rollup_slice',
  [
    'gameId',
    'drawDate',
    'slotTime',
    'roundNo',
    'slot',
    'position',
    'number',
    'price',
    'winPrice',
  ],
  { unique: true },
)
@Index('idx_rollup_game_date', ['gameId', 'drawDate'])
export class LotterySalesRollup {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'draw_date', type: 'date' })
  drawDate: string;

  @Column({ name: 'slot_time', type: 'varchar', length: 5, default: '' })
  slotTime: string;

  @Column({ name: 'round_no', type: 'varchar', length: 30, default: '' })
  roundNo: string;

  @Column({ type: 'int' })
  slot: number;

  @Column({ type: 'varchar', length: 8 })
  position: string;

  @Column({ name: 'pos_len', type: 'int' })
  posLen: number;

  @Column({ type: 'varchar', length: 12 })
  number: string;

  @Column({ type: 'decimal', precision: 16, scale: 2 })
  price: number;

  @Column({ name: 'win_price', type: 'decimal', precision: 16, scale: 2 })
  winPrice: number;

  @Column({ name: 'sales_qty', type: 'int', default: 0 })
  salesQty: number;

  @Column({ name: 'draw_qty', type: 'int', default: 0 })
  drawQty: number;

  @Column({
    name: 'draw_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  drawAmount: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
