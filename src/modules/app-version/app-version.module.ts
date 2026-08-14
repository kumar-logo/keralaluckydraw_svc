import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppVersion } from '../../entities/app-version.entity';
import { AppVersionService } from './app-version.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppVersion])],
  providers: [AppVersionService],
  exports: [AppVersionService],
})
export class AppVersionModule {}
