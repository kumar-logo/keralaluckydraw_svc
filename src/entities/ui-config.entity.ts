import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ui_config')
export class UiConfig {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({
    name: 'sprite_scale',
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 0.75,
  })
  spriteScale: number;

  @Column({ name: 'cat_lottery', type: 'int', default: 1 })
  catLottery: number;

  @Column({ name: 'cat_casino', type: 'int', default: 5 })
  catCasino: number;

  @Column({ name: 'cat_slot', type: 'int', default: 6 })
  catSlot: number;

  @Column({ name: 'cat_lobby', type: 'int', default: 1020 })
  catLobby: number;

  @Column({ name: 'cat_live', type: 'int', default: 1025 })
  catLive: number;

  @Column({ name: 'cat_fishing', type: 'int', default: 1026 })
  catFishing: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
