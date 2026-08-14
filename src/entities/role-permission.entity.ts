import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('role_permissions')
@Index('uk_role_permission', ['roleId', 'permissionId'], { unique: true })
export class RolePermission {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'role_id', type: 'int', unsigned: true })
  roleId: number;

  @Column({ name: 'permission_id', type: 'int', unsigned: true })
  permissionId: number;
}
