import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('game_kerala_config')
export class GameKeralaConfig {
  @PrimaryColumn({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'ticket_length', type: 'int', default: 6 })
  ticketLength: number;

  @Column({ name: 'can_insurance', type: 'tinyint', default: 0 })
  canInsurance: number;

  @Column({
    name: 'insurance_rate',
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 0.1,
  })
  insuranceRate: number;

  @Column({ name: 'prefix_1st', type: 'varchar', length: 8, nullable: true })
  prefix1st: string;

  @Column({ name: 'second_count', type: 'int', default: 0 })
  secondCount: number;

  @Column({ name: 'third_count', type: 'int', default: 0 })
  thirdCount: number;

  @Column({ name: 'fourth_count', type: 'int', default: 0 })
  fourthCount: number;

  @Column({ name: 'fifth_count', type: 'int', default: 0 })
  fifthCount: number;

  @Column({ name: 'consolation_count', type: 'int', default: 0 })
  consolationCount: number;
}
