import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('game_lobby_placement')
@Index('uk_game_section', ['gameId', 'section'], { unique: true })
export class GameLobbyPlacement {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'game_id', type: 'int', unsigned: true })
  gameId: number;

  @Column({ type: 'varchar', length: 50 })
  section: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
