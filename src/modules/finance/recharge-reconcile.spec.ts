import { HttpStatus, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { FinanceCronService } from './finance-cron.service';
import { PaymentService } from '../payment/payment.service';
import { PaymentGatewayRegistry } from '../payment/gateways/payment-gateway.registry';
import {
  PayIndiaGateway,
  PayIndiaPaymentStatus,
  PayIndiaResponseStatus,
} from '../payment/gateways/payindia.gateway';
import { YpaymentGateway } from '../payment/gateways/ypayment.gateway';
import { CashfreeGateway } from '../payment/gateways/cashfree.gateway';
import { RazorpayGateway } from '../payment/gateways/razorpay.gateway';
import { ManualGateway } from '../payment/gateways/manual.gateway';
import { ConfigLoaderService } from '../config/config-loader.service';
import { CronRunRecorderService } from '../cron/cron-run-recorder.service';
import { User } from '../../entities/user.entity';
import { Order } from '../../entities/order.entity';
import { VipConfig } from '../../entities/vip-config.entity';
import { RebateRecord } from '../../entities/rebate-record.entity';
import { CommissionConfig } from '../../entities/commission-config.entity';
import { Transaction } from '../../entities/transaction.entity';
import { RechargeRecord } from '../../entities/recharge-record.entity';
import { PaymentGateway } from '../../entities/payment-gateway.entity';
import {
  PaymentGatewayCode,
  PaymentGatewayMode,
  RechargeStatus,
} from '../../common/enums';

const HOUR_MS = 60 * 60 * 1000;
const ORDER_NO = 'RC1790000000000002';
const USER_ID = 'U20002';
const GATEWAY_ID = 12;
const RECORD_ID = 902;

const gatewayRow = {
  id: GATEWAY_ID,
  gatewayName: 'PayIndia',
  providerCode: PaymentGatewayCode.PayIndia,
  gatewayType: PaymentGatewayCode.PayIndia,
  mode: PaymentGatewayMode.Auto,
  apiUrl: 'https://gateway.payindia.test/api',
  apiKey: 'test-api-key',
  apiSecret: 'test-api-secret',
  callbackUrl: 'https://api.example.test/payment/webhook/payindia',
  webhookSecret: 'test-webhook-secret',
  additionalVerification: 0,
  status: 1,
} as unknown as PaymentGateway;

interface Harness {
  cron: FinanceCronService;
  rcUpdate: jest.Mock;
  txnSave: jest.Mock;
}

const buildHarness = (ageMs: number): Harness => {
  const record = {
    id: RECORD_ID,
    orderNo: ORDER_NO,
    userId: USER_ID,
    channelId: GATEWAY_ID,
    amount: '100.00',
    bonusAmount: '0.00',
    status: RechargeStatus.Pending,
    paymentRef: null,
    createdAt: new Date(Date.now() - ageMs),
  } as unknown as RechargeRecord;

  const rcUpdate = jest.fn().mockResolvedValue({ affected: 1 });
  const rcRepo = {
    find: jest.fn().mockResolvedValue([record]),
    findOne: jest.fn().mockResolvedValue(record),
    update: rcUpdate,
  } as unknown as Repository<RechargeRecord>;
  const gatewayRepo = {
    find: jest.fn().mockResolvedValue([gatewayRow]),
    findOne: jest.fn().mockResolvedValue(gatewayRow),
  } as unknown as Repository<PaymentGateway>;
  const userRepo = {
    findOne: jest.fn().mockResolvedValue({ userId: USER_ID, balance: '40.00' }),
  } as unknown as Repository<User>;
  const txnSave = jest.fn().mockResolvedValue(undefined);
  const txnRepo = {
    create: jest
      .fn()
      .mockImplementation((entity: Partial<Transaction>) => entity),
    save: txnSave,
    findOne: jest.fn().mockResolvedValue(null),
  } as unknown as Repository<Transaction>;
  const dataSource = {
    createQueryRunner: jest.fn(),
  } as unknown as DataSource;

  const payIndia = new PayIndiaGateway(userRepo, rcRepo, gatewayRepo);
  const registry = new PaymentGatewayRegistry(
    {} as unknown as YpaymentGateway,
    payIndia,
    {} as unknown as CashfreeGateway,
    {} as unknown as RazorpayGateway,
    {} as unknown as ManualGateway,
  );
  const paymentService = new PaymentService(
    userRepo,
    rcRepo,
    txnRepo,
    gatewayRepo,
    {} as unknown as Repository<CommissionConfig>,
    {} as unknown as ConfigLoaderService,
    dataSource,
    registry,
  );
  const recorder = {
    run: (_name: string, work: () => Promise<void>) => work(),
  } as unknown as CronRunRecorderService;

  const cron = new FinanceCronService(
    userRepo,
    {} as unknown as Repository<Order>,
    {} as unknown as Repository<VipConfig>,
    {} as unknown as Repository<RebateRecord>,
    {} as unknown as Repository<CommissionConfig>,
    txnRepo,
    rcRepo,
    gatewayRepo,
    dataSource,
    paymentService,
    recorder,
  );
  return { cron, rcUpdate, txnSave };
};

let fetchMock: jest.SpiedFunction<typeof fetch>;

const respondJson = (httpStatus: number, body: object): void => {
  fetchMock.mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status: httpStatus })),
  );
};

