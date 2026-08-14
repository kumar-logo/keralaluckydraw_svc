import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { VipConfig } from '../../../entities/vip-config.entity';
import { CommissionConfig } from '../../../entities/commission-config.entity';
import { RechargeAward } from '../../../entities/recharge-award.entity';
import { RankConfig } from '../../../entities/rank-config.entity';
import { RankConfigPrize } from '../../../entities/rank-config-prize.entity';
import { CdkeyCode } from '../../../entities/cdkey-code.entity';
import { AdminAuditService } from './admin-audit.service';

export type UpsertRankConfigInput = Partial<RankConfig> & {
  prizes?: Array<{ rank: number; prize: number }> | string;
};

@Injectable()
export class AdminRewardConfigService {
  constructor(
    @InjectRepository(VipConfig) private vipRepo: Repository<VipConfig>,
    @InjectRepository(CommissionConfig)
    private commConfigRepo: Repository<CommissionConfig>,
    @InjectRepository(RechargeAward)
    private rechargeAwardRepo: Repository<RechargeAward>,
    @InjectRepository(RankConfig)
    private rankConfigRepo: Repository<RankConfig>,
    @InjectRepository(RankConfigPrize)
    private rankPrizeRepo: Repository<RankConfigPrize>,
    @InjectRepository(CdkeyCode) private cdkeyRepo: Repository<CdkeyCode>,
    private audit: AdminAuditService,
  ) {}

  async getVipConfigs() {
    const configs = await this.vipRepo.find({ order: { level: 'ASC' } });
    return configs.map((c) => ({ ...c, levelIcon: c.iconUrl }));
  }

  async upsertVipConfig(data: Record<string, unknown>, adminId: number) {
    const patch: Partial<VipConfig> = { ...(data as Partial<VipConfig>) };
    if (data.levelIcon !== undefined) {
      patch.iconUrl = data.levelIcon as string;
      delete (patch as Record<string, unknown>).levelIcon;
    }
    const withIcon = <T extends VipConfig | null>(c: T) =>
      c ? { ...c, levelIcon: c.iconUrl } : c;
    const target = this.auditTarget(patch.level, patch.id);
    if (patch.level !== undefined) {
      const existing = await this.vipRepo.findOne({
        where: { level: patch.level },
      });
      if (existing) {
        await this.vipRepo.update(existing.id, patch);
        await this.audit.createAuditLog(
          adminId,
          'upsert_vip_config',
          'vip_config',
          target,
        );
        return withIcon(
          await this.vipRepo.findOne({ where: { id: existing.id } }),
        );
      }
    }
    const saved = await this.vipRepo.save(this.vipRepo.create(patch));
    await this.audit.createAuditLog(
      adminId,
      'upsert_vip_config',
      'vip_config',
      target,
    );
    return withIcon(saved);
  }

  private auditTarget(
    level: number | undefined,
    id: number | undefined,
  ): string {
    if (level !== undefined) return String(level);
    if (id !== undefined) return String(id);
    return '0';
  }

