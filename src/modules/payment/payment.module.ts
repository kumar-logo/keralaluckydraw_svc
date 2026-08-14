import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { User } from '../../entities/user.entity';
import { RechargeRecord } from '../../entities/recharge-record.entity';
import { Transaction } from '../../entities/transaction.entity';
import { PaymentGateway } from '../../entities/payment-gateway.entity';
import { CommissionConfig } from '../../entities/commission-config.entity';
import { YpaymentGateway } from './gateways/ypayment.gateway';
import { CashfreeGateway } from './gateways/cashfree.gateway';
import { RazorpayGateway } from './gateways/razorpay.gateway';
import { ManualGateway } from './gateways/manual.gateway';
import { PaymentGatewayRegistry } from './gateways/payment-gateway.registry';
import { YpaymentController } from './ypayment.controller';
import { CashfreeController } from './cashfree.controller';
import { RazorpayController } from './razorpay.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      RechargeRecord,
      Transaction,
      PaymentGateway,
      CommissionConfig,
    ]),
  ],
  controllers: [YpaymentController, CashfreeController, RazorpayController],
  providers: [
    PaymentService,
    YpaymentGateway,
    CashfreeGateway,
    RazorpayGateway,
    ManualGateway,
    PaymentGatewayRegistry,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
