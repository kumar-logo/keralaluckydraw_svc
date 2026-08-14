import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Index('idx_ui_status_map_domain', ['domain'])
@Entity('ui_status_map')
export class UiStatusMap {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'domain', type: 'varchar', length: 20 })
  domain: string;

  @Column({ name: 'status', type: 'int' })
  status: number;

  @Column({ name: 'status_text', type: 'varchar', length: 60 })
  text: string;

  @Column({ name: 'color', type: 'varchar', length: 20 })
  color: string;
}
