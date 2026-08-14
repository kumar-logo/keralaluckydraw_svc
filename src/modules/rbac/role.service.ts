import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from '../../entities/role.entity';
import { Permission } from '../../entities/permission.entity';
import { RolePermission } from '../../entities/role-permission.entity';
import { AdminUser } from '../../entities/admin-user.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleView, toRoleView } from './role.mapper';

interface RoleCacheEntry {
  permissions: Set<string>;
}

const SUPER_ADMIN_ROLE = 'super_admin';

@Injectable()
export class RoleService implements OnModuleInit {
  private readonly logger = new Logger(RoleService.name);
  private cache = new Map<string, RoleCacheEntry>();
  private lastRefresh = 0;
  private readonly refreshIntervalMs = 30_000;

  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
    @InjectRepository(AdminUser)
    private readonly adminUserRepo: Repository<AdminUser>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  async hasPermission(roleName: string, code: string): Promise<boolean> {
    const entry = await this.resolve(roleName);
    return entry ? entry.permissions.has(code) : false;
  }

  async getPermissionCodes(roleName: string): Promise<string[]> {
    if (this.isSuperAdmin(roleName)) {
      const all = await this.permissionRepo.find({
        order: { sortOrder: 'ASC', id: 'ASC' },
      });
      return all.map((p) => p.code);
    }
    const entry = await this.resolve(roleName);
    if (!entry) return [];
    return Array.from(entry.permissions);
  }

  isSuperAdmin(roleName: string): boolean {
    const key = roleName.toLowerCase().replace(/-/g, '_');
    return key === SUPER_ADMIN_ROLE;
  }

  listPermissions(): Promise<Permission[]> {
    return this.permissionRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async listRoles(): Promise<RoleView[]> {
    const roles = await this.roleRepo.find({
      order: { level: 'DESC', id: 'ASC' },
    });
    const codesByRole = await this.permissionCodesByRole();
    const userCounts = await this.userCountsByRole();
    return roles.map((r) => {
      const codes = codesByRole.get(r.id);
      const count = userCounts.get(r.name.toLowerCase());
      return toRoleView(
        r,
        codes === undefined ? [] : codes,
        count === undefined ? 0 : count,
      );
    });
  }

  async createRole(dto: CreateRoleDto): Promise<RoleView> {
    const name = dto.name.trim().toLowerCase().replace(/\s+/g, '_');
    const existing = await this.roleRepo.findOne({ where: { name } });
    if (existing)
      throw new BadRequestException('A role with this name already exists');
    const role = await this.roleRepo.save(
      this.roleRepo.create({
        name,
        displayName: dto.displayName,
        level: dto.level,
        description: dto.description === undefined ? null : dto.description,
        isSystem: 0,
      }),
    );
    if (dto.permissionCodes?.length) {
      await this.applyPermissions(role.id, dto.permissionCodes);
    }
    await this.refresh();
    return this.findView(role.id);
  }

  async updateRole(id: number, dto: UpdateRoleDto): Promise<RoleView> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    const patch: Partial<Role> = {};
    if (dto.displayName !== undefined) patch.displayName = dto.displayName;
    if (dto.level !== undefined) patch.level = dto.level;
    if (dto.description !== undefined) patch.description = dto.description;
    if (Object.keys(patch).length) await this.roleRepo.update(id, patch);
    await this.refresh();
    return this.findView(id);
  }

  async deleteRole(id: number): Promise<void> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem === 1)
      throw new BadRequestException('System roles cannot be deleted');
    const inUse = await this.adminUserRepo.count({
      where: { role: role.name },
    });
    if (inUse > 0)
      throw new BadRequestException(
        `Role is assigned to ${inUse} admin user(s)`,
      );
    await this.rolePermissionRepo.delete({ roleId: id });
    await this.roleRepo.delete(id);
    await this.refresh();
  }

  async setRolePermissions(id: number, codes: string[]): Promise<RoleView> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    await this.rolePermissionRepo.delete({ roleId: id });
    await this.applyPermissions(id, codes);
    await this.refresh();
    return this.findView(id);
  }

  async refresh(): Promise<void> {
    try {
      const roles = await this.roleRepo.find();
      const codesByRole = await this.permissionCodesByRole();
      const next = new Map<string, RoleCacheEntry>();
      for (const r of roles) {
        const codes = codesByRole.get(r.id);
        next.set(r.name.toLowerCase(), {
          permissions: new Set(codes === undefined ? [] : codes),
        });
      }
      this.cache = next;
      this.lastRefresh = new Date().getTime();
      this.logger.log(`RBAC cache refreshed: ${next.size} roles`);
    } catch (err) {
      this.logger.error(`RBAC cache refresh failed: ${(err as Error).message}`);
    }
  }

  private async resolve(roleName: string): Promise<RoleCacheEntry | undefined> {
    if (new Date().getTime() - this.lastRefresh > this.refreshIntervalMs) {
      await this.refresh();
    }
    return this.cache.get(roleName.toLowerCase());
  }

  private async permissionCodesByRole(): Promise<Map<number, string[]>> {
    const permissions = await this.permissionRepo.find();
    const codeById = new Map(permissions.map((p) => [p.id, p.code]));
    const mappings = await this.rolePermissionRepo.find();
    const out = new Map<number, string[]>();
    for (const m of mappings) {
      const code = codeById.get(m.permissionId);
      if (!code) continue;
      const existing = out.get(m.roleId);
      const list = existing === undefined ? [] : existing;
      list.push(code);
      out.set(m.roleId, list);
    }
    return out;
  }

  private async userCountsByRole(): Promise<Map<string, number>> {
    const admins = await this.adminUserRepo.find();
    const counts = new Map<string, number>();
    for (const a of admins) {
      const key = a.role.toLowerCase();
      const current = counts.get(key);
      counts.set(key, (current === undefined ? 0 : current) + 1);
    }
    return counts;
  }

  private async applyPermissions(
    roleId: number,
    codes: string[],
  ): Promise<void> {
    if (!codes.length) return;
    const permissions = await this.permissionRepo.find({
      where: { code: In(codes) },
    });
    const rows = permissions.map((p) =>
      this.rolePermissionRepo.create({ roleId, permissionId: p.id }),
    );
    if (rows.length) await this.rolePermissionRepo.save(rows);
  }

  private async findView(id: number): Promise<RoleView> {
    const all = await this.listRoles();
    const view = all.find((r) => r.id === id);
    if (!view) throw new NotFoundException('Role not found');
    return view;
  }
}
