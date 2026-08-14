import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Banner } from '../../../entities/banner.entity';
import { Announcement } from '../../../entities/announcement.entity';
import { Popup } from '../../../entities/popup.entity';
import { Activity } from '../../../entities/activity.entity';
import { CheckinConfig } from '../../../entities/checkin-config.entity';
import { CheckinRecord } from '../../../entities/checkin-record.entity';
import { User } from '../../../entities/user.entity';
import { Avatar } from '../../../entities/avatar.entity';
import { ShareConfig } from '../../../entities/share-config.entity';
import { SharePoster } from '../../../entities/share-poster.entity';
import { SpaWsService } from '../../websocket/spa-ws.service';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminContentService {
  private readonly logger = new Logger(AdminContentService.name);

  constructor(
    @InjectRepository(Banner) private bannerRepo: Repository<Banner>,
    @InjectRepository(Announcement) private annoRepo: Repository<Announcement>,
    @InjectRepository(Popup) private popupRepo: Repository<Popup>,
    @InjectRepository(Activity) private activityRepo: Repository<Activity>,
    @InjectRepository(CheckinConfig)
    private checkinRepo: Repository<CheckinConfig>,
    @InjectRepository(CheckinRecord)
    private checkinRecordRepo: Repository<CheckinRecord>,
    @InjectRepository(Avatar) private avatarRepo: Repository<Avatar>,
    @InjectRepository(ShareConfig)
    private shareConfigRepo: Repository<ShareConfig>,
    @InjectRepository(SharePoster)
    private sharePosterRepo: Repository<SharePoster>,
    private spaWsService: SpaWsService,
    private audit: AdminAuditService,
  ) {}

  private normalizeBannerInput(data: Record<string, unknown>): Partial<Banner> {
    const { link, ...rest } = data;
    if (link !== undefined) (rest as Partial<Banner>).linkUrl = link as string;
    return rest as Partial<Banner>;
  }

  async getBanners() {
    const banners = await this.bannerRepo.find({ order: { sortOrder: 'ASC' } });
    return banners.map((b) => ({ ...b, link: b.linkUrl }));
  }

  async createBanner(data: Record<string, unknown>, adminId: number) {
    const saved = await this.bannerRepo.save(
      this.bannerRepo.create(this.normalizeBannerInput(data)),
    );
    await this.audit.createAuditLog(
      adminId,
      'create_banner',
      'banner',
      String(saved.id),
    );
    return saved;
  }

  async updateBanner(
    id: number,
    data: Record<string, unknown>,
    adminId: number,
  ) {
    await this.bannerRepo.update(id, this.normalizeBannerInput(data));
    await this.audit.createAuditLog(
      adminId,
      'update_banner',
      'banner',
      String(id),
    );
  }

  async deleteBanner(id: number, adminId: number) {
    await this.bannerRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_banner',
      'banner',
      String(id),
    );
  }

  async getAnnouncements() {
    return this.annoRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async createAnnouncement(data: Partial<Announcement>, adminId: number) {
    const saved = await this.annoRepo.save(this.annoRepo.create(data));
    await this.audit.createAuditLog(
      adminId,
      'create_announcement',
      'announcement',
      String(saved.id),
    );
    this.spaWsService
      .broadcastAnnouncements()
      .catch((err) => this.logger.error(`Broadcast error: ${err.message}`));
    return saved;
  }

  async updateAnnouncement(
    id: number,
    data: Partial<Announcement>,
    adminId: number,
  ) {
    await this.annoRepo.update(id, data);
    await this.audit.createAuditLog(
      adminId,
      'update_announcement',
      'announcement',
      String(id),
    );
    this.spaWsService
      .broadcastAnnouncements()
      .catch((err) => this.logger.error(`Broadcast error: ${err.message}`));
  }

  async deleteAnnouncement(id: number, adminId: number) {
    await this.annoRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_announcement',
      'announcement',
      String(id),
    );
    this.spaWsService
      .broadcastAnnouncements()
      .catch((err) => this.logger.error(`Broadcast error: ${err.message}`));
  }

  async getPopups() {
    return this.popupRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async upsertPopup(data: Partial<Popup>, adminId: number) {
    if (data.id) {
      await this.popupRepo.update(data.id, data);
      await this.audit.createAuditLog(
        adminId,
        'update_popup',
        'popup',
        String(data.id),
      );
      return this.popupRepo.findOne({ where: { id: data.id } });
    }
    const saved = await this.popupRepo.save(this.popupRepo.create(data));
    await this.audit.createAuditLog(
      adminId,
      'create_popup',
      'popup',
      String(saved.id),
    );
    return saved;
  }

  async deletePopup(id: number, adminId: number) {
    await this.popupRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_popup',
      'popup',
      String(id),
    );
  }

  async getActivities() {
    return this.activityRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async upsertActivity(data: Partial<Activity>, adminId: number) {
    if (data.id) {
      await this.activityRepo.update(
        data.id,
        data as QueryDeepPartialEntity<Activity>,
      );
      await this.audit.createAuditLog(
        adminId,
        'update_activity',
        'activity',
        String(data.id),
      );
      return this.activityRepo.findOne({ where: { id: data.id } });
    }
    const saved = await this.activityRepo.save(this.activityRepo.create(data));
    await this.audit.createAuditLog(
      adminId,
      'create_activity',
      'activity',
      String(saved.id),
    );
    return saved;
  }

  async deleteActivity(id: number, adminId: number) {
    await this.activityRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_activity',
      'activity',
      String(id),
    );
  }

  async getCheckinConfig() {
    return this.checkinRepo.find({ order: { dayNum: 'ASC' } });
  }

  async getCheckinRecords(limit = 500) {
    const records = await this.checkinRecordRepo
      .createQueryBuilder('r')
      .leftJoin(User, 'u', 'u.user_id = r.user_id')
      .select('r.id', 'id')
      .addSelect('r.user_id', 'userId')
      .addSelect('u.nickname', 'nickname')
      .addSelect('u.phone', 'phone')
      .addSelect('r.day_num', 'dayNum')
      .addSelect('COALESCE(r.award_num, 0)', 'awardNum')
      .addSelect('r.created_at', 'createdAt')
      .orderBy('r.created_at', 'DESC')
      .limit(limit)
      .getRawMany<{
        id: string;
        userId: string;
        nickname: string | null;
        phone: string | null;
        dayNum: number;
        awardNum: string;
        createdAt: Date;
      }>();

    const agg = await this.checkinRecordRepo
      .createQueryBuilder('r')
      .select('COUNT(*)', 'totalClaims')
      .addSelect('COALESCE(SUM(r.award_num), 0)', 'totalAmount')
      .addSelect('COUNT(DISTINCT r.user_id)', 'uniqueUsers')
      .getRawOne<{
        totalClaims: string;
        totalAmount: string;
        uniqueUsers: string;
      }>();
    if (!agg) {
      throw new NotFoundException('Checkin aggregate not available');
    }

    return {
      records: records.map((r) => ({
        id: Number(r.id),
        userId: r.userId,
        username: this.resolveCheckinUsername(r.nickname, r.phone, r.userId),
        dayNum: Number(r.dayNum),
        awardNum: Number(r.awardNum),
        createdAt: r.createdAt,
      })),
      totalClaims: Number(agg.totalClaims),
      totalAmount: Number(agg.totalAmount),
      uniqueUsers: Number(agg.uniqueUsers),
    };
  }

  private resolveCheckinUsername(
    nickname: string | null,
    phone: string | null,
    userId: string,
  ): string {
    if (nickname) return nickname;
    if (phone) return phone;
    return userId;
  }

  async upsertCheckinConfig(data: Partial<CheckinConfig>, adminId: number) {
    if (data.id) {
      await this.checkinRepo.update(data.id, data);
      await this.audit.createAuditLog(
        adminId,
        'update_checkin_config',
        'checkin',
        String(data.id),
      );
      return this.checkinRepo.findOne({ where: { id: data.id } });
    }
    const saved = await this.checkinRepo.save(this.checkinRepo.create(data));
    await this.audit.createAuditLog(
      adminId,
      'create_checkin_config',
      'checkin',
      String(saved.id),
    );
    return saved;
  }

  async deleteCheckinConfig(id: number, adminId: number) {
    await this.checkinRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_checkin_config',
      'checkin',
      String(id),
    );
  }

  async getAvatars() {
    return this.avatarRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async upsertAvatar(data: Partial<Avatar>, adminId: number) {
    if (data.id) {
      await this.avatarRepo.update(data.id, data);
      await this.audit.createAuditLog(
        adminId,
        'update_avatar',
        'avatar',
        String(data.id),
      );
      return this.avatarRepo.findOne({ where: { id: data.id } });
    }
    const saved = await this.avatarRepo.save(this.avatarRepo.create(data));
    await this.audit.createAuditLog(
      adminId,
      'create_avatar',
      'avatar',
      String(saved.id),
    );
    return saved;
  }

  async deleteAvatar(id: number, adminId: number) {
    await this.avatarRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_avatar',
      'avatar',
      String(id),
    );
  }

  async getSharePosters() {
    return this.sharePosterRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async upsertSharePoster(data: Partial<SharePoster>, adminId: number) {
    if (data.id) {
      await this.sharePosterRepo.update(data.id, data);
      await this.audit.createAuditLog(
        adminId,
        'update_share_poster',
        'share_poster',
        String(data.id),
      );
      return this.sharePosterRepo.findOne({ where: { id: data.id } });
    }
    const saved = await this.sharePosterRepo.save(
      this.sharePosterRepo.create(data),
    );
    await this.audit.createAuditLog(
      adminId,
      'create_share_poster',
      'share_poster',
      String(saved.id),
    );
    return saved;
  }

  async deleteSharePoster(id: number, adminId: number) {
    await this.sharePosterRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_share_poster',
      'share_poster',
      String(id),
    );
  }

  async getShareConfigs() {
    return this.shareConfigRepo.find({ order: { id: 'ASC' } });
  }

  async upsertShareConfig(data: Partial<ShareConfig>, adminId: number) {
    if (data.id) {
      await this.shareConfigRepo.update(data.id, data);
      await this.audit.createAuditLog(
        adminId,
        'update_share_config',
        'share_config',
        String(data.id),
      );
      return this.shareConfigRepo.findOne({ where: { id: data.id } });
    }
    const saved = await this.shareConfigRepo.save(
      this.shareConfigRepo.create(data),
    );
    await this.audit.createAuditLog(
      adminId,
      'create_share_config',
      'share_config',
      String(saved.id),
    );
    return saved;
  }

  async deleteShareConfig(id: number, adminId: number) {
    await this.shareConfigRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_share_config',
      'share_config',
      String(id),
    );
  }
}
