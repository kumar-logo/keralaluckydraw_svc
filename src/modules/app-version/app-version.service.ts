import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppVersion } from '../../entities/app-version.entity';
import type { SaveAppVersionDto } from '../admin/dto/app-version.dto';

export interface AppVersionConfig {
  version: string;
  forceUpdate: boolean;
  minSupportedVersion: string;
  storeUrl: string;
  androidPackageName: string;
  updateMessage: string;
}

@Injectable()
export class AppVersionService {
  constructor(
    @InjectRepository(AppVersion)
    private readonly repo: Repository<AppVersion>,
  ) {}

  async getVersion(): Promise<string> {
    const rows = await this.repo.find({ order: { id: 'ASC' }, take: 1 });
    return rows.length > 0 ? rows[0].version : '';
  }

  async getConfig(): Promise<AppVersionConfig> {
    const rows = await this.repo.find({ order: { id: 'ASC' }, take: 1 });
    if (rows.length === 0) {
      return {
        version: '',
        forceUpdate: false,
        minSupportedVersion: '',
        storeUrl: '',
        androidPackageName: '',
        updateMessage: '',
      };
    }
    const row = rows[0];
    return {
      version: row.version,
      forceUpdate: Number(row.forceUpdate) === 1,
      minSupportedVersion: row.minSupportedVersion,
      storeUrl: row.storeUrl,
      androidPackageName: row.androidPackageName,
      updateMessage: row.updateMessage,
    };
  }

  async setVersion(version: string): Promise<string> {
    const trimmed = version.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('Version is required');
    }
    const rows = await this.repo.find({ order: { id: 'ASC' }, take: 1 });
    if (rows.length > 0) {
      rows[0].version = trimmed;
      const saved = await this.repo.save(rows[0]);
      return saved.version;
    }
    const created = await this.repo.save(this.repo.create({ version: trimmed }));
    return created.version;
  }

  async setConfig(data: SaveAppVersionDto): Promise<AppVersionConfig> {
    const trimmed = data.version.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('Version is required');
    }
    const rows = await this.repo.find({ order: { id: 'ASC' }, take: 1 });
    const entity =
      rows.length > 0
        ? rows[0]
        : this.repo.create({
            forceUpdate: 0,
            minSupportedVersion: '',
            storeUrl: '',
            androidPackageName: '',
            updateMessage: '',
          });
    entity.version = trimmed;
    entity.forceUpdate =
      data.forceUpdate !== undefined
        ? data.forceUpdate
          ? 1
          : 0
        : entity.forceUpdate;
    entity.minSupportedVersion =
      data.minSupportedVersion !== undefined
        ? data.minSupportedVersion.trim()
        : entity.minSupportedVersion;
    entity.storeUrl =
      data.storeUrl !== undefined ? data.storeUrl.trim() : entity.storeUrl;
    entity.androidPackageName =
      data.androidPackageName !== undefined
        ? data.androidPackageName.trim()
        : entity.androidPackageName;
    entity.updateMessage =
      data.updateMessage !== undefined
        ? data.updateMessage
        : entity.updateMessage;
    await this.repo.save(entity);
    return this.getConfig();
  }
}
