import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('third_party_txn')
export class ThirdPartyTransaction {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('uniq_txn_key', { unique: true })
  @Column({ name: 'txn_key', type: 'varchar', length: 191 })
  txnKey: string;

  @Column({
    name: 'serial_number',
    type: 'varchar',
    length: 191,
    nullable: true,
  })
  serialNumber: string;

  @Index('idx_member_round')
  @Column({ name: 'member_id', type: 'bigint', unsigned: true })
  memberId: number;

  @Column({ name: 'game_round', type: 'varchar', length: 191, nullable: true })
  gameRound: string;

  @Column({
    name: 'bet_amount',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  betAmount: number;

  @Column({
    name: 'win_amount',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  winAmount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
