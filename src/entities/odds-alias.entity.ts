import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('odds_alias')
export class OddsAlias {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'bet_code', type: 'varchar', length: 60 })
  betCode: string;

  @Column({ name: 'odds_class', type: 'varchar', length: 60 })
  oddsClass: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
