import { MigrationInterface, QueryRunner } from 'typeorm';

export class UiConfigKeys1735776000000 implements MigrationInterface {
  name = 'UiConfigKeys1735776000000';

  private readonly keys: {
    key: string;
    val: string;
    type: string;
    label: string;
    sort: number;
  }[] = [
    {
      key: 'ui_state_names',
      val: JSON.stringify([
        'Kerala',
        'Tamil',
        'MadhyaPradesh',
        'Maharashtra',
        'Karnataka',
        'Nagaland',
      ]),
      type: 'json',
      label: 'Race State Names',
      sort: 1,
    },
    {
      key: 'ui_state_colors',
      val: JSON.stringify([
        '#00B92B',
        '#D80000',
        '#F5D000',
        '#DB7500',
        '#B800D0',
        '#0012D4',
      ]),
      type: 'json',
      label: 'Race State Colours',
      sort: 2,
    },
    {
      key: 'ui_position_colors',
      val: JSON.stringify(['#D50000', '#0087D4', '#BD6600', '#008B59']),
      type: 'json',
      label: 'Lottery Position Colours',
      sort: 3,
    },
    {
      key: 'ui_position_gradients',
      val: JSON.stringify([
        ['#D50000', '#FF4E16'],
        ['#0087D4', '#00A2FF'],
        ['#BD6600', '#F58A27'],
        ['#008B59', '#008C59'],
      ]),
      type: 'json',
      label: 'Lottery Position Gradients',
      sort: 4,
    },
    {
      key: 'ui_default_pay_rate',
      val: JSON.stringify([
        { odds: 1.85, type: 4 },
        { odds: 5.4, type: 1 },
        { odds: 17, type: 5 },
      ]),
      type: 'json',
      label: 'Race Default Pay Rate',
      sort: 5,
    },
    {
      key: 'ui_mystery_box_gradients',
      val: JSON.stringify([
        'linear-gradient(180deg, #FFB889 0%, #C34F02 100%)',
        'linear-gradient(180deg, #C4DBFF 0%, #5386D8 100%)',
        'linear-gradient(180deg, #E5BFF1 0%, #A356BB 100%)',
        'linear-gradient(180deg, #BFE7A7 0%, #599A31 100%)',
        'linear-gradient(180deg, #F6DB9B 0%, #CAA03C 100%)',
        'linear-gradient(180deg, #FBCFB4 0%, #C26930 100%)',
        'linear-gradient(180deg, #E9EDB6 0%, #9EA810 100%)',
        'linear-gradient(180deg, #F9C0C0 0%, #C13B3B 100%)',
      ]),
      type: 'json',
      label: 'Mystery Box Gradients',
      sort: 6,
    },
    {
      key: 'ui_sprite_scale',
      val: '0.75',
      type: 'number',
      label: 'Home Sprite Scale',
      sort: 7,
    },
    {
      key: 'ui_result_tabs',
      val: JSON.stringify([
        { key: 'kerala', label: 'Kerala' },
        { key: 'dubai', label: 'Dubai' },
        { key: '3digit', label: '3Digits' },
        { key: '45d', label: '4D & 5D' },
        { key: 'color', label: 'WinGo' },
        { key: 'dice', label: 'K3' },
      ]),
      type: 'json',
      label: 'Result Page Tabs',
      sort: 8,
    },
    {
      key: 'ui_game_categories',
      val: JSON.stringify({
        lottery: 1,
        casino: 5,
        slot: 6,
        lobby: 1020,
        live: 1025,
        fishing: 1026,
      }),
      type: 'json',
      label: 'Home Game Category IDs',
      sort: 9,
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = this.keys
      .map(
        (c) =>
          `('${c.key}', '${c.val.replace(/'/g, "\\'")}', 'User SPA UI config', 'ui', '${c.type}', '${c.label}', ${c.sort})`,
      )
      .join(',\n');
    await queryRunner.query(`
      INSERT IGNORE INTO \`system_config\`
        (\`config_key\`, \`config_val\`, \`description\`, \`config_group\`, \`config_type\`, \`display_label\`, \`sort_order\`)
      VALUES ${rows}
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const list = this.keys.map((c) => `'${c.key}'`).join(', ');
    await queryRunner.query(
      `DELETE FROM \`system_config\` WHERE \`config_key\` IN (${list})`,
    );
  }
}
