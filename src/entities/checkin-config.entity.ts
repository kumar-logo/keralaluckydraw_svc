import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('checkin_config')
export class CheckinConfig {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'day_num', type: 'tinyint', unique: true })
  dayNum: number;

  @Column({
    name: 'award_type',
    type: 'varchar',
    length: 20,
    nullable: true,
    default: 'chip',
  })
  awardType: string;

  @Column({ name: 'award_num', type: 'decimal', precision: 16, scale: 2 })
  awardNum: number;

  @Column({ type: 'tinyint', nullable: true, default: 1 })
  status: number;
}
