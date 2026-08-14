import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { ThirdPartyConfig } from '../../entities/third-party-config.entity';
import { ThirdPartyTransaction } from '../../entities/third-party-transaction.entity';
import { User } from '../../entities/user.entity';
import { GameList } from '../../entities/game-list.entity';
import { Transaction } from '../../entities/transaction.entity';
import { TinyFlag } from '../../common/enums';
import { TransactionType } from '../../common/enums/transaction-type.enum';
import {
  SeamlessEvent,
  SeamlessCode,
  SeamlessMessage,
  LaunchReturnType,
  AggregatorCode,
} from './third-party.enums';

const LAUNCH_TIMEOUT_MS = 20000;
const AMOUNT_DECIMALS = 6;

export interface LaunchResult {
  url: string | null;
  returnType?: number;
  gameCode: string;
  gameName?: string;
  message?: string;
}

interface LaunchPayload {
  agency_uid: string;
  game_uid: string;
  member_account: string;
  timestamp: string;
  credit_amount: number;
  currency_code: string;
  language: string;
  platform: number;
  home_url: string;
  transfer_id: string;
}

interface AggregatorLaunchResponse {
  code?: number;
  msg?: string;
  message?: string;
  payload?: { game_launch_url?: string };
}

export interface SeamlessRequestBody {
  timestamp?: string;
  event?: string;
  signature?: string;
  payload?: SeamlessTxnPayload;
}

interface SeamlessTxnPayload {
  member_account?: string;
  bet_amount?: number | string;
  win_amount?: number | string;
  serial_number?: string;
  game_round?: string;
  round?: string;
  currency_code?: string;
}

export interface SeamlessEnvelope {
  code: number;
  msg: string;
  msgCode: number;
  balance: number;
  credit_amount: number;
  payload: {
    balance: number;
    credit_amount: number;
    member_account?: string;
    currency_code?: string;
  };
  serviceNowTime: string;
}

@Injectable()
export class ThirdPartyService {
  private readonly logger = new Logger(ThirdPartyService.name);

  constructor(
    @InjectRepository(ThirdPartyConfig)
    private configRepo: Repository<ThirdPartyConfig>,
    @InjectRepository(ThirdPartyTransaction)
    private txnRepo: Repository<ThirdPartyTransaction>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(GameList) private gameListRepo: Repository<GameList>,
    private dataSource: DataSource,
  ) {}

  async getLaunchUrl(
    userId: string,
    gameCode: string,
    homeUrl?: string,
  ): Promise<LaunchResult> {
    const cfg = await this.configRepo.findOne({
      where: {},
      order: { id: 'ASC' },
    });

    let gameName: string | undefined;
    const game = gameCode
      ? await this.gameListRepo.findOne({
          where: { gameCode, status: TinyFlag.Yes },
        })
      : null;
    if (game) {
      gameName = game.gameName;
    }

    if (
      !cfg ||
      cfg.enabled !== TinyFlag.Yes ||
      !this.isAbsoluteUrl(cfg.launchUrl)
    ) {
      return {
        url: null,
        gameCode,
        gameName,
        message: SeamlessMessage.GameUnavailable,
      };
    }

    if (!userId) {
      return {
        url: null,
        gameCode,
        gameName,
        message: SeamlessMessage.UserNotFound,
      };
    }

    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) {
      return {
        url: null,
        gameCode,
        gameName,
        message: SeamlessMessage.UserNotFound,
      };
    }

    if (!game) {
      return {
        url: null,
        gameCode,
        gameName,
        message: SeamlessMessage.GameUnavailable,
      };
    }

    const launchId =
      game.gameUid && game.gameUid.trim() ? game.gameUid.trim() : game.gameCode;

