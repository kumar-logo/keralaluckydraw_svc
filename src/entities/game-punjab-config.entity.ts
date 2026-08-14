import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('game_punjab_config')
export class GamePunjabConfig {
  @PrimaryColumn({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'can_insurance', type: 'tinyint', default: 0 })
  canInsurance: number;

  @Column({ name: 'draw_time', type: 'varchar', length: 20, nullable: true })
  drawTime: string;
}
