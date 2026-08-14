import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_favorites')
@Index('uk_user_game', ['userId', 'gameCode'], { unique: true })
export class UserFavorite {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'user_id', type: 'varchar', length: 32 })
  userId: string;

  @Column({ name: 'game_code', type: 'varchar', length: 100 })
  gameCode: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
