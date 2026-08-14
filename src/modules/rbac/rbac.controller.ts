import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/enums';
import { RoleService } from './role.service';
import { CreateRoleDto, UpdateRoleDto, SetRolePermissionsDto } from './dto';

@Controller('admin/api/v1/system')
export class RbacController {
  constructor(private readonly roleService: RoleService) {}

  @Get('roles')
  async getRoles() {
    const [roles, permissions] = await Promise.all([
      this.roleService.listRoles(),
      this.roleService.listPermissions(),
    ]);
    return {
      roles,
      permissions,
      allPermissions: permissions.map((p) => p.code),
    };
  }

  @Get('permissions')
  getPermissions() {
    return this.roleService.listPermissions();
  }

  @RequirePermission(Permission.System)
  @HttpCode(200)
  @Post('roles')
  createRole(@Body() body: CreateRoleDto) {
    return this.roleService.createRole(body);
  }

  @RequirePermission(Permission.System)
  @Put('roles/:id')
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateRoleDto,
  ) {
    return this.roleService.updateRole(id, body);
  }

  @RequirePermission(Permission.System)
  @Delete('roles/:id')
  async deleteRole(@Param('id', ParseIntPipe) id: number) {
    await this.roleService.deleteRole(id);
    return { deleted: true };
  }

  @RequirePermission(Permission.System)
  @Put('roles/:id/permissions')
  setRolePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SetRolePermissionsDto,
  ) {
    return this.roleService.setRolePermissions(id, body.permissionCodes);
  }
}
