import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('game_wheel_config')
export class GameWheelConfig {
  @PrimaryColumn({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'item_count', type: 'int', default: 12 })
  itemCount: number;

  @Column({ name: 'multiple_count', type: 'int', default: 30 })
  multipleCount: number;

  @Column({ name: 'free_spins', type: 'int', default: 0 })
  freeSpins: number;

  @Column({ name: 'cover_img_id', type: 'varchar', length: 64, nullable: true })
  coverImgId: string;
}
