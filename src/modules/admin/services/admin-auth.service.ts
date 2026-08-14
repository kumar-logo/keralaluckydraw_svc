import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AdminUser } from '../../../entities/admin-user.entity';
import { PaginatedResponse } from '../../../common/dto/response.dto';
import { AdminAuditService } from './admin-audit.service';
import { UpdateAdminUserDto } from '../dto/admin.dto';
import { RoleService } from '../../rbac/role.service';

export interface AdminAuthInfo {
  id: number;
  username: string;
  displayName: string | null;
  avatar: string | null;
  role: string;
  permissions: string[];
}

export interface AdminLoginResult {
  token: string;
  admin: AdminAuthInfo;
}

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(AdminUser) private adminRepo: Repository<AdminUser>,
    private jwtService: JwtService,
    private audit: AdminAuditService,
    private roleService: RoleService,
  ) {}

  async login(username: string, password: string): Promise<AdminLoginResult> {
    const admin = await this.adminRepo.findOne({
      where: { username },
      select: [
        'id',
        'username',
        'passwordHash',
        'displayName',
        'avatar',
        'role',
        'status',
      ],
    });
    if (!admin) throw new UnauthorizedException('Invalid credentials');
    if (admin.status !== 1) throw new UnauthorizedException('Account disabled');

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.adminRepo.update(admin.id, { lastLogin: new Date() });
    const token = await this.jwtService.signAsync({
      sub: admin.id,
      role: admin.role,
      isAdmin: true,
    });
    const permissions = await this.roleService.getPermissionCodes(admin.role);
    return {
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        avatar: admin.avatar,
        role: admin.role,
        permissions,
      },
    };
  }

  async getAdminById(id: number) {
    const admin = await this.adminRepo.findOne({
      where: { id },
      select: [
        'id',
        'username',
        'displayName',
        'avatar',
        'role',
        'lastLogin',
        'status',
        'createdAt',
      ],
    });
    if (!admin) throw new BadRequestException('Admin not found');
    const permissions = await this.roleService.getPermissionCodes(admin.role);
    return { ...admin, permissions };
  }

  async getAdminUsers(dto: { pageNo: number; pageSize: number }) {
    const qb = this.adminRepo
      .createQueryBuilder('a')
      .select([
        'a.id',
        'a.username',
        'a.displayName',
        'a.avatar',
        'a.role',
        'a.status',
        'a.lastLogin',
        'a.createdAt',
      ])
      .orderBy('a.created_at', 'DESC');

    const total = await qb.getCount();
    const list = await qb
      .skip((dto.pageNo - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getMany();
    return new PaginatedResponse(list, total, dto.pageNo, dto.pageSize);
  }

  async createAdminUser(
    data: {
      username: string;
      password: string;
      displayName: string;
      role: string;
    },
    adminId: number,
  ) {
    const existing = await this.adminRepo.findOne({
      where: { username: data.username },
    });
    if (existing) throw new BadRequestException('Username already exists');

    const passwordHash = await bcrypt.hash(data.password, 10);
    const saved = await this.adminRepo.save(
      this.adminRepo.create({
        username: data.username,
        passwordHash,
        displayName: data.displayName,
        role: data.role,
      }),
    );
    await this.audit.createAuditLog(
      adminId,
      'create_admin',
      'admin_user',
      String(saved.id),
      { username: data.username },
    );
    return saved;
  }

  async updateAdminUser(id: number, data: UpdateAdminUserDto, adminId: number) {
    const updateData: Partial<AdminUser> = {};

    if (data.displayName !== undefined)
      updateData.displayName = data.displayName;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.status !== undefined) updateData.status = data.status;

    if (data.currentPassword && data.newPassword) {
      const admin = await this.adminRepo.findOne({
        where: { id },
        select: ['id', 'passwordHash'],
      });
      if (!admin) throw new BadRequestException('Admin not found');
      const valid = await bcrypt.compare(
        data.currentPassword,
        admin.passwordHash,
      );
      if (!valid)
        throw new BadRequestException('Current password is incorrect');
      updateData.passwordHash = await bcrypt.hash(data.newPassword, 10);
    } else if (data.newPassword) {
      updateData.passwordHash = await bcrypt.hash(data.newPassword, 10);
    } else if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    if (Object.keys(updateData).length > 0) {
      await this.adminRepo.update(id, updateData);
    }
    await this.audit.createAuditLog(
      adminId,
      'update_admin',
      'admin_user',
      String(id),
    );
  }

  async deleteAdminUser(id: number, adminId: number) {
    if (id === adminId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const target = await this.adminRepo.findOne({
      where: { id },
      select: ['id', 'username', 'role'],
    });
    if (!target) throw new BadRequestException('Admin not found');

    if (target.role === 'super_admin') {
      const superAdminCount = await this.adminRepo.count({
        where: { role: 'super_admin' },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException(
          'Cannot delete the last remaining super admin',
        );
      }
    }

    await this.adminRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_admin',
      'admin_user',
      String(id),
      { username: target.username },
    );
  }
}
