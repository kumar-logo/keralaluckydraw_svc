import { User } from '../../entities/user.entity';

export interface UserInfo {
  userID: string;
  phone: string;
  nickname: string;
  nickName: string;
  avatar: string;
  balance: number;
  bonusBalance: number;
  isRecharge: number;
  appAward: number;
  vipLevel: number;
  inviteCode: string;
  tgBound: boolean;
  googleBound: boolean;
  status: number;
  banReason: string;
}

export function toUserInfo(user: User): UserInfo {
  return {
    userID: user.userId,
    phone: user.phone,
    nickname: user.nickname,
    nickName: user.nickname,
    avatar: user.avatar,
    balance: Number(user.balance),
    bonusBalance: Number(user.bonusBalance),
    isRecharge: user.isRecharge,
    appAward: Number(user.appAward),
    vipLevel: user.vipLevel,
    inviteCode: user.inviteCode,
    tgBound: !!user.tgId,
    googleBound: !!user.googleId,
    status: user.status,
    banReason: user.banReason ?? '',
  };
}
