import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('game_list')
export class GameList {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'game_name', type: 'varchar', length: 100 })
  gameName: string;

  @Column({ name: 'game_code', type: 'varchar', length: 50, unique: true })
  gameCode: string;

  @Column({ name: 'game_uid', type: 'varchar', length: 191, nullable: true })
  gameUid: string | null;

  @Index()
  @Column({ name: 'game_type', type: 'varchar', length: 30 })
  gameType: string;

  @Index()
  @Column({ name: 'category_id', type: 'int', unsigned: true, nullable: true })
  categoryId: number | null;

  @Column({ type: 'varchar', length: 10, default: 'TK' })
  source: string;

  @Column({ type: 'varchar', length: 50, default: 'TK' })
  provider: string;

  @Column({ name: 'icon_url', type: 'varchar', length: 500, nullable: true })
  iconUrl: string;

  @Column({ name: 'banner_url', type: 'varchar', length: 500, nullable: true })
  bannerUrl: string;

  @Column({
    name: 'thumbnail_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  thumbnailUrl: string;

  @Column({ name: 'draw_interval', type: 'int', unsigned: true, default: 60 })
  drawInterval: number;

  @Column({
    name: 'selling_price',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 10,
  })
  sellingPrice: number;

  @Column({
    name: 'min_bet',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 10,
  })
  minBet: number;

  @Column({
    name: 'max_bet',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 100000,
  })
  maxBet: number;

  @Column({ name: 'is_hot', type: 'tinyint', default: 0 })
  isHot: number;

  @Index()
  @Column({ name: 'is_lottery', type: 'tinyint', default: 0 })
  isLottery: number;

  @Index()
  @Column({ name: 'is_third_party', type: 'tinyint', default: 0 })
  isThirdParty: number;

  @Column({ name: 'group_name', type: 'varchar', length: 100, nullable: true })
  groupName: string | null;

  @Column({
    name: 'lottery_type',
    type: 'varchar',
    length: 20,
    default: 'auto',
  })
  lotteryType: string;

  @Column({ name: 'theme_color', type: 'varchar', length: 20, nullable: true })
  themeColor: string | null;

  @Column({ name: 'bg_color', type: 'varchar', length: 20, nullable: true })
  bgColor: string | null;

  @Column({ name: 'text_color', type: 'varchar', length: 20, nullable: true })
  textColor: string | null;

  @Column({ name: 'border_color', type: 'varchar', length: 20, nullable: true })
  borderColor: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  emoji: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'tinyint', default: 1 })
  status: number;

  @Column({ name: 'is_hidden', type: 'tinyint', default: 0 })
  isHidden: number;

  @Column({ name: 'is_paused', type: 'tinyint', default: 0 })
  isPaused: number;

  @Column({ name: 'emergency_stop', type: 'tinyint', default: 0 })
  emergencyStop: number;

  @Column({ name: 'stop_bet_before_sec', type: 'int', default: 10 })
  stopBetBeforeSec: number;

  @Column({ name: 'draw_delay_sec', type: 'int', default: 5 })
  drawDelaySec: number;

  @Column({ name: 'auto_generate', type: 'tinyint', default: 1 })
  autoGenerate: number;

  @Column({ name: 'scheduled_draw_time', type: 'timestamp', nullable: true })
  scheduledDrawTime: Date | null;

  @Column({ name: 'start_date', type: 'timestamp', nullable: true })
  startDate: Date | null;

  @Column({ name: 'max_prize', type: 'varchar', length: 50, nullable: true })
  maxPrize: string | null;

  @Column({ name: 'digit_count', type: 'int', nullable: true })
  digitCount: number;

  @Column({ name: 'number_min', type: 'int', nullable: true })
  numberMin: number;

  @Column({ name: 'number_max', type: 'int', nullable: true })
  numberMax: number;

  @Column({ name: 'quick_cycle_sec', type: 'int', nullable: true })
  quickCycleSec: number;

  @Column({ name: 'is_quick', type: 'tinyint', default: 0 })
  isQuick: number;

  @Column({ name: 'fived_big_small_threshold', type: 'int', default: 23 })
  fivedBigSmallThreshold: number;

  @Column({ name: 'img_id', type: 'varchar', length: 64, nullable: true })
  imgId: string;

  @Column({
    name: 'lobby_icon_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  lobbyIconUrl: string;

  @Column({
    name: 'pay_rate',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  payRate: number;

  @Column({
    name: 'result_mode',
    type: 'varchar',
    length: 20,
    default: 'random',
  })
  resultMode: string;

  @Column({
    name: 'result_house_edge_target',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  resultHouseEdgeTarget: number;

  @Column({ name: 'result_hold_for_approval', type: 'tinyint', default: 0 })
  resultHoldForApproval: number;

  @Column({ name: 'result_avoid_big_prize', type: 'tinyint', default: 0 })
  resultAvoidBigPrize: number;

  @Column({ name: 'result_avoid_zero_order', type: 'tinyint', default: 0 })
  resultAvoidZeroOrder: number;

  @Column({ name: 'created_by', type: 'varchar', length: 30, nullable: true })
  createdBy: string;

  @Column({ name: 'updated_by', type: 'varchar', length: 30, nullable: true })
  updatedBy: string;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
