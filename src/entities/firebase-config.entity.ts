import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('firebase_config')
export class FirebaseConfig {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'api_key', type: 'varchar', length: 255, default: '' })
  apiKey: string;

  @Column({ name: 'auth_domain', type: 'varchar', length: 255, default: '' })
  authDomain: string;

  @Column({ name: 'project_id', type: 'varchar', length: 255, default: '' })
  projectId: string;

  @Column({ name: 'storage_bucket', type: 'varchar', length: 255, default: '' })
  storageBucket: string;

  @Column({
    name: 'messaging_sender_id',
    type: 'varchar',
    length: 255,
    default: '',
  })
  messagingSenderId: string;

  @Column({ name: 'app_id', type: 'varchar', length: 255, default: '' })
  appId: string;

  @Column({ name: 'measurement_id', type: 'varchar', length: 255, default: '' })
  measurementId: string;

  @Column({ name: 'vapid_key', type: 'varchar', length: 255, default: '' })
  vapidKey: string;

  @Column({ name: 'service_account_json', type: 'text', nullable: true })
  serviceAccountJson: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
