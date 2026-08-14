import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentGatewayMode } from '../common/enums';

@Entity('payment_gateways')
export class PaymentGateway {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'gateway_name', type: 'varchar', length: 100 })
  gatewayName: string;

  @Column({ name: 'provider_code', type: 'varchar', length: 50, unique: true })
  providerCode: string;

  @Column({ name: 'gateway_type', type: 'varchar', length: 50, nullable: true })
  gatewayType: string | null;

  @Column({ type: 'varchar', length: 10, default: PaymentGatewayMode.Auto })
  mode: PaymentGatewayMode;

  @Column({ name: 'api_url', type: 'varchar', length: 500, nullable: true })
  apiUrl: string | null;

  @Column({ name: 'api_key', type: 'varchar', length: 500, nullable: true })
  apiKey: string | null;

  @Column({ name: 'api_secret', type: 'varchar', length: 500, nullable: true })
  apiSecret: string | null;

  @Column({
    name: 'callback_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  callbackUrl: string | null;

  @Column({
    name: 'webhook_secret',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  webhookSecret: string | null;

  @Column({
    name: 'min_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    nullable: true,
    default: 100.0,
  })
  minAmount: number;

  @Column({
    name: 'max_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    nullable: true,
    default: 50000.0,
  })
  maxAmount: number;

  @Column({
    name: 'fee_rate',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
    default: 0.0,
  })
  feeRate: number;

  @Column({
    name: 'fee_fixed',
    type: 'decimal',
    precision: 16,
    scale: 2,
    nullable: true,
    default: 0.0,
  })
  feeFixed: number;

  @Column({ name: 'icon_url', type: 'varchar', length: 500, default: '' })
  iconUrl: string;

  @Column({ name: 'qr_image_url', type: 'varchar', length: 500, default: '' })
  qrImageUrl: string;

  @Column({ name: 'sort_order', type: 'int', nullable: true, default: 0 })
  sortOrder: number;

  @Column({ name: 'require_proof', type: 'tinyint', width: 1, default: 1 })
  requireProof: number;

  @Column({
    name: 'additional_verification',
    type: 'tinyint',
    width: 1,
    default: 0,
  })
  additionalVerification: number;

  @Column({
    name: 'manual_fallback',
    type: 'tinyint',
    width: 1,
    default: 0,
  })
  manualFallback: number;

  @Column({ type: 'tinyint', nullable: true, default: 1 })
  status: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
