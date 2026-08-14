import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('payment_gateway_method')
export class PaymentGatewayMethod {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index('idx_gateway')
  @Column({ name: 'gateway_id', type: 'int', unsigned: true })
  gatewayId: number;

  @Column({ name: 'method_code', type: 'varchar', length: 30 })
  methodCode: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
