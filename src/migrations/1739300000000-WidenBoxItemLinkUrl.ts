import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenBoxItemLinkUrl1739300000000 implements MigrationInterface {
  name = 'WidenBoxItemLinkUrl1739300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `game_box_item` MODIFY `link_url` varchar(1000) NULL',
    );
  }

  public async down(): Promise<void> {
    return;
  }
}
