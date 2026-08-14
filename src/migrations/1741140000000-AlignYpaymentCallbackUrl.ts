import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignYpaymentCallbackUrl1741140000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE payment_gateways
          SET callback_url = CONCAT(
                'https://',
                SUBSTRING_INDEX(SUBSTRING_INDEX(callback_url, '/', 3), '//', -1),
                '/payment/webhook/ypayment'
              )
        WHERE gateway_type = 'ypayment'
          AND callback_url IS NOT NULL
          AND callback_url <> ''
          AND callback_url NOT LIKE '%/payment/webhook/ypayment'`,
    );
  }

  public async down(): Promise<void> {
    return;
  }
}
