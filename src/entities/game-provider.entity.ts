import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('game_providers')
export class GameProvider {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'provider_code', type: 'varchar', length: 50, unique: true })
  providerCode: string;

  @Column({ name: 'provider_name', type: 'varchar', length: 100 })
  providerName: string;

  @Column({ name: 'api_url', type: 'varchar', length: 500, nullable: true })
  apiUrl: string;

  @Column({ name: 'api_key', type: 'varchar', length: 500, nullable: true })
  apiKey: string;

  @Column({ name: 'api_secret', type: 'varchar', length: 500, nullable: true })
  apiSecret: string;

  @Column({ name: 'icon_url', type: 'varchar', length: 500, nullable: true })
  iconUrl: string;

  @Column({ name: 'sort_order', type: 'int', nullable: true, default: 0 })
  sortOrder: number;

  @Column({ type: 'tinyint', nullable: true, default: 1 })
  status: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
