import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AdminAuthService } from './admin-auth.service';
import { AdminUser } from '../../../entities/admin-user.entity';
import { AdminAuditService } from './admin-audit.service';
import { RoleService } from '../../rbac/role.service';

interface RepoMock {
  findOne: jest.Mock;
  count: jest.Mock;
  delete: jest.Mock;
}

const buildService = (repo: RepoMock) => {
  const audit: Pick<AdminAuditService, 'createAuditLog'> = {
    createAuditLog: jest.fn().mockResolvedValue(undefined),
  };
  const roleService: Pick<RoleService, 'getPermissionCodes'> = {
    getPermissionCodes: jest.fn().mockResolvedValue([]),
  };
  return new AdminAuthService(
    repo as unknown as Repository<AdminUser>,
    {} as JwtService,
    audit as AdminAuditService,
    roleService as RoleService,
  );
};

describe('AdminAuthService.deleteAdminUser guards', () => {
  it('rejects deleting your own account', async () => {
    const repo: RepoMock = {
      findOne: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    };
    const service = buildService(repo);
    await expect(service.deleteAdminUser(1, 1)).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('rejects deleting the last remaining super admin', async () => {
    const repo: RepoMock = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 1, username: 'admin', role: 'super_admin' }),
      count: jest.fn().mockResolvedValue(1),
      delete: jest.fn(),
    };
    const service = buildService(repo);
    await expect(service.deleteAdminUser(1, 2)).rejects.toThrow(
      'Cannot delete the last remaining super admin',
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('rejects deleting an admin that does not exist', async () => {
    const repo: RepoMock = {
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn(),
      delete: jest.fn(),
    };
    const service = buildService(repo);
    await expect(service.deleteAdminUser(99, 2)).rejects.toThrow(
      'Admin not found',
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('deletes a non-last super admin', async () => {
    const repo: RepoMock = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 3, username: 'second', role: 'super_admin' }),
      count: jest.fn().mockResolvedValue(2),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = buildService(repo);
    await service.deleteAdminUser(3, 1);
    expect(repo.delete).toHaveBeenCalledWith(3);
  });

  it('deletes a non-super-admin without checking the super admin count', async () => {
    const repo: RepoMock = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 2, username: 'op', role: 'operator' }),
      count: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = buildService(repo);
    await service.deleteAdminUser(2, 1);
    expect(repo.count).not.toHaveBeenCalled();
    expect(repo.delete).toHaveBeenCalledWith(2);
  });
});
