import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FcmService } from './fcm.service';
import { FirebaseConfig } from '../../entities/firebase-config.entity';
import { UserFcmToken } from '../../entities/user-fcm-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FirebaseConfig, UserFcmToken])],
  providers: [FcmService],
  exports: [FcmService],
})
export class FcmModule {}
