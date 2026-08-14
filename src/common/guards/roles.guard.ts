import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Permission } from '../enums/permission.enum';
import { RoleService } from '../../modules/rbac/role.service';

interface AuthenticatedRequest {
  method?: string;
  originalUrl: string;
  user?: AuthenticatedUser;
}

interface AuthenticatedUser {
  role?: string;
  isAdmin?: boolean;
}

const ADMIN_PATH_PREFIX = '/admin/api/';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roleService: RoleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermission = this.reflector.getAllAndOverride<Permission>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const isAdminRoute = request.originalUrl.includes(ADMIN_PATH_PREFIX);

    if (isAdminRoute) {
      this.assertAdminIdentity(request.user);
    }

    if (requiredPermission !== undefined) {
      await this.assertPermission(request.user, requiredPermission);
    }

    return true;
  }

  private async assertPermission(
    user: AuthenticatedUser | undefined,
    permission: Permission,
  ): Promise<void> {
    if (!user || !user.role) {
      throw new ForbiddenException({
        code: 403,
        msg: 'Insufficient permissions',
      });
    }
    if (this.roleService.isSuperAdmin(user.role)) return;
    const allowed = await this.roleService.hasPermission(user.role, permission);
    if (!allowed) {
      throw new ForbiddenException({
        code: 403,
        msg: 'Insufficient permissions',
      });
    }
  }

  private assertAdminIdentity(user: AuthenticatedUser | undefined): void {
    if (!user || user.isAdmin !== true || !user.role) {
      throw new ForbiddenException({
        code: 403,
        msg: 'Insufficient permissions',
      });
    }
  }
}
