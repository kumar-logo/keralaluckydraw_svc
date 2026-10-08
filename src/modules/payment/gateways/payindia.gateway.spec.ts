import { BadRequestException, HttpStatus, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { createHmac } from 'crypto';
import {
  PayIndiaGateway,
  PayIndiaEndpoint,
  PayIndiaPaymentStatus,
  PayIndiaResponseStatus,
} from './payindia.gateway';
import { WebhookStatus } from './payment-gateway.interface';
import { User } from '../../../entities/user.entity';
import { RechargeRecord } from '../../../entities/recharge-record.entity';
import { PaymentGateway } from '../../../entities/payment-gateway.entity';
import {
  PaymentGatewayCode,
  PaymentGatewayMode,
  RechargeStatus,
} from '../../../common/enums';

const ORDER_NO = 'RC1790000000000001';
const USER_ID = 'U10001';
const GATEWAY_ID = 11;
const API_URL = 'https://gateway.payindia.test/api';
const WEBHOOK_SECRET = 'test-webhook-secret';
const UTR = '615372849102';
const ABANDON_PREFIX = 'Abandoned after 24h: ';
const REMARK_MAX_LENGTH = 255;

const buildGatewayRow = (
  overrides: Partial<PaymentGateway> = {},
): PaymentGateway =>
  ({
    id: GATEWAY_ID,
    gatewayName: 'PayIndia',
    providerCode: PaymentGatewayCode.PayIndia,
    gatewayType: PaymentGatewayCode.PayIndia,
    mode: PaymentGatewayMode.Auto,
    apiUrl: API_URL,
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    callbackUrl: 'https://api.example.test/payment/webhook/payindia',
    webhookSecret: WEBHOOK_SECRET,
    status: 1,
    ...overrides,
  }) as PaymentGateway;

const buildRecord = (): RechargeRecord =>
  ({
    id: 501,
    orderNo: ORDER_NO,
    userId: USER_ID,
    channelId: GATEWAY_ID,
    amount: '100.00',
    status: RechargeStatus.Pending,
  }) as unknown as RechargeRecord;

interface Harness {
  gateway: PayIndiaGateway;
  rcFindOne: jest.Mock;
  rcUpdate: jest.Mock;
  gatewayFindOne: jest.Mock;
}

const buildHarness = (
  row: PaymentGateway | null = buildGatewayRow(),
  record: RechargeRecord | null = buildRecord(),
): Harness => {
  const rcFindOne = jest.fn().mockResolvedValue(record);
  const rcUpdate = jest.fn().mockResolvedValue({ affected: 1 });
  const gatewayFindOne = jest.fn().mockResolvedValue(row);
  const userFindOne = jest.fn().mockResolvedValue({
    userId: USER_ID,
    nickname: 'Player One',
    phone: '9000000000',
  });
  const gateway = new PayIndiaGateway(
    { findOne: userFindOne } as unknown as Repository<User>,
    {
      findOne: rcFindOne,
      update: rcUpdate,
    } as unknown as Repository<RechargeRecord>,
    { findOne: gatewayFindOne } as unknown as Repository<PaymentGateway>,
  );
  return { gateway, rcFindOne, rcUpdate, gatewayFindOne };
};

let fetchMock: jest.SpiedFunction<typeof fetch>;
let warnSpy: jest.SpiedFunction<Logger['warn']>;

const respond = (httpStatus: number, body: string): void => {
  fetchMock.mockResolvedValueOnce(new Response(body, { status: httpStatus }));
};

const respondJson = (httpStatus: number, body: object): void => {
  respond(httpStatus, JSON.stringify(body));
};

const respondStatus = (data: object): void => {
  respondJson(HttpStatus.OK, { status: PayIndiaResponseStatus.Success, data });
};

const verify = (harness: Harness = buildHarness()) =>
  harness.gateway.verifyPayment(ORDER_NO, USER_ID, PaymentGatewayCode.PayIndia);

beforeEach(() => {
  fetchMock = jest.spyOn(global, 'fetch');
  warnSpy = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('PayIndiaGateway.verifyPayment classification', () => {
  it('returns Success when the gateway reports success with the matching amount', async () => {
    respondStatus({
      order_id: ORDER_NO,
      amount: 100,
      payment_status: PayIndiaPaymentStatus.Success,
      utr: UTR,
    });
    const result = await verify();
    expect(result.status).toBe(WebhookStatus.Success);
    expect(result.amount).toBe(100);
    expect(result.reason).toBe('');
    expect(result.paymentRef).toBe(UTR);
    expect(result.gatewayRef).toBe(
      `${PaymentGatewayCode.PayIndia}_${ORDER_NO}`,
    );
  });

  it('accepts a string amount and an upper-case success status', async () => {
    respondStatus({ amount: '100.00', payment_status: 'SUCCESS', utr: UTR });
    const result = await verify();
    expect(result.status).toBe(WebhookStatus.Success);
  });

  it('accepts an upper-case success envelope', async () => {
    respondJson(HttpStatus.OK, {
      status: 'SUCCESS',
      data: { amount: 100, payment_status: PayIndiaPaymentStatus.Success },
    });
    const result = await verify();
    expect(result.status).toBe(WebhookStatus.Success);
  });

  it('stringifies a numeric utr into the payment reference', async () => {
    respondStatus({
      amount: 100,
      payment_status: PayIndiaPaymentStatus.Success,
      utr: 615372849102,
    });
    const result = await verify();
    expect(result.paymentRef).toBe(UTR);
  });

  it('returns Failed when success is reported with a mismatched amount', async () => {
    respondStatus({
      amount: 50,
      payment_status: PayIndiaPaymentStatus.Success,
    });
    const result = await verify();
    expect(result.status).toBe(WebhookStatus.Failed);
    expect(result.reason).toBe(
      'paymentStatus=success; gatewayAmount=50; expected=100',
    );
  });

  it('returns Failed when success is reported without an amount', async () => {
    respondStatus({ payment_status: PayIndiaPaymentStatus.Success });
    const result = await verify();
    expect(result.status).toBe(WebhookStatus.Failed);
    expect(result.reason).toBe(
      'paymentStatus=success; gatewayAmount=0; expected=100',
    );
  });

  it.each([
    PayIndiaPaymentStatus.Failed,
    PayIndiaPaymentStatus.Failure,
    PayIndiaPaymentStatus.Expired,
    PayIndiaPaymentStatus.Cancelled,
    PayIndiaPaymentStatus.Canceled,
    PayIndiaPaymentStatus.Declined,
    PayIndiaPaymentStatus.Rejected,
  ])('returns Failed for the definitive failure status %s', async (status) => {
    respondStatus({ amount: 100, payment_status: status.toUpperCase() });
    const result = await verify();
    expect(result.status).toBe(WebhookStatus.Failed);
    expect(result.reason).toBe(
      `paymentStatus=${status}; gatewayAmount=100; expected=100`,
    );
  });

  it('returns Pending without a warning for the pending status', async () => {
    respondStatus({
      amount: 100,
      payment_status: PayIndiaPaymentStatus.Pending,
    });
    const result = await verify();
    expect(result.status).toBe(WebhookStatus.Pending);
    expect(result.reason).toBe(
      'paymentStatus=pending; gatewayAmount=100; expected=100',
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns Pending and warns for an unrecognised payment_status', async () => {
    respondStatus({ amount: 100, payment_status: 'processing' });
    const result = await verify();
    expect(result.status).toBe(WebhookStatus.Pending);
    expect(result.reason).toBe(
      'paymentStatus=processing; gatewayAmount=100; expected=100',
    );
    expect(warnSpy).toHaveBeenCalled();
  });

  it.each([
    ['missing', { amount: 100 }],
    ['empty', { amount: 100, payment_status: '' }],
    ['null', { amount: 100, payment_status: null }],
  ])(
    'returns Pending for a %s payment_status',
    async (_label: string, data: object) => {
      respondStatus(data);
      const result = await verify();
      expect(result.status).toBe(WebhookStatus.Pending);
      expect(result.reason).toBe(
        'paymentStatus=unknown; gatewayAmount=100; expected=100',
      );
    },
  );
});

describe('PayIndiaGateway.verifyPayment unconfirmed gateway answers', () => {
  it('returns Pending when check-status answers with a non-success envelope', async () => {
    respondJson(HttpStatus.OK, { status: 'error', error: 'Order not found' });
    const result = await verify();
    expect(result.status).toBe(WebhookStatus.Pending);
    expect(result.amount).toBe(0);
    expect(result.reason).toBe(
      'checkStatus=error; httpStatus=200; detail=Order not found',
    );
    expect(result.paymentRef).toBeUndefined();
  });

  it('returns Pending for a 404 order-expired answer', async () => {
    respondJson(HttpStatus.NOT_FOUND, {
      status: 'failed',
      message: 'Order has expired',
    });
    const result = await verify();
    expect(result.status).toBe(WebhookStatus.Pending);
    expect(result.reason).toBe(
      'checkStatus=failed; httpStatus=404; detail=Order has expired',
    );
  });

  it('returns Pending for a boolean false status envelope', async () => {
    respondJson(HttpStatus.BAD_REQUEST, { status: false, message: 'Invalid' });
    const result = await verify();
    expect(result.status).toBe(WebhookStatus.Pending);
    expect(result.reason).toBe(
      'checkStatus=false; httpStatus=400; detail=Invalid',
    );
  });

  it('returns Pending for an error-only envelope without a status field', async () => {
    respondJson(HttpStatus.NOT_FOUND, { error: 'Order not found' });
    const result = await verify();
    expect(result.status).toBe(WebhookStatus.Pending);
    expect(result.reason).toBe(
      'checkStatus=unknown; httpStatus=404; detail=Order not found',
    );
  });

  it('keeps the reason short enough for the remark column after the abandon prefix', async () => {
    respondJson(HttpStatus.OK, {
      status: 'e'.repeat(300),
      error: 'x'.repeat(1000),
    });
    const result = await verify();
    expect(result.status).toBe(WebhookStatus.Pending);
    expect(`${ABANDON_PREFIX}${result.reason}`.length).toBeLessThanOrEqual(
      REMARK_MAX_LENGTH,
    );
  });
});

describe('PayIndiaGateway.verifyPayment transport, config and auth failures throw', () => {
  it('throws when the network request fails', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(verify()).rejects.toThrow('Payment gateway unavailable');
  });

  it('throws when the request times out', async () => {
    fetchMock.mockRejectedValueOnce(
      new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError',
      ),
    );
    await expect(verify()).rejects.toThrow('Payment gateway unavailable');
  });

  it('throws on a non-JSON body', async () => {
    respond(HttpStatus.OK, '<html>Bad Gateway</html>');
    await expect(verify()).rejects.toThrow(
      'Payment gateway returned an invalid response',
    );
  });

  it('throws on a JSON body that is not an object', async () => {
    respond(HttpStatus.OK, 'null');
    await expect(verify()).rejects.toThrow(
      'Payment gateway returned an invalid response',
    );
  });

  it('throws on a JSON body without the PayIndia envelope', async () => {
    respondJson(HttpStatus.NOT_FOUND, { message: 'Route not found' });
    await expect(verify()).rejects.toThrow(
      'Payment gateway returned an invalid response',
    );
  });

  it('throws when a success envelope carries no data', async () => {
    respondJson(HttpStatus.OK, { status: PayIndiaResponseStatus.Success });
    await expect(verify()).rejects.toThrow(
      'PayIndia status response missing data',
    );
  });

  it.each([HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN])(
    'throws on HTTP %d',
    async (httpStatus: HttpStatus) => {
      respondJson(httpStatus, { status: 'error', error: 'Invalid API key' });
      await expect(verify()).rejects.toThrow(
        'Payment gateway authentication failed',
      );
    },
  );

  it.each([
    HttpStatus.REQUEST_TIMEOUT,
    HttpStatus.TOO_MANY_REQUESTS,
    HttpStatus.INTERNAL_SERVER_ERROR,
    HttpStatus.BAD_GATEWAY,
    HttpStatus.SERVICE_UNAVAILABLE,
  ])('throws on HTTP %d', async (httpStatus: HttpStatus) => {
    respondJson(httpStatus, { status: 'error', error: 'Try again later' });
    await expect(verify()).rejects.toThrow('Payment gateway unavailable');
  });

  it('throws when the gateway row does not exist', async () => {
    await expect(verify(buildHarness(null))).rejects.toThrow(
      'PayIndia gateway not configured',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when the gateway credentials are incomplete', async () => {
    await expect(
      verify(buildHarness(buildGatewayRow({ apiSecret: null }))),
    ).rejects.toThrow('PayIndia API secret not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when the provider code is missing', async () => {
    const harness = buildHarness();
    await expect(
      harness.gateway.verifyPayment(ORDER_NO, USER_ID, undefined),
    ).rejects.toThrow('PayIndia provider code missing');
  });

  it('throws when the order does not belong to the caller', async () => {
    const harness = buildHarness();
    await expect(
      harness.gateway.verifyPayment(
        ORDER_NO,
        'U99999',
        PaymentGatewayCode.PayIndia,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('PayIndiaGateway.verifyPayment request shape', () => {
  it('posts check-status with credentials, a timeout signal and an any-status gateway lookup', async () => {
    const harness = buildHarness(buildGatewayRow({ status: 0 }));
    respondStatus({
      amount: 100,
      payment_status: PayIndiaPaymentStatus.Pending,
    });
    const result = await verify(harness);
    expect(result.status).toBe(WebhookStatus.Pending);
    expect(harness.gatewayFindOne).toHaveBeenCalledWith({
      where: { providerCode: PaymentGatewayCode.PayIndia },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/${PayIndiaEndpoint.CheckStatus}`);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({
      'Content-Type': 'application/json',
      'X-API-Key': 'test-api-key',
      'X-API-Secret': 'test-api-secret',
    });
    expect(init?.body).toBe(JSON.stringify({ order_id: ORDER_NO }));
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('PayIndiaGateway.verifyWebhook', () => {
  const body = {
    event: 'payment.success',
    order_id: ORDER_NO,
    amount: 100,
    utr: UTR,
    status: PayIndiaPaymentStatus.Success,
  };
  const rawBody = Buffer.from(JSON.stringify(body), 'utf8');
  const signature = createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  it('verifies a correctly signed webhook against check-status', async () => {
    const harness = buildHarness();
    respondStatus({
      amount: 100,
      payment_status: PayIndiaPaymentStatus.Success,
      utr: UTR,
    });
    const result = await harness.gateway.verifyWebhook({
      body,
      signature,
      rawBody,
    });
    expect(result.status).toBe(WebhookStatus.Success);
    expect(harness.gatewayFindOne).toHaveBeenCalledWith({
      where: { id: GATEWAY_ID },
    });
  });

  it('rejects a webhook with a wrong signature without calling the gateway', async () => {
    const harness = buildHarness();
    await expect(
      harness.gateway.verifyWebhook({
        body,
        signature: 'f'.repeat(64),
        rawBody,
      }),
    ).rejects.toThrow('Invalid signature');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('PayIndiaGateway.createOrder', () => {
  it('creates the order against an active gateway and stores the pay url', async () => {
    const harness = buildHarness();
    respondJson(HttpStatus.CREATED, {
      status: PayIndiaResponseStatus.Success,
      data: { payment_url: 'https://gateway.payindia.test/pay/token' },
    });
    const order = await harness.gateway.createOrder(
      ORDER_NO,
      100,
      USER_ID,
      PaymentGatewayCode.PayIndia,
    );
    expect(order.payUrl).toBe('https://gateway.payindia.test/pay/token');
    expect(harness.gatewayFindOne).toHaveBeenCalledWith({
      where: { providerCode: PaymentGatewayCode.PayIndia, status: 1 },
    });
    expect(harness.rcUpdate).toHaveBeenCalledWith(
      { orderNo: ORDER_NO },
      { payUrl: 'https://gateway.payindia.test/pay/token' },
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/${PayIndiaEndpoint.CreateOrder}`);
    expect(JSON.parse(String(init?.body))).toEqual({
      amount: '100.00',
      order_id: ORDER_NO,
      customer_name: 'Player One',
      callback_url: 'https://api.example.test/payment/return/payindia',
      is_reusable: false,
      customer_mobile: '9000000000',
    });
  });

  it('surfaces the gateway error message when create-order is rejected', async () => {
    respondJson(HttpStatus.BAD_REQUEST, {
      status: 'error',
      error: 'Duplicate order_id',
    });
    await expect(
      buildHarness().gateway.createOrder(
        ORDER_NO,
        100,
        USER_ID,
        PaymentGatewayCode.PayIndia,
      ),
    ).rejects.toThrow('Duplicate order_id');
  });

  it('throws on HTTP 401 from create-order', async () => {
    respondJson(HttpStatus.UNAUTHORIZED, { status: 'error', error: 'Bad key' });
    await expect(
      buildHarness().gateway.createOrder(
        ORDER_NO,
        100,
        USER_ID,
        PaymentGatewayCode.PayIndia,
      ),
    ).rejects.toThrow('Payment gateway authentication failed');
  });
});
