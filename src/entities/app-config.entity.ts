import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('app_config')
export class AppConfig {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'app_name', type: 'varchar', length: 100, default: '' })
  appName: string;

  @Column({ name: 'site_url', type: 'varchar', length: 255, default: '' })
  siteUrl: string;

  @Column({ type: 'varchar', length: 10, default: '₹' })
  currency: string;

  @Column({
    name: 'referral_prefix',
    type: 'varchar',
    length: 16,
    default: 'AXN',
  })
  referralPrefix: string;

  @Column({ name: 'marquee_text', type: 'varchar', length: 1000, default: '' })
  marqueeText: string;

  @Column({ name: 'tg_link', type: 'varchar', length: 255, default: '' })
  tgLink: string;

  @Column({ name: 'wa_link', type: 'varchar', length: 255, default: '' })
  waLink: string;

  @Column({ name: 'x_link', type: 'varchar', length: 255, default: '' })
  xLink: string;

  @Column({ name: 'facebook_link', type: 'varchar', length: 255, default: '' })
  facebookLink: string;

  @Column({ name: 'instagram_link', type: 'varchar', length: 255, default: '' })
  instagramLink: string;

  @Column({ name: 'support_chat_enabled', type: 'tinyint', default: 1 })
  supportChatEnabled: number;

  @Column({
    name: 'support_chat_provider',
    type: 'varchar',
    length: 50,
    default: '',
  })
  supportChatProvider: string;

  @Column({
    name: 'support_chat_license',
    type: 'varchar',
    length: 100,
    default: '',
  })
  supportChatLicense: string;

  @Column({
    name: 'support_telegram_url',
    type: 'varchar',
    length: 255,
    default: '',
  })
  supportTelegramUrl: string;

  @Column({ name: 'support_whatsapp_enabled', type: 'tinyint', default: 0 })
  supportWhatsappEnabled: number;

  @Column({
    name: 'support_whatsapp_url',
    type: 'varchar',
    length: 500,
    default: '',
  })
  supportWhatsappUrl: string;

  @Column({
    name: 'sports_game_code',
    type: 'varchar',
    length: 50,
    default: '',
  })
  sportsGameCode: string;

  @Column({ name: 'scheduler_tick_ms', type: 'int', default: 1000 })
  schedulerTickMs: number;

  @Column({ name: 'gameinfo_cache_ttl_ms', type: 'int', default: 1000 })
  gameinfoCacheTtlMs: number;

  @Column({ name: 'round_cooldown_ms', type: 'int', default: 3000 })
  roundCooldownMs: number;

  @Column({
    name: 'result_mode_default',
    type: 'varchar',
    length: 20,
    default: 'max_profit',
  })
  resultModeDefault: string;

  @Column({
    name: 'result_house_edge_default',
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0.15,
  })
  resultHouseEdgeDefault: number;

  @Column({ name: 'result_sample_size', type: 'int', default: 2000 })
  resultSampleSize: number;

  @Column({ name: 'result_decision_budget_ms', type: 'int', default: 250 })
  resultDecisionBudgetMs: number;

  @Column({
    name: 'odds_missing_policy',
    type: 'varchar',
    length: 20,
    default: 'use_stored',
  })
  oddsMissingPolicy: string;

  @Column({
    name: 'bigwin_min_amount',
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 1000,
  })
  bigwinMinAmount: number;

  @Column({
    name: 'bigwin_template',
    type: 'varchar',
    length: 255,
    default: '',
  })
  bigwinTemplate: string;

  @Column({
    name: 'active_payment_gateway',
    type: 'varchar',
    length: 50,
    default: 'manual',
  })
  activePaymentGateway: string;

  @Column({
    name: 'manual_pay_url',
    type: 'varchar',
    length: 255,
    default: '/pay',
  })
  manualPayUrl: string;

  @Column({ name: 'otp_enabled', type: 'tinyint', default: 0 })
  otpEnabled: number;

  @Column({ name: 'otp_length', type: 'int', default: 6 })
  otpLength: number;

  @Column({ name: 'otp_ttl_seconds', type: 'int', default: 300 })
  otpTtlSeconds: number;

  @Column({ name: 'otp_resend_cooldown_sec', type: 'int', default: 60 })
  otpResendCooldownSec: number;

  @Column({ name: 'otp_max_attempts', type: 'int', default: 5 })
  otpMaxAttempts: number;

  @Column({ name: 'sms_enabled', type: 'tinyint', default: 0 })
  smsEnabled: number;

  @Column({ name: 'sms_endpoint', type: 'varchar', length: 255, default: '' })
  smsEndpoint: string;

  @Column({ name: 'sms_api_key', type: 'varchar', length: 255, default: '' })
  smsApiKey: string;

  @Column({ name: 'sms_sender_id', type: 'varchar', length: 50, default: '' })
  smsSenderId: string;

  @Column({ name: 'sms_route', type: 'varchar', length: 20, default: '' })
  smsRoute: string;

  @Column({ name: 'sms_template_id', type: 'varchar', length: 50, default: '' })
  smsTemplateId: string;

  @Column({ name: 'whatsapp_enabled', type: 'tinyint', default: 0 })
  whatsappEnabled: number;

  @Column({
    name: 'whatsapp_endpoint',
    type: 'varchar',
    length: 255,
    default: '',
  })
  whatsappEndpoint: string;

  @Column({ name: 'whatsapp_token', type: 'varchar', length: 255, default: '' })
  whatsappToken: string;

  @Column({
    name: 'whatsapp_template_name',
    type: 'varchar',
    length: 100,
    default: '',
  })
  whatsappTemplateName: string;

  @Column({
    name: 'whatsapp_lang_code',
    type: 'varchar',
    length: 10,
    default: 'en',
  })
  whatsappLangCode: string;

  @Column({
    name: 'google_client_id',
    type: 'varchar',
    length: 255,
    default: '',
  })
  googleClientId: string;

  @Column({
    name: 'telegram_bot_token',
    type: 'varchar',
    length: 255,
    default: '',
  })
  telegramBotToken: string;

  @Column({ name: 'social_login_enabled', type: 'tinyint', default: 0 })
  socialLoginEnabled: number;

  @Column({ name: 'vip_enabled', type: 'tinyint', default: 1 })
  vipEnabled: number;

  @Column({ name: 'recharge_bonus_enabled', type: 'tinyint', default: 1 })
  rechargeBonusEnabled: number;

  @Column({
    name: 'login_bg_light_url',
    type: 'varchar',
    length: 255,
    default: '',
  })
  loginBgLightUrl: string;

  @Column({
    name: 'login_bg_dark_url',
    type: 'varchar',
    length: 255,
    default: '',
  })
  loginBgDarkUrl: string;

  @Column({ name: 'group_chat_enabled', type: 'tinyint', default: 0 })
  groupChatEnabled: number;

  @Column({ name: 'group_chat_block_links', type: 'tinyint', default: 1 })
  groupChatBlockLinks: number;

  @Column({ name: 'group_chat_bad_words', type: 'text', nullable: true })
  groupChatBadWords: string | null;

  @Column({ name: 'group_chat_image_enabled', type: 'tinyint', default: 1 })
  groupChatImageEnabled: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
