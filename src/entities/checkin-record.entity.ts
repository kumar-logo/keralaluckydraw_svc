import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('checkin_records')
@Index('uk_user_day_time', ['userId', 'dayNum', 'timeKey'], { unique: true })
export class CheckinRecord {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Column({ name: 'day_num', type: 'tinyint' })
  dayNum: number;

  @Column({ name: 'time_key', type: 'varchar', length: 20 })
  timeKey: string;

  @Column({ name: 'act_key', type: 'varchar', length: 50, nullable: true })
  actKey: string;

  @Column({
    name: 'award_num',
    type: 'decimal',
    precision: 16,
    scale: 2,
    nullable: true,
  })
  awardNum: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
