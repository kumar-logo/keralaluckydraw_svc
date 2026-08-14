import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('share_channel')
export class ShareChannel {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 60 })
  name: string;

  @Column({ name: 'icon', type: 'varchar', length: 60 })
  icon: string;

  @Column({ name: 'url', type: 'varchar', length: 500 })
  url: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
