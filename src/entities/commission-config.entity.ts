import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('agent_levels')
export class CommissionConfig {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'tinyint', unsigned: true, unique: true })
  level: number;

  @Column({ name: 'level_name', type: 'varchar', length: 50, nullable: true })
  levelName: string;

  @Column({
    name: 'commission_rate',
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0,
  })
  rate: number;

  @Column({ name: 'game_type', type: 'varchar', length: 30, nullable: true })
  gameType: string | null;

  @Column({ name: 'min_subordinates', type: 'int', default: 0 })
  minSubordinates: number;

  @Column({
    name: 'min_recharge',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
  })
  minRecharge: number;

  @Column({ type: 'tinyint', default: 1 })
  status: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
