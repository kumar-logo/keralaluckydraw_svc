import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('lobby_config')
export class LobbyConfig {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'filter_icon', type: 'varchar', length: 500, default: '' })
  filterIcon: string;

  @Column({ name: 'light_icon', type: 'varchar', length: 500, default: '' })
  lightIcon: string;

  @Column({ name: 'filter_width', type: 'int', default: 518 })
  filterWidth: number;

  @Column({ name: 'filter_height', type: 'int', default: 794 })
  filterHeight: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