    const payload: LaunchPayload = {
      agency_uid: cfg.agencyUid,
      game_uid: launchId,
      member_account: cfg.memberPrefix + Number(user.id) + cfg.memberSuffix,
      timestamp: this.utcTimestamp(),
      credit_amount: Number(user.balance),
      currency_code: cfg.currency,
      language: cfg.language,
      platform: cfg.platform,
      home_url: this.resolveHomeUrl(cfg.homeUrl, homeUrl),
      transfer_id: this.uniqueTransferId(),
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LAUNCH_TIMEOUT_MS);
      let raw: string;
      try {
        const response = await fetch(cfg.launchUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        raw = await response.text();
      } finally {
        clearTimeout(timer);
      }

      let data: AggregatorLaunchResponse;
      try {
        data = JSON.parse(raw) as AggregatorLaunchResponse;
      } catch {
        this.logger.error(
          `Seamless launch non-JSON response: ${raw.slice(0, 500)}`,
        );
        return {
          url: null,
          gameCode,
          gameName,
          message: SeamlessMessage.GameLaunchFailed,
        };
      }

      if (
        data &&
        Number(data.code) === AggregatorCode.Success &&
        data.payload?.game_launch_url
      ) {
        return {
          url: data.payload.game_launch_url,
          returnType: LaunchReturnType.Url,
          gameCode,
          gameName,
        };
      }

      return {
        url: null,
        gameCode,
        gameName,
        message: this.resolveLaunchError(data),
      };
    } catch (error) {
      this.logger.error(`Seamless launch error: ${(error as Error).message}`);
      return {
        url: null,
        gameCode,
        gameName,
        message: SeamlessMessage.GameLaunchFailed,
      };
    }
  }

  async handleSeamlessCallback(
    body: SeamlessRequestBody,
  ): Promise<SeamlessEnvelope | { code: number; msg: string }> {
    const now = this.serviceNowTime();

    if (
      !body ||
      !body.timestamp ||
      !body.event ||
      body.payload === undefined ||
      body.payload === null ||
      !body.signature
    ) {
      return {
        code: SeamlessCode.MissingFields,
        msg: SeamlessMessage.MissingFields,
      };
    }

    const cfg = await this.configRepo.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    const memberPrefix = cfg ? cfg.memberPrefix : '';
    const memberSuffix = cfg ? cfg.memberSuffix : '';

    const payload = body.payload;
    const memberAccount =
      payload.member_account !== undefined
        ? String(payload.member_account).trim()
        : '';
    const memberId = this.parseMemberId(
      memberAccount,
      memberPrefix,
      memberSuffix,
    );

    if (!memberId) {
      return {
        code: SeamlessCode.UserNotFound,
        msg: SeamlessMessage.UserNotFound,
      };
    }

    const user = await this.userRepo.findOne({ where: { id: memberId } });
    if (!user) {
      return {
        code: SeamlessCode.UserNotFound,
        msg: SeamlessMessage.UserNotFound,
      };
    }

    let balance = Number(user.balance);

    if (body.event === SeamlessEvent.GameTransaction) {
      const betAmount = this.parseAmount(payload.bet_amount);
      const winAmount = this.parseAmount(payload.win_amount);
      const serial =
        payload.serial_number !== undefined
          ? String(payload.serial_number).trim()
          : '';
      const gameRound = this.parseRound(payload.game_round, payload.round);
      const currencyCode =
        payload.currency_code !== undefined
          ? String(payload.currency_code)
          : '';

      const txnKey = this.buildTxnKey(
        serial,
        memberId,
        gameRound,
        betAmount,
        winAmount,
      );

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const lockedUser = await queryRunner.manager
          .getRepository(User)
          .createQueryBuilder('u')
          .setLock('pessimistic_write')
          .where('u.id = :id', { id: memberId })
          .getOne();

        const lockedBalance = lockedUser ? Number(lockedUser.balance) : balance;

        try {
          await queryRunner.manager
            .getRepository(ThirdPartyTransaction)
            .insert({
              txnKey,
              serialNumber: serial !== '' ? serial : undefined,
              memberId,
              gameRound: gameRound !== '' ? gameRound : undefined,
              betAmount,
              winAmount,
            });
        } catch (insertErr) {
          await queryRunner.rollbackTransaction();
          if (this.isDuplicateKeyError(insertErr)) {
            const current = await this.userRepo.findOne({
              where: { id: memberId },
            });
            return this.buildEnvelope(
              SeamlessCode.Ok,
              SeamlessMessage.Ok,
              current ? Number(current.balance) : lockedBalance,
              now,
              memberAccount,
              currencyCode,
            );
          }
          return this.buildEnvelope(
            SeamlessCode.ServerError,
            SeamlessMessage.ServerError,
            lockedBalance,
            now,
            memberAccount,
            currencyCode,
          );
        }

        if (betAmount > 0 && betAmount > lockedBalance) {
          await queryRunner.rollbackTransaction();
          return this.buildEnvelope(
            SeamlessCode.InsufficientBalance,
            SeamlessMessage.InsufficientBalance,
            lockedBalance,
            now,
            memberAccount,
            currencyCode,
          );
        }

        let newBalance = lockedBalance - betAmount + winAmount;
        if (newBalance < 0) newBalance = 0;

        await queryRunner.manager
          .getRepository(User)
          .createQueryBuilder()
          .update(User)
          .set({
            balance: newBalance,
            withdrawableBalance: () =>
              `LEAST(withdrawable_balance, ${lockedBalance - betAmount}) + ${winAmount}`,
            version: () => 'version + 1',
          })
          .where('id = :id', { id: memberId })
          .execute();

        const historyUserId = user.userId;
        const roundRef = gameRound !== '' ? gameRound : serial;
        const txnHistoryRepo = queryRunner.manager.getRepository(Transaction);
        if (betAmount > 0) {
          await txnHistoryRepo.insert({
            userId: historyUserId,
            sourceType: TransactionType.ThirdPartyBet,
            amount: -betAmount,
            balance: lockedBalance - betAmount,
            refId: txnKey,
            description: roundRef ? `Game bet ${roundRef}` : 'Game bet',
          });
        }
        if (winAmount > 0) {
          await txnHistoryRepo.insert({
            userId: historyUserId,
            sourceType: TransactionType.ThirdPartyWin,
            amount: winAmount,
            balance: newBalance,
            refId: txnKey,
            description: roundRef ? `Game win ${roundRef}` : 'Game win',
          });
        }

        await queryRunner.commitTransaction();
        balance = newBalance;
      } catch (error) {
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
        }
        this.logger.error(
          `Seamless callback error: ${(error as Error).message}`,
        );
        return this.buildEnvelope(
          SeamlessCode.ServerError,
          SeamlessMessage.ServerError,
          balance,
          now,
          memberAccount,
          currencyCode,
        );
      } finally {
        await queryRunner.release();
      }

      return this.buildEnvelope(
        SeamlessCode.Ok,
        SeamlessMessage.Ok,
        balance,
        now,
        memberAccount,
        currencyCode,
      );
    }

    return this.buildEnvelope(
      SeamlessCode.Ok,
      SeamlessMessage.Ok,
      balance,
      now,
      memberAccount,
      payload.currency_code !== undefined ? String(payload.currency_code) : '',
    );
  }

  private parseAmount(value: number | string | undefined): number {
    return value !== undefined ? Number(value) : 0;
  }

  private parseRound(
    gameRound: string | undefined,
    round: string | undefined,
  ): string {
    if (gameRound !== undefined) return gameRound.trim();
    if (round !== undefined) return round.trim();
    return '';
  }

  private parseMemberId(
    memberAccount: string,
    prefix: string,
    suffix: string,
  ): number | null {
    if (memberAccount === '') return null;

    let uid = memberAccount;
    if (prefix !== '' && uid.toLowerCase().startsWith(prefix.toLowerCase())) {
      uid = uid.slice(prefix.length);
    }
    if (suffix !== '' && uid.toLowerCase().endsWith(suffix.toLowerCase())) {
      uid = uid.slice(0, uid.length - suffix.length);
    }
    uid = uid.trim();

    if (!this.isDigits(uid)) {
      const prefixLen = prefix.length;
      const suffixLen = suffix.length;
      if (
        prefixLen > 0 &&
        suffixLen > 0 &&
        memberAccount.length > prefixLen + suffixLen
      ) {
        const middle = memberAccount.slice(prefixLen, -suffixLen).trim();
        if (middle !== '') {
          if (this.isDigits(middle)) {
            uid = middle;
          } else {
            const longest = this.longestDigitRun(middle);
            if (longest) uid = longest;
          }
        }
      }
    }

    if (!this.isDigits(uid)) {
      const longest = this.longestDigitRun(memberAccount);
      if (longest) uid = longest;
    }

    if (!this.isDigits(uid)) return null;
    return Number(uid);
  }

  private buildTxnKey(
    serial: string,
    memberId: number,
    gameRound: string,
    betAmount: number,
    winAmount: number,
  ): string {
    const source =
      serial !== ''
        ? serial
        : `${memberId}|${gameRound}|${betAmount.toFixed(AMOUNT_DECIMALS)}|${winAmount.toFixed(AMOUNT_DECIMALS)}`;
    return crypto.createHash('sha1').update(source).digest('hex');
  }

  private buildEnvelope(
    code: number,
    msg: string,
    balance: number,
    now: string,
    memberAccount: string,
    currencyCode: string,
  ): SeamlessEnvelope {
    const value = Number(balance);
    return {
      code,
      msg,
      msgCode: code,
      balance: value,
      credit_amount: value,
      payload: {
        balance: value,
        credit_amount: value,
        member_account: memberAccount,
        currency_code: currencyCode,
      },
      serviceNowTime: now,
    };
  }

  private isAbsoluteUrl(url: string | null | undefined): boolean {
    return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
  }

  private resolveLaunchError(data: AggregatorLaunchResponse): string {
    const candidates = [data.msg, data.message];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim() !== '') {
        return candidate;
      }
    }
    return SeamlessMessage.GameLaunchFailed;
  }

  private resolveHomeUrl(
    configHomeUrl: string,
    requestHomeUrl: string | undefined,
  ): string {
    const candidates = [
      configHomeUrl,
      process.env.PUBLIC_BASE_URL,
      requestHomeUrl,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed !== '') return trimmed;
      }
    }
    return '';
  }

  private isDigits(value: string): boolean {
    return value !== '' && /^\d+$/.test(value);
  }

  private longestDigitRun(value: string): string | null {
    const matches = value.match(/\d+/g);
    if (!matches || matches.length === 0) return null;
    return matches.reduce((a, b) => (b.length > a.length ? b : a));
  }

  private isDuplicateKeyError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const record = error as { message?: string; code?: string };
    if (record.code === 'ER_DUP_ENTRY') return true;
    return record.message !== undefined && /duplicate/i.test(record.message);
  }

  private utcTimestamp(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  private uniqueTransferId(): string {
    return `tx_${Date.now().toString(16)}${crypto.randomBytes(6).toString('hex')}`;
  }

  private serviceNowTime(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const get = (type: string): string => {
      const part = parts.find((p) => p.type === type);
      return part ? part.value : '';
    };
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
  }
}
