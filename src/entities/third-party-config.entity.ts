import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TinyFlag } from '../common/enums';

@Entity('third_party_config')
export class ThirdPartyConfig {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'agency_uid', type: 'varchar', length: 191 })
  agencyUid: string;

  @Column({ name: 'member_prefix', type: 'varchar', length: 64, default: '' })
  memberPrefix: string;

  @Column({ name: 'member_suffix', type: 'varchar', length: 64, default: '' })
  memberSuffix: string;

  @Column({ type: 'varchar', length: 8, default: 'INR' })
  currency: string;

  @Column({ type: 'varchar', length: 8, default: 'en' })
  language: string;

  @Column({ type: 'int', default: 1 })
  platform: number;

  @Column({ name: 'launch_url', type: 'varchar', length: 255 })
  launchUrl: string;

  @Column({ name: 'home_url', type: 'varchar', length: 255, default: '' })
  homeUrl: string;

  @Column({
    name: 'callback_secret',
    type: 'varchar',
    length: 191,
    nullable: true,
  })
  callbackSecret: string | null;

  @Column({ type: 'tinyint', default: TinyFlag.Yes })
  enabled: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
