import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageNotifications1740980000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `messages` MODIFY `user_id` VARCHAR(32) NULL',
    );
    await queryRunner.query(
      'CREATE TABLE IF NOT EXISTS `message_read` (' +
        '`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,' +
        '`message_id` BIGINT UNSIGNED NOT NULL,' +
        '`user_id` VARCHAR(32) NOT NULL,' +
        '`read_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,' +
        'PRIMARY KEY (`id`),' +
        'UNIQUE KEY `uk_message_user` (`message_id`,`user_id`),' +
        'KEY `idx_message_read_user` (`user_id`)' +
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `message_read`');
    await queryRunner.query(
      'ALTER TABLE `messages` MODIFY `user_id` VARCHAR(32) NOT NULL',
    );
  }
}
