import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from '../../entities/user.entity';
import { Avatar } from '../../entities/avatar.entity';
import { Message } from '../../entities/message.entity';
import { MessageRead } from '../../entities/message-read.entity';
import { MessageImage } from '../../entities/message-image.entity';
import { AuthModule } from '../auth/auth.module';
import { FcmModule } from '../fcm/fcm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Avatar, Message, MessageRead, MessageImage]),
    AuthModule,
    FcmModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
