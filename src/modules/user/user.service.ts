import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Avatar } from '../../entities/avatar.entity';
import { Message } from '../../entities/message.entity';
import { OtpService } from '../auth/otp.service';
import { OtpPurpose } from '../auth/otp-purpose.enum';
import { ConfigLoaderService } from '../config/config-loader.service';
import { FcmService } from '../fcm/fcm.service';
import { BindTelegramDto } from './dto';
import { toUserInfo } from './user.mapper';

interface NotificationRow {
  id: number;
  title: string | null;
  content: string | null;
  imageUrl: string | null;
  type: string;
  isRead: number;
  createdAt: Date;
}

interface NotificationImageRow {
  messageId: number;
  imageUrl: string;
}

interface CountRow {
  cnt: number;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Avatar) private avatarRepo: Repository<Avatar>,
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    private otpService: OtpService,
    private configLoader: ConfigLoaderService,
    private fcm: FcmService,
  ) {}

  async registerFcmToken(userId: string, token: string) {
    await this.fcm.registerToken(userId, token);
    return { success: true };
  }

  async getInfo(userId: string) {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new NotFoundException('User not found');
    return toUserInfo(user);
  }

  async getAvatarList() {
    const avatars = await this.avatarRepo.find({
      where: { status: 1 },
      order: { sortOrder: 'ASC' },
    });

    if (avatars.length > 0) {
      return avatars.map((a) => a.avatarUrl);
    }

    return [
      '/uploads/avatars/avatar_01.png',
      '/uploads/avatars/avatar_02.png',
      '/uploads/avatars/avatar_03.png',
      '/uploads/avatars/avatar_04.png',
      '/uploads/avatars/avatar_05.png',
      '/uploads/avatars/avatar_06.png',
      '/uploads/avatars/avatar_07.png',
      '/uploads/avatars/avatar_08.png',
      '/uploads/avatars/avatar_09.png',
    ];
  }

  async updateAvatar(userId: string, avatar: string) {
    await this.userRepo.update({ userId }, { avatar });
  }

  async updateNickname(userId: string, nickname: string) {
    await this.userRepo.update({ userId }, { nickname });
  }

  async getShareInfo(userId: string) {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new NotFoundException('User not found');
    const siteUrl = await this.configLoader.getSiteUrl();
    return {
      inviteCode: user.inviteCode,
      inviteLink: `${siteUrl}/register?inviteCode=${user.inviteCode}`,
    };
  }

  async bindPhone(userId: string, phone: string, smsCode?: string) {
    await this.otpService.verifyOtp(phone, smsCode, OtpPurpose.Login);

    const taken = await this.userRepo.findOne({
      where: { phone, userId: Not(userId) },
    });
    if (taken) throw new BadRequestException('Phone already in use');

    await this.userRepo.update({ userId }, { phone });
  }

  async bindTelegram(userId: string, tgData: BindTelegramDto) {
    await this.userRepo.update({ userId }, { tgId: String(tgData.id) });
  }

  async bindGoogle(userId: string, idToken: string) {
    await this.userRepo.update(
      { userId },
      { googleId: idToken.substring(0, 32) },
    );
  }

  async getUnreadMessageCount(userId: string) {
    void userId;
    return {
      chipAwardCount: 0,
      k3cAwardCount: 0,
      spinAwardCount: 0,
    };
  }

  async getNotifications(userId: string, pageNo: number, pageSize: number) {
    const page = Math.max(1, pageNo);
    const size = Math.min(50, Math.max(1, pageSize));
    const offset = (page - 1) * size;
    const rows = (await this.messageRepo.query(
      `SELECT m.id AS id, m.title AS title, m.content AS content,
              m.image_url AS imageUrl, m.msg_type AS type,
              m.created_at AS createdAt,
              (r.id IS NOT NULL) AS isRead
       FROM messages m
       LEFT JOIN message_read r ON r.message_id = m.id AND r.user_id = ?
       WHERE (m.user_id = ? OR m.user_id IS NULL)
         AND (r.hidden IS NULL OR r.hidden = 0)
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, userId, size, offset],
    )) as NotificationRow[];
    const totalRows = (await this.messageRepo.query(
      `SELECT COALESCE(COUNT(*), 0) AS cnt FROM messages m
       LEFT JOIN message_read r ON r.message_id = m.id AND r.user_id = ?
       WHERE (m.user_id = ? OR m.user_id IS NULL)
         AND (r.hidden IS NULL OR r.hidden = 0)`,
      [userId, userId],
    )) as CountRow[];
    const ids = rows.map((r) => Number(r.id));
    const imagesByMessage: Record<number, string[]> = {};
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      const imageRows = (await this.messageRepo.query(
        `SELECT message_id AS messageId, image_url AS imageUrl
         FROM message_images
         WHERE message_id IN (${placeholders})
         ORDER BY sort_order ASC`,
        ids,
      )) as NotificationImageRow[];
      for (const row of imageRows) {
        const key = Number(row.messageId);
        if (!imagesByMessage[key]) imagesByMessage[key] = [];
        imagesByMessage[key].push(row.imageUrl);
      }
    }
    return {
      list: rows.map((r) => {
        const id = Number(r.id);
        const images =
          imagesByMessage[id] ?? (r.imageUrl ? [r.imageUrl] : []);
        return {
          id,
          title: r.title,
          content: r.content,
          imageUrl: r.imageUrl,
          images,
          type: r.type,
          isRead: Number(r.isRead) === 1,
          createdAt: r.createdAt,
        };
      }),
      total: Number(totalRows[0].cnt),
      pageNo: page,
      pageSize: size,
    };
  }

  async getNotificationUnreadCount(userId: string) {
    const rows = (await this.messageRepo.query(
      `SELECT COALESCE(COUNT(*), 0) AS cnt FROM messages m
       LEFT JOIN message_read r ON r.message_id = m.id AND r.user_id = ?
       WHERE (m.user_id = ? OR m.user_id IS NULL) AND r.id IS NULL`,
      [userId, userId],
    )) as CountRow[];
    return { count: Number(rows[0].cnt) };
  }

  async markNotificationRead(userId: string, id: number) {
    await this.messageRepo.query(
      'INSERT IGNORE INTO message_read (message_id, user_id) VALUES (?, ?)',
      [Number(id), userId],
    );
    return { success: true };
  }

  async markAllNotificationsRead(userId: string) {
    await this.messageRepo.query(
      `INSERT IGNORE INTO message_read (message_id, user_id)
       SELECT m.id, ? FROM messages m
       LEFT JOIN message_read r ON r.message_id = m.id AND r.user_id = ?
       WHERE (m.user_id = ? OR m.user_id IS NULL) AND r.id IS NULL`,
      [userId, userId, userId],
    );
    return { success: true };
  }

  async deleteNotification(userId: string, id: number) {
    await this.messageRepo.query(
      `INSERT INTO message_read (message_id, user_id, hidden)
       SELECT m.id, ?, 1 FROM messages m
       WHERE m.id = ? AND (m.user_id = ? OR m.user_id IS NULL)
       ON DUPLICATE KEY UPDATE hidden = 1`,
      [userId, Number(id), userId],
    );
    return { success: true };
  }

  async clearAllNotifications(userId: string) {
    await this.messageRepo.query(
      `INSERT INTO message_read (message_id, user_id, hidden)
       SELECT m.id, ?, 1 FROM messages m
       WHERE m.user_id = ? OR m.user_id IS NULL
       ON DUPLICATE KEY UPDATE hidden = 1`,
      [userId, userId],
    );
    return { success: true };
  }

  async downloadAppAward(userId: string) {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user || Number(user.appAward) <= 0) return 0;
    const award = Number(user.appAward);
    const claimResult = await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({
        balance: () => 'balance + app_award',
        appAward: 0,
        version: () => 'version + 1',
      })
      .where('user_id = :userId AND app_award > 0', { userId })
      .execute();

    if (claimResult.affected !== 1) return 0;
    return award;
  }

  async getWallet(userId: string) {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new NotFoundException('User not found');
    const balance = Number(user.balance);
    const withdrawableBalance = Number(user.withdrawableBalance);
    const bonusBalance = Number(user.bonusBalance);
    const rechargeBalance = Math.max(0, balance - withdrawableBalance);
    return {
      balance,
      bonusBalance,
      isRecharge: user.isRecharge,
      rechargeBalance,
      withdrawBalance: withdrawableBalance,
      wageringRequired: 0,
      wageringCompleted: 0,
      bonusRules: [],
    };
  }
}