beforeEach(() => {
  fetchMock = jest.spyOn(global, 'fetch');
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Recharge reconcile cron with PayIndia', () => {
  it('abandons a PayIndia order older than 24h whose status stays pending', async () => {
    const harness = buildHarness(25 * HOUR_MS);
    respondJson(HttpStatus.OK, {
      status: PayIndiaResponseStatus.Success,
      data: { amount: 100, payment_status: PayIndiaPaymentStatus.Pending },
    });

    await harness.cron.reconcilePendingRecharges();

    expect(harness.rcUpdate).toHaveBeenCalledWith(RECORD_ID, {
      status: RechargeStatus.Rejected,
      remark:
        'Abandoned after 24h: paymentStatus=pending; gatewayAmount=100; expected=100',
    });
    expect(harness.txnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        sourceType: 'recharge_failed',
        amount: 0,
        refId: ORDER_NO,
      }),
    );
  });

  it('abandons a PayIndia order older than 24h whose check-status is no longer success', async () => {
    const harness = buildHarness(25 * HOUR_MS);
    respondJson(HttpStatus.NOT_FOUND, {
      status: 'error',
      error: 'Order expired',
    });

    await harness.cron.reconcilePendingRecharges();

    expect(harness.rcUpdate).toHaveBeenCalledWith(RECORD_ID, {
      status: RechargeStatus.Rejected,
      remark:
        'Abandoned after 24h: checkStatus=error; httpStatus=404; detail=Order expired',
    });
  });

  it('abandons a PayIndia order older than 24h with an unrecognised payment_status', async () => {
    const harness = buildHarness(25 * HOUR_MS);
    respondJson(HttpStatus.OK, {
      status: PayIndiaResponseStatus.Success,
      data: { amount: 100, payment_status: 'initiated' },
    });

    await harness.cron.reconcilePendingRecharges();

    expect(harness.rcUpdate).toHaveBeenCalledWith(RECORD_ID, {
      status: RechargeStatus.Rejected,
      remark:
        'Abandoned after 24h: paymentStatus=initiated; gatewayAmount=100; expected=100',
    });
  });

  it('rejects a young PayIndia order immediately when the gateway reports expired', async () => {
    const harness = buildHarness(HOUR_MS);
    respondJson(HttpStatus.OK, {
      status: PayIndiaResponseStatus.Success,
      data: { amount: 100, payment_status: PayIndiaPaymentStatus.Expired },
    });

    await harness.cron.reconcilePendingRecharges();

    expect(harness.rcUpdate).toHaveBeenCalledWith(RECORD_ID, {
      status: RechargeStatus.Rejected,
      remark: 'paymentStatus=expired; gatewayAmount=100; expected=100',
    });
  });

  it('leaves a young pending PayIndia order untouched', async () => {
    const harness = buildHarness(HOUR_MS);
    respondJson(HttpStatus.OK, {
      status: PayIndiaResponseStatus.Success,
      data: { amount: 100, payment_status: PayIndiaPaymentStatus.Pending },
    });

    await harness.cron.reconcilePendingRecharges();

    expect(harness.rcUpdate).not.toHaveBeenCalled();
    expect(harness.txnSave).not.toHaveBeenCalled();
  });

  it('never abandons an old order while the gateway is unreachable', async () => {
    const harness = buildHarness(25 * HOUR_MS);
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await harness.cron.reconcilePendingRecharges();

    expect(harness.rcUpdate).not.toHaveBeenCalled();
    expect(harness.txnSave).not.toHaveBeenCalled();
  });

  it('never abandons an old order while the gateway rejects the credentials', async () => {
    const harness = buildHarness(25 * HOUR_MS);
    respondJson(HttpStatus.UNAUTHORIZED, {
      status: 'error',
      error: 'Invalid API key',
    });

    await harness.cron.reconcilePendingRecharges();

    expect(harness.rcUpdate).not.toHaveBeenCalled();
    expect(harness.txnSave).not.toHaveBeenCalled();
  });
});
