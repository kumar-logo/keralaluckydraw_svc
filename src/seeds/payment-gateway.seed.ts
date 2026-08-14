import { DataSource } from 'typeorm';
import { PaymentGateway } from '../entities/payment-gateway.entity';
import { PaymentGatewayMethod } from '../entities/payment-gateway-method.entity';
import { PaymentGatewayMode } from '../common/enums';

const gateways = [
  {
    gatewayName: 'RazorPay',
    providerCode: 'razorpay',
    mode: PaymentGatewayMode.Auto,
    apiUrl: 'https://api.razorpay.com/v1',
    callbackUrl: 'https://api.keralaluckydraw.com/payment/webhook/razorpay',
    minAmount: 100,
    maxAmount: 50000,
    feeRate: 0.02,
    feeFixed: 0,
    supportedMethods: ['upi', 'bank', 'card'],
    sortOrder: 1,
    status: 1,
  },
  {
    gatewayName: 'PayTM',
    providerCode: 'paytm',
    mode: PaymentGatewayMode.Auto,
    apiUrl: 'https://securegw.paytm.in',
    minAmount: 100,
    maxAmount: 100000,
    feeRate: 0.018,
    feeFixed: 0,
    supportedMethods: ['upi', 'wallet'],
    sortOrder: 2,
    status: 1,
  },
  {
    gatewayName: 'PhonePe PG',
    providerCode: 'phonepe',
    mode: PaymentGatewayMode.Auto,
    apiUrl: 'https://api.phonepe.com/apis/hermes',
    minAmount: 100,
    maxAmount: 200000,
    feeRate: 0.015,
    feeFixed: 0,
    supportedMethods: ['upi'],
    sortOrder: 3,
    status: 1,
  },
  {
    gatewayName: 'YPayment',
    providerCode: 'ypayment',
    mode: PaymentGatewayMode.Auto,
    apiUrl: 'https://axnmart.in/',
    apiKey: '3f8be0f1eebb6f6e2f935ca2738e5b53',
    callbackUrl: 'https://api.keralaluckydraw.com/payment/webhook/ypayment',
    minAmount: 100,
    maxAmount: 50000,
    feeRate: 0,
    feeFixed: 0,
    supportedMethods: ['upi', 'card', 'bank'],
    sortOrder: 4,
    status: 1,
  },
  {
    gatewayName: 'Manual UPI',
    providerCode: 'manual_upi',
    mode: PaymentGatewayMode.Manual,
    apiUrl: '',
    minAmount: 100,
    maxAmount: 500000,
    feeRate: 0,
    feeFixed: 0,
    supportedMethods: ['upi'],
    sortOrder: 10,
    status: 1,
  },
  {
    gatewayName: 'Bank Transfer',
    providerCode: 'bank_transfer',
    mode: PaymentGatewayMode.Manual,
    apiUrl: '',
    minAmount: 500,
    maxAmount: 1000000,
    feeRate: 0,
    feeFixed: 0,
    supportedMethods: ['bank'],
    sortOrder: 11,
    status: 1,
  },
];

export async function seedPaymentGateways(ds: DataSource) {
  const repo = ds.getRepository(PaymentGateway);
  const methodRepo = ds.getRepository(PaymentGatewayMethod);

  let upserted = 0;
  for (const g of gateways) {
    const { supportedMethods, ...rest } = g;
    const payload: Partial<PaymentGateway> = {
      ...rest,
      gatewayType: rest.providerCode,
    };
    const existing = await repo.findOne({
      where: { providerCode: g.providerCode },
    });
    const saved = existing
      ? await repo.save(repo.merge(existing, payload))
      : await repo.save(repo.create(payload));
    await methodRepo.delete({ gatewayId: saved.id });
    if (supportedMethods.length > 0) {
      await methodRepo.save(
        supportedMethods.map((code, i) =>
          methodRepo.create({
            gatewayId: saved.id,
            methodCode: code,
            sortOrder: i,
          }),
        ),
      );
    }
    upserted++;
  }

  console.log(`[PaymentGateway] Upserted: ${upserted} payment gateways`);
}
