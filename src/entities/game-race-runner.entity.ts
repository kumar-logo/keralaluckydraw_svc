import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('game_race_runner')
export class GameRaceRunner {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ name: 'name', type: 'varchar', length: 64 })
  name: string;

  @Column({ name: 'name_short', type: 'varchar', length: 16 })
  nameShort: string;

  @Column({ name: 'color_hex', type: 'varchar', length: 32 })
  colorHex: string;

  @Column({ name: 'sprite_key', type: 'varchar', length: 48, nullable: true })
  spriteKey: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
