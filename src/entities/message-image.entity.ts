import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('message_images')
export class MessageImage {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'message_id', type: 'bigint', unsigned: true })
  messageId: number;

  @Column({ name: 'image_url', type: 'varchar', length: 500 })
  imageUrl: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
