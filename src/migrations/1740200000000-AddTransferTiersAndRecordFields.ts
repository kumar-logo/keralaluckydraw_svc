import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransferTiersAndRecordFields1740200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tierTable = await queryRunner.getTable('transfer_tier');
    if (!tierTable) {
      await queryRunner.query(
        'CREATE TABLE `transfer_tier` (' +
          '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT, ' +
          '`min_amount` DECIMAL(16,2) NOT NULL, ' +
          '`max_amount` DECIMAL(16,2) NOT NULL, ' +
          '`pct` DECIMAL(6,4) NOT NULL DEFAULT 0, ' +
          '`sort_order` INT NOT NULL DEFAULT 0, ' +
          'PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
      );
      const count = await queryRunner.query(
        'SELECT COUNT(*) AS c FROM `transfer_tier`',
      );
      if (Number(count?.[0]?.c || 0) === 0) {
        await queryRunner.query(
          'INSERT INTO `transfer_tier` (`min_amount`,`max_amount`,`pct`,`sort_order`) VALUES ' +
            '(300, 999, 0.0100, 0), ' +
            '(1000, 4999, 0.0300, 1), ' +
            '(5000, 50000, 0.0500, 2)',
        );
      }
    }

    const recTable = await queryRunner.getTable('transfer_records');
    if (recTable) {
      if (!recTable.findColumnByName('give_amount')) {
        await queryRunner.query(
          'ALTER TABLE `transfer_records` ADD COLUMN `give_amount` DECIMAL(16,2) NOT NULL DEFAULT 0',
        );
      }
      if (!recTable.findColumnByName('status')) {
        await queryRunner.query(
          'ALTER TABLE `transfer_records` ADD COLUMN `status` INT NOT NULL DEFAULT 1',
        );
      }
      if (!recTable.findColumnByName('order_no')) {
        await queryRunner.query(
          'ALTER TABLE `transfer_records` ADD COLUMN `order_no` VARCHAR(64) NULL',
        );
      }
      if (!recTable.findColumnByName('balance_after')) {
        await queryRunner.query(
          'ALTER TABLE `transfer_records` ADD COLUMN `balance_after` DECIMAL(16,2) NULL',
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const recTable = await queryRunner.getTable('transfer_records');
    if (recTable) {
      for (const col of [
        'give_amount',
        'status',
        'order_no',
        'balance_after',
      ]) {
        if (recTable.findColumnByName(col)) {
          await queryRunner.query(
            `ALTER TABLE \`transfer_records\` DROP COLUMN \`${col}\``,
          );
        }
      }
    }
    const tierTable = await queryRunner.getTable('transfer_tier');
    if (tierTable) {
      await queryRunner.query('DROP TABLE `transfer_tier`');
    }
  }
}