  async deleteVipConfig(id: number, adminId: number) {
    await this.vipRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_vip_config',
      'vip_config',
      String(id),
    );
  }

  async getCommissionConfigs() {
    return this.commConfigRepo.find({ order: { level: 'ASC' } });
  }

  async upsertCommissionConfig(
    data: Partial<CommissionConfig>,
    adminId: number,
  ) {
    const target = this.auditTarget(data.level, data.id);
    if (data.id) {
      await this.commConfigRepo.update(data.id, data);
      await this.audit.createAuditLog(
        adminId,
        'upsert_commission',
        'commission_config',
        target,
      );
      return this.commConfigRepo.findOne({ where: { id: data.id } });
    }
    const saved = await this.commConfigRepo.save(
      this.commConfigRepo.create(data),
    );
    await this.audit.createAuditLog(
      adminId,
      'upsert_commission',
      'commission_config',
      target,
    );
    return saved;
  }

  async deleteCommissionConfig(id: number, adminId: number) {
    await this.commConfigRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_commission',
      'commission_config',
      String(id),
    );
  }

  async getRechargeAwards() {
    return this.rechargeAwardRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async upsertRechargeAward(data: Partial<RechargeAward>, adminId: number) {
    if (data.id) {
      await this.rechargeAwardRepo.update(data.id, data);
      await this.audit.createAuditLog(
        adminId,
        'update_recharge_award',
        'recharge_award',
        String(data.id),
      );
      return this.rechargeAwardRepo.findOne({ where: { id: data.id } });
    }
    const saved = await this.rechargeAwardRepo.save(
      this.rechargeAwardRepo.create(data),
    );
    await this.audit.createAuditLog(
      adminId,
      'create_recharge_award',
      'recharge_award',
      String(saved.id),
    );
    return saved;
  }

  async deleteRechargeAward(id: number, adminId: number) {
    await this.rechargeAwardRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_recharge_award',
      'recharge_award',
      String(id),
    );
  }

  async getRankConfigs() {
    const configs = await this.rankConfigRepo.find({
      order: { rankId: 'ASC' },
    });
    if (configs.length === 0) return configs;
    const prizeRows = await this.rankPrizeRepo.find({
      where: { rankConfigId: In(configs.map((c) => c.id)) },
      order: { rankPosition: 'ASC' },
    });
    const byConfig = new Map<number, Array<{ rank: number; prize: number }>>();
    for (const prize of prizeRows) {
      const existing = byConfig.get(prize.rankConfigId);
      const list = existing !== undefined ? existing : [];
      list.push({ rank: prize.rankPosition, prize: Number(prize.prizeAmount) });
      byConfig.set(prize.rankConfigId, list);
    }
    for (const config of configs) {
      const list = byConfig.get(config.id);
      (config as RankConfig & { prizes: string }).prizes = JSON.stringify(
        list !== undefined ? list : [],
      );
    }
    return configs;
  }

  async upsertRankConfig(data: UpsertRankConfigInput, adminId: number) {
    let prizes: Array<{ rank: number; prize: number }> = [];
    if (Array.isArray(data.prizes)) prizes = data.prizes;
    else if (typeof data.prizes === 'string') {
      try {
        prizes = JSON.parse(data.prizes) as Array<{
          rank: number;
          prize: number;
        }>;
      } catch {
        prizes = [];
      }
    }
    const rest: Partial<RankConfig> & { prizes?: unknown } = { ...data };
    delete rest.prizes;
    let rankConfigId = data.id;
    if (rankConfigId) {
      await this.rankConfigRepo.update(rankConfigId, rest);
    } else {
      const saved = await this.rankConfigRepo.save(
        this.rankConfigRepo.create(rest),
      );
      rankConfigId = saved.id;
    }
    await this.rankPrizeRepo.delete({ rankConfigId });
    if (prizes.length > 0) {
      await this.rankPrizeRepo.save(
        prizes.map((p) =>
          this.rankPrizeRepo.create({
            rankConfigId,
            rankPosition: p.rank,
            prizeAmount: p.prize,
          }),
        ),
      );
    }
    await this.audit.createAuditLog(
      adminId,
      data.id ? 'update_rank_config' : 'create_rank_config',
      'rank_config',
      String(rankConfigId),
    );
    return (await this.getRankConfigs()).find((c) => c.id === rankConfigId);
  }

  async deleteRankConfig(id: number, adminId: number) {
    await this.rankConfigRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_rank_config',
      'rank_config',
      String(id),
    );
  }

  async getCdkeyCodes() {
    return this.cdkeyRepo.find({ order: { id: 'DESC' } });
  }

  async upsertCdkeyCode(data: Partial<CdkeyCode>, adminId: number) {
    if (data.id) {
      await this.cdkeyRepo.update(data.id, data);
      await this.audit.createAuditLog(
        adminId,
        'update_cdkey',
        'cdkey',
        String(data.id),
      );
      return this.cdkeyRepo.findOne({ where: { id: data.id } });
    }
    const saved = await this.cdkeyRepo.save(this.cdkeyRepo.create(data));
    await this.audit.createAuditLog(
      adminId,
      'create_cdkey',
      'cdkey',
      String(saved.id),
    );
    return saved;
  }

  async deleteCdkeyCode(id: number, adminId: number) {
    await this.cdkeyRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_cdkey',
      'cdkey',
      String(id),
    );
  }
}
