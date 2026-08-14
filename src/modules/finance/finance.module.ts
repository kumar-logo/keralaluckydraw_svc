import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  FinanceController,
  FinanceAgentController,
} from './finance.controller';
import { FinanceService } from './finance.service';
import { FinanceCronService } from './finance-cron.service';
import { User } from '../../entities/user.entity';
import { Transaction } from '../../entities/transaction.entity';
import { BankCard } from '../../entities/bank-card.entity';
import { RechargeRecord } from '../../entities/recharge-record.entity';
import { WithdrawalRecord } from '../../entities/withdrawal-record.entity';
import { VipConfig } from '../../entities/vip-config.entity';
import { RebateRecord } from '../../entities/rebate-record.entity';
import { PaymentGateway } from '../../entities/payment-gateway.entity';
import { CommissionConfig } from '../../entities/commission-config.entity';
import { Order } from '../../entities/order.entity';
import { TransferTier } from '../../entities/transfer-tier.entity';
import { TransferRecord } from '../../entities/transfer-record.entity';
import { TransactionType as TransactionTypeConfig } from '../../entities/transaction-type.entity';
import { PaymentModule } from '../payment/payment.module';
import { CronModule } from '../cron/cron.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Transaction,
      BankCard,
      RechargeRecord,
      WithdrawalRecord,
      VipConfig,
      RebateRecord,
      PaymentGateway,
      CommissionConfig,
      Order,
      TransferTier,
      TransferRecord,
      TransactionTypeConfig,
    ]),
    PaymentModule,
    CronModule,
  ],
  controllers: [FinanceController, FinanceAgentController],
  providers: [FinanceService, FinanceCronService],
  exports: [FinanceService],
})
export class FinanceModule {}
