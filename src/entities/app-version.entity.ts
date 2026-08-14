import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('app_versions')
export class AppVersion {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 200 })
  version: string;

  @Column({ name: 'force_update', type: 'tinyint', default: 0 })
  forceUpdate: number;

  @Column({ name: 'min_supported_version', type: 'varchar', length: 200, default: '' })
  minSupportedVersion: string;

  @Column({ name: 'store_url', type: 'varchar', length: 500, default: '' })
  storeUrl: string;

  @Column({ name: 'android_package_name', type: 'varchar', length: 200, default: '' })
  androidPackageName: string;

  @Column({ name: 'update_message', type: 'varchar', length: 500, default: '' })
  updateMessage: string;
}
