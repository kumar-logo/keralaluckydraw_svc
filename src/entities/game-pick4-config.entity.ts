import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('game_pick4_config')
export class GamePick4Config {
  @PrimaryColumn({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'pick_variant', type: 'tinyint', default: 1 })
  pickVariant: number;

  @Column({
    name: 'pick4_price',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  pick4Price: number;

  @Column({
    name: 'pick5_price',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  pick5Price: number;
}
