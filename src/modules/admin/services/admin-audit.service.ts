import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../../entities/audit-log.entity';
import { PaginatedResponse } from '../../../common/dto/response.dto';

@Injectable()
export class AdminAuditService {
  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async createAuditLog(
    adminId: number,
    action: string,
    targetType: string,
    targetId: string,
    details?: unknown,
  ) {
    const target = targetId ? `${targetType}:${targetId}` : targetType;
    const detail = details ? JSON.stringify(details) : undefined;
    await this.auditRepo.save(
      this.auditRepo.create({ adminId, action, target, detail }),
    );
  }

  async getAuditLogs(dto: {
    pageNo: number;
    pageSize: number;
    adminId?: number;
    action?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const qb = this.auditRepo
      .createQueryBuilder('a')
      .orderBy('a.created_at', 'DESC');

    if (dto.adminId) qb.andWhere('a.admin_id = :aid', { aid: dto.adminId });
    if (dto.action) qb.andWhere('a.action = :action', { action: dto.action });
    if (dto.startDate)
      qb.andWhere('a.created_at >= :start', { start: dto.startDate });
    if (dto.endDate) qb.andWhere('a.created_at <= :end', { end: dto.endDate });

    const total = await qb.getCount();
    const list = await qb
      .skip((dto.pageNo - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getMany();
    return new PaginatedResponse(list, total, dto.pageNo, dto.pageSize);
  }
}
