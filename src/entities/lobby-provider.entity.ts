import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Index('idx_lobby_provider_cat', ['categoryId'])
@Entity('lobby_provider')
export class LobbyProvider {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'category_id', type: 'int', nullable: true })
  categoryId: number | null;

  @Column({ name: 'filter_type', type: 'varchar', length: 60 })
  filterType: string;

  @Column({ name: 'filter_name', type: 'varchar', length: 100 })
  filterName: string;

  @Column({ name: 'big_icon_x', type: 'int', default: 0 })
  bigIconX: number;

  @Column({ name: 'big_icon_y', type: 'int', default: 0 })
  bigIconY: number;

  @Column({ name: 'icon_x', type: 'int', default: 0 })
  iconX: number;

  @Column({ name: 'icon_y', type: 'int', default: 0 })
  iconY: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
