import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../../entities/role.entity';
import { Permission } from '../../entities/permission.entity';
import { RolePermission } from '../../entities/role-permission.entity';
import { AdminUser } from '../../entities/admin-user.entity';
import { RoleService } from './role.service';
import { RbacController } from './rbac.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Permission, RolePermission, AdminUser]),
  ],
  controllers: [RbacController],
  providers: [RoleService],
  exports: [RoleService],
})
export class RbacModule {}
