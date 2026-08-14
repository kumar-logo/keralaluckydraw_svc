import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Index('idx_lobby_section_scope', ['scope'])
@Entity('lobby_section')
export class LobbySection {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'scope', type: 'varchar', length: 20 })
  scope: string;

  @Column({ name: 'filter_type', type: 'varchar', length: 60 })
  filterType: string;

  @Column({ name: 'filter_name', type: 'varchar', length: 100 })
  filterName: string;

  @Column({ name: 'row_count', type: 'int', nullable: true })
  rows: number | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
