import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('system_config')
export class SystemConfig {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'config_key', type: 'varchar', length: 100, unique: true })
  configKey: string;

  @Column({ name: 'config_val', type: 'text', nullable: true })
  configVal: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @Index()
  @Column({ name: 'config_group', type: 'varchar', length: 50, nullable: true })
  configGroup: string;

  @Column({
    name: 'config_type',
    type: 'varchar',
    length: 20,
    default: 'string',
  })
  configType: string;

  @Column({
    name: 'display_label',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  displayLabel: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
