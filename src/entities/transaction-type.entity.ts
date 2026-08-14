import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('transaction_types')
export class TransactionType {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'type_code', type: 'varchar', length: 30, unique: true })
  typeCode: string;

  @Column({ name: 'type_name', type: 'varchar', length: 50 })
  typeName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  category: string;

  @Column({ name: 'filter_group', type: 'varchar', length: 20, default: '' })
  filterGroup: string;
}
