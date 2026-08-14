import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'group_name', type: 'varchar', length: 50, nullable: true })
  groupName: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
