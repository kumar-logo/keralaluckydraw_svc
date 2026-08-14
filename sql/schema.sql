-- Kerala Lucky Draw Lottery Platform - MySQL Database Schema
-- Compatible with XAMPP MySQL / MariaDB

CREATE DATABASE IF NOT EXISTS keralaluckydraw
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE keralaluckydraw;

-- ============================================================
-- SYSTEM / CONFIG TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS system_config (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  config_key  VARCHAR(100) NOT NULL UNIQUE,
  config_val  TEXT,
  description VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- USER TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       VARCHAR(32) NOT NULL UNIQUE,
  phone         VARCHAR(20) UNIQUE,
  nickname      VARCHAR(50),
  avatar        VARCHAR(500) DEFAULT '/images/avatar/default.webp',
  password_hash VARCHAR(255),
  balance       DECIMAL(16,2) DEFAULT 0.00,
  bonus_balance DECIMAL(16,2) DEFAULT 0.00,
  is_recharge   TINYINT(1) DEFAULT 0,
  vip_level     TINYINT UNSIGNED DEFAULT 0,
  invite_code   VARCHAR(20) UNIQUE,
  invited_by    VARCHAR(20),
  tg_id         VARCHAR(100),
  google_id     VARCHAR(100),
  channel_id    VARCHAR(50) DEFAULT 'keralaluckydraw',
  visitor_id    VARCHAR(64),
  status        TINYINT DEFAULT 1 COMMENT '1=active, 0=disabled',
  app_award     DECIMAL(16,2) DEFAULT 0.00,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_invite_code (invite_code),
  INDEX idx_invited_by (invited_by),
  INDEX idx_tg_id (tg_id),
  INDEX idx_google_id (google_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_sessions (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    VARCHAR(32) NOT NULL,
  token      VARCHAR(500) NOT NULL,
  device     VARCHAR(50),
  ip_address VARCHAR(45),
  expired_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_token (token(191))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS avatar_list (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  avatar_url VARCHAR(500) NOT NULL,
  sort_order INT DEFAULT 0,
  status     TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sms_codes (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  phone      VARCHAR(20) NOT NULL,
  code       VARCHAR(10) NOT NULL,
  type       VARCHAR(20) DEFAULT 'login',
  expired_at TIMESTAMP NOT NULL,
  used       TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_phone_code (phone, code)
) ENGINE=InnoDB;

-- ============================================================
-- FINANCE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS bank_cards (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     VARCHAR(32) NOT NULL,
  card_name   VARCHAR(100),
  card_number VARCHAR(50),
  ifsc_code   VARCHAR(20),
  upi_address VARCHAR(100),
  user_email  VARCHAR(100),
  is_default  TINYINT(1) DEFAULT 0,
  status      TINYINT DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pay_channels (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  channel_name  VARCHAR(100) NOT NULL,
  channel_code  VARCHAR(50) NOT NULL,
  channel_type  VARCHAR(20),
  min_amount    DECIMAL(16,2) DEFAULT 0,
  max_amount    DECIMAL(16,2) DEFAULT 999999,
  fee_rate      DECIMAL(5,4) DEFAULT 0,
  gateway_url   VARCHAR(500),
  gateway_key   VARCHAR(500),
  gateway_secret VARCHAR(500),
  sort_order    INT DEFAULT 0,
  status        TINYINT DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS recharge_records (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_no      VARCHAR(64) NOT NULL UNIQUE,
  user_id       VARCHAR(32) NOT NULL,
  channel_id    INT UNSIGNED,
  amount        DECIMAL(16,2) NOT NULL,
  actual_amount DECIMAL(16,2),
  status        TINYINT DEFAULT 0 COMMENT '0=pending, 1=success, 2=failed',
  pay_url       VARCHAR(1000),
  callback_data TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_order_no (order_no),
  INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS withdrawal_records (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_no      VARCHAR(64) NOT NULL UNIQUE,
  user_id       VARCHAR(32) NOT NULL,
  bankcard_id   BIGINT UNSIGNED,
  amount        DECIMAL(16,2) NOT NULL,
  fee           DECIMAL(16,2) DEFAULT 0,
  actual_amount DECIMAL(16,2),
  status        TINYINT DEFAULT 0 COMMENT '0=pending, 1=approved, 2=rejected, 3=completed',
  remark        VARCHAR(500),
  admin_id      INT UNSIGNED,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transfer_records (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    VARCHAR(32) NOT NULL,
  amount     DECIMAL(16,2) NOT NULL,
  direction  VARCHAR(20) NOT NULL COMMENT 'bonus_to_main, main_to_bonus',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     VARCHAR(32) NOT NULL,
  source_type VARCHAR(30) NOT NULL COMMENT 'recharge, withdraw, bet, win, bonus, rebate, commission, transfer',
  amount      DECIMAL(16,2) NOT NULL,
  balance     DECIMAL(16,2),
  ref_id      VARCHAR(64),
  description VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_source_type (source_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transaction_types (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type_code VARCHAR(30) NOT NULL UNIQUE,
  type_name VARCHAR(50) NOT NULL,
  category  VARCHAR(20)
) ENGINE=InnoDB;

-- ============================================================
-- VIP / REBATE / WAGE
-- ============================================================

CREATE TABLE IF NOT EXISTS vip_levels (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  level           TINYINT UNSIGNED NOT NULL UNIQUE,
  level_name      VARCHAR(50),
  recharge_amount DECIMAL(16,2) DEFAULT 0,
  bet_amount      DECIMAL(16,2) DEFAULT 0,
  award_amount    DECIMAL(16,2) DEFAULT 0,
  rebate_rate     DECIMAL(5,4) DEFAULT 0,
  icon_url        VARCHAR(500),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vip_awards (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    VARCHAR(32) NOT NULL,
  vip_level  TINYINT UNSIGNED NOT NULL,
  amount     DECIMAL(16,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_level (user_id, vip_level)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rebate_records (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    VARCHAR(32) NOT NULL,
  bet_amount DECIMAL(16,2) DEFAULT 0,
  rebate_amt DECIMAL(16,2) DEFAULT 0,
  rate       DECIMAL(5,4) DEFAULT 0,
  status     TINYINT DEFAULT 0 COMMENT '0=pending, 1=claimed',
  period     VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS wage_records (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      VARCHAR(32) NOT NULL,
  week_key     VARCHAR(20) NOT NULL,
  cond_amount  DECIMAL(16,2) DEFAULT 0,
  rc_amount    DECIMAL(16,2) DEFAULT 0,
  wage_amount  DECIMAL(16,2) DEFAULT 0,
  is_claim     TINYINT(1) DEFAULT 0,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_week (user_id, week_key)
) ENGINE=InnoDB;

-- ============================================================
-- GAME CONFIG TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS game_categories (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(50) NOT NULL,
  category_code VARCHAR(30) NOT NULL UNIQUE,
  icon_url      VARCHAR(500),
  sort_order    INT DEFAULT 0,
  status        TINYINT DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS game_list (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_name     VARCHAR(100) NOT NULL,
  game_code     VARCHAR(50) NOT NULL UNIQUE,
  game_type     VARCHAR(30) NOT NULL COMMENT 'race, dice, color, digit, kerala, punjab, dubai, p4b, box, wheel, cashrain',
  category_id   INT UNSIGNED,
  provider      VARCHAR(50) DEFAULT 'TK',
  icon_url      VARCHAR(500),
  banner_url    VARCHAR(500),
  draw_interval INT UNSIGNED DEFAULT 60 COMMENT 'seconds between draws',
  selling_price DECIMAL(16,2) DEFAULT 10,
  min_bet       DECIMAL(16,2) DEFAULT 10,
  max_bet       DECIMAL(16,2) DEFAULT 100000,
  is_hot        TINYINT(1) DEFAULT 0,
  sort_order    INT DEFAULT 0,
  status        TINYINT DEFAULT 1,
  config_json   JSON,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_game_type (game_type),
  INDEX idx_category_id (category_id)
) ENGINE=InnoDB;

-- ============================================================
-- GAME ROUNDS / DRAWS
-- ============================================================

CREATE TABLE IF NOT EXISTS game_rounds (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_id       INT UNSIGNED NOT NULL,
  round_no      VARCHAR(30) NOT NULL,
  game_type     VARCHAR(30) NOT NULL,
  status        TINYINT DEFAULT 0 COMMENT '0=betting, 1=drawing, 2=settled, 3=cancelled',
  draw_time     TIMESTAMP,
  result        JSON COMMENT 'game-specific result data',
  total_bet     DECIMAL(16,2) DEFAULT 0,
  total_payout  DECIMAL(16,2) DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settled_at    TIMESTAMP NULL,
  UNIQUE KEY uk_game_round (game_id, round_no),
  INDEX idx_game_type (game_type),
  INDEX idx_status (status),
  INDEX idx_draw_time (draw_time)
) ENGINE=InnoDB;

-- ============================================================
-- ORDERS / BETS
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_no      VARCHAR(64) NOT NULL UNIQUE,
  user_id       VARCHAR(32) NOT NULL,
  game_id       INT UNSIGNED NOT NULL,
  game_type     VARCHAR(30) NOT NULL,
  round_no      VARCHAR(30) NOT NULL,
  bet_type      VARCHAR(30),
  bet_content   JSON NOT NULL COMMENT 'selected numbers/options',
  amount        DECIMAL(16,2) NOT NULL,
  quantity      INT DEFAULT 1,
  total_amount  DECIMAL(16,2) NOT NULL,
  odds          DECIMAL(10,2) DEFAULT 1,
  win_amount    DECIMAL(16,2) DEFAULT 0,
  is_bonus      TINYINT(1) DEFAULT 0,
  status        TINYINT DEFAULT 0 COMMENT '0=pending, 1=won, 2=lost, 3=cancelled, 4=refunded',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settled_at    TIMESTAMP NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_game_round (game_id, round_no),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- ============================================================
-- RACE GAME SPECIFIC
-- ============================================================

CREATE TABLE IF NOT EXISTS race_runner_frames (
  id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_id   INT UNSIGNED NOT NULL,
  round_no  VARCHAR(30) NOT NULL,
  frames    JSON NOT NULL COMMENT 'runner position frames array',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_game_round (game_id, round_no)
) ENGINE=InnoDB;

-- ============================================================
-- KERALA / PUNJAB LOTTERY SPECIFIC
-- ============================================================

CREATE TABLE IF NOT EXISTS lottery_draw_details (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_id    INT UNSIGNED NOT NULL,
  round_no   VARCHAR(30) NOT NULL,
  prize_tier VARCHAR(30),
  prize_name VARCHAR(100),
  prize_amt  DECIMAL(16,2),
  numbers    JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_game_round (game_id, round_no)
) ENGINE=InnoDB;

-- ============================================================
-- MYSTERY BOX
-- ============================================================

CREATE TABLE IF NOT EXISTS box_games (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_name  VARCHAR(100),
  price      DECIMAL(16,2) NOT NULL,
  icon_url   VARCHAR(500),
  sort_order INT DEFAULT 0,
  status     TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS box_items (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  box_id     INT UNSIGNED NOT NULL,
  item_name  VARCHAR(100) NOT NULL,
  prize      DECIMAL(16,2) NOT NULL,
  rate       DECIMAL(8,6) NOT NULL COMMENT 'win probability 0-1',
  image_url  VARCHAR(500),
  link_url   VARCHAR(500),
  sort_order INT DEFAULT 0,
  INDEX idx_box_id (box_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS box_draw_history (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    VARCHAR(32) NOT NULL,
  box_id     INT UNSIGNED NOT NULL,
  item_id    INT UNSIGNED NOT NULL,
  prize      DECIMAL(16,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- ============================================================
-- LUCKY WHEEL
-- ============================================================

CREATE TABLE IF NOT EXISTS wheel_config (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_name   VARCHAR(100),
  segments    JSON NOT NULL COMMENT '[{label, prize, rate, color}]',
  free_spins  INT DEFAULT 1,
  spin_price  DECIMAL(16,2) DEFAULT 10,
  status      TINYINT DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS wheel_draw_history (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     VARCHAR(32) NOT NULL,
  wheel_id    INT UNSIGNED NOT NULL,
  segment_idx INT NOT NULL,
  prize       DECIMAL(16,2),
  is_free     TINYINT(1) DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- ============================================================
-- CASH RAIN / BONUS RAIN
-- ============================================================

CREATE TABLE IF NOT EXISTS cashrain_config (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_name   VARCHAR(100),
  start_time  TIME,
  end_time    TIME,
  min_prize   DECIMAL(16,2) DEFAULT 1,
  max_prize   DECIMAL(16,2) DEFAULT 100,
  duration    INT DEFAULT 30 COMMENT 'seconds',
  status      TINYINT DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cashrain_records (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    VARCHAR(32) NOT NULL,
  game_id    INT UNSIGNED NOT NULL,
  round_no   VARCHAR(30),
  prize      DECIMAL(16,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- ============================================================
-- OPERATIONS / CMS
-- ============================================================

CREATE TABLE IF NOT EXISTS banners (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200),
  image_url   VARCHAR(500) NOT NULL,
  link_url    VARCHAR(500),
  position    VARCHAR(30) DEFAULT 'home',
  sort_order  INT DEFAULT 0,
  start_time  TIMESTAMP NULL,
  end_time    TIMESTAMP NULL,
  status      TINYINT DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS popups (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200),
  content     TEXT,
  image_url   VARCHAR(500),
  link_url    VARCHAR(500),
  popup_type  VARCHAR(30) DEFAULT 'home',
  frequency   VARCHAR(20) DEFAULT 'once' COMMENT 'once, daily, always',
  sort_order  INT DEFAULT 0,
  start_time  TIMESTAMP NULL,
  end_time    TIMESTAMP NULL,
  status      TINYINT DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS announcements (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  content    TEXT NOT NULL,
  link_url   VARCHAR(500),
  sort_order INT DEFAULT 0,
  start_time TIMESTAMP NULL,
  end_time   TIMESTAMP NULL,
  status     TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS share_configs (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200),
  description TEXT,
  image_url   VARCHAR(500),
  link_url    VARCHAR(500),
  game_type   VARCHAR(30),
  status      TINYINT DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cdkey_codes (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cd_key      VARCHAR(50) NOT NULL UNIQUE,
  award_type  VARCHAR(30) DEFAULT 'balance',
  award_amount DECIMAL(16,2) NOT NULL,
  max_uses    INT DEFAULT 1,
  used_count  INT DEFAULT 0,
  expired_at  TIMESTAMP NULL,
  status      TINYINT DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cd_key (cd_key)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cdkey_usage (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cdkey_id   BIGINT UNSIGNED NOT NULL,
  user_id    VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_cdkey_user (cdkey_id, user_id)
) ENGINE=InnoDB;

-- ============================================================
-- ACTIVITIES / CHECK-IN
-- ============================================================

CREATE TABLE IF NOT EXISTS activities (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  activity_name VARCHAR(100) NOT NULL,
  activity_type VARCHAR(30) NOT NULL,
  description   TEXT,
  image_url     VARCHAR(500),
  config_json   JSON,
  start_time    TIMESTAMP NULL,
  end_time      TIMESTAMP NULL,
  sort_order    INT DEFAULT 0,
  status        TINYINT DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS checkin_config (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  day_num    TINYINT NOT NULL,
  award_type VARCHAR(20) DEFAULT 'chip',
  award_num  DECIMAL(16,2) NOT NULL,
  status     TINYINT DEFAULT 1,
  UNIQUE KEY uk_day (day_num)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS checkin_records (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    VARCHAR(32) NOT NULL,
  day_num    TINYINT NOT NULL,
  time_key   VARCHAR(20) NOT NULL,
  act_key    VARCHAR(50),
  award_num  DECIMAL(16,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_day_time (user_id, day_num, time_key),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS activity_done (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     VARCHAR(32) NOT NULL,
  activity_id INT UNSIGNED NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_activity (user_id, activity_id)
) ENGINE=InnoDB;

-- ============================================================
-- RANKING
-- ============================================================

CREATE TABLE IF NOT EXISTS rank_config (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rank_id    INT NOT NULL UNIQUE,
  rank_name  VARCHAR(100),
  rank_type  VARCHAR(30) COMMENT 'bet, recharge, win',
  period     VARCHAR(20) COMMENT 'daily, weekly, monthly',
  prizes     JSON COMMENT '[{rank, amount}]',
  status     TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rank_records (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rank_id    INT NOT NULL,
  round_no   VARCHAR(30) NOT NULL,
  user_id    VARCHAR(32) NOT NULL,
  score      DECIMAL(16,2) DEFAULT 0,
  rank_pos   INT,
  prize      DECIMAL(16,2) DEFAULT 0,
  is_claimed TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rank_round (rank_id, round_no),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- ============================================================
-- AGENT / REFERRAL
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_levels (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  level           TINYINT UNSIGNED NOT NULL UNIQUE,
  level_name      VARCHAR(50),
  commission_rate DECIMAL(5,4) DEFAULT 0,
  min_subordinates INT DEFAULT 0,
  min_recharge     DECIMAL(16,2) DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS agent_commissions (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     VARCHAR(32) NOT NULL,
  from_user   VARCHAR(32) NOT NULL,
  source_type VARCHAR(30) COMMENT 'bet, recharge',
  amount      DECIMAL(16,2) NOT NULL,
  commission  DECIMAL(16,2) NOT NULL,
  level_depth TINYINT DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_from_user (from_user)
) ENGINE=InnoDB;

-- ============================================================
-- MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    VARCHAR(32) NOT NULL,
  title      VARCHAR(200),
  content    TEXT,
  msg_type   VARCHAR(20) DEFAULT 'system',
  is_read    TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read)
) ENGINE=InnoDB;

-- ============================================================
-- THIRD-PARTY GAME PROVIDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS game_providers (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider_code VARCHAR(50) NOT NULL UNIQUE,
  provider_name VARCHAR(100) NOT NULL,
  api_url       VARCHAR(500),
  api_key       VARCHAR(500),
  api_secret    VARCHAR(500),
  icon_url      VARCHAR(500),
  sort_order    INT DEFAULT 0,
  status        TINYINT DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS casino_games (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_code     VARCHAR(100) NOT NULL UNIQUE,
  game_name     VARCHAR(200) NOT NULL,
  provider_id   INT UNSIGNED,
  category_id   INT UNSIGNED,
  image_url     VARCHAR(500),
  is_hot        TINYINT(1) DEFAULT 0,
  sort_order    INT DEFAULT 0,
  status        TINYINT DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_provider (provider_id),
  INDEX idx_category (category_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_favorites (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    VARCHAR(32) NOT NULL,
  game_code  VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_game (user_id, game_code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_recent_games (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    VARCHAR(32) NOT NULL,
  game_code  VARCHAR(100) NOT NULL,
  played_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_game (user_id, game_code),
  INDEX idx_user_played (user_id, played_at)
) ENGINE=InnoDB;

-- ============================================================
-- RECHARGE AWARDS / DEPOSIT BONUSES
-- ============================================================

CREATE TABLE IF NOT EXISTS recharge_awards (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  award_name  VARCHAR(100),
  award_type  VARCHAR(30) COMMENT 'first, percent, fixed',
  min_amount  DECIMAL(16,2) DEFAULT 0,
  max_amount  DECIMAL(16,2) DEFAULT 999999,
  bonus_rate  DECIMAL(5,4) DEFAULT 0,
  bonus_fixed DECIMAL(16,2) DEFAULT 0,
  max_bonus   DECIMAL(16,2) DEFAULT 999999,
  sort_order  INT DEFAULT 0,
  status      TINYINT DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- ADMIN TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100),
  role          VARCHAR(30) DEFAULT 'admin',
  permissions   JSON,
  last_login    TIMESTAMP NULL,
  status        TINYINT DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_logs (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id   INT UNSIGNED NOT NULL,
  action     VARCHAR(100) NOT NULL,
  target     VARCHAR(100),
  detail     TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_id (admin_id),
  INDEX idx_action (action)
) ENGINE=InnoDB;

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO transaction_types (type_code, type_name, category) VALUES
  ('recharge', 'Recharge', 'income'),
  ('withdraw', 'Withdraw', 'expense'),
  ('bet', 'Bet', 'expense'),
  ('win', 'Win', 'income'),
  ('bonus', 'Bonus', 'income'),
  ('rebate', 'Rebate', 'income'),
  ('commission', 'Commission', 'income'),
  ('transfer', 'Transfer', 'transfer'),
  ('adjustment', 'Adjustment', 'admin'),
  ('award', 'Award', 'income')
ON DUPLICATE KEY UPDATE type_name = VALUES(type_name);

INSERT INTO game_categories (category_name, category_code, sort_order) VALUES
  ('Lobby', 'lobby', 1),
  ('Casino', 'casino', 2),
  ('Slot', 'slot', 3),
  ('Lottery', 'lottery', 4),
  ('Fishing', 'fishing', 5),
  ('Live', 'live', 6)
ON DUPLICATE KEY UPDATE category_name = VALUES(category_name);

INSERT INTO checkin_config (day_num, award_type, award_num) VALUES
  (1, 'chip', 5), (2, 'chip', 10), (3, 'chip', 15),
  (4, 'chip', 20), (5, 'chip', 25), (6, 'chip', 30),
  (7, 'k3c', 50)
ON DUPLICATE KEY UPDATE award_num = VALUES(award_num);

INSERT INTO vip_levels (level, level_name, recharge_amount, bet_amount, award_amount, rebate_rate) VALUES
  (0, 'VIP 0', 0, 0, 0, 0.0000),
  (1, 'VIP 1', 1000, 5000, 50, 0.0020),
  (2, 'VIP 2', 5000, 25000, 200, 0.0040),
  (3, 'VIP 3', 20000, 100000, 800, 0.0060),
  (4, 'VIP 4', 50000, 250000, 2000, 0.0080),
  (5, 'VIP 5', 100000, 500000, 5000, 0.0100),
  (6, 'VIP 6', 300000, 1500000, 15000, 0.0120),
  (7, 'VIP 7', 500000, 3000000, 30000, 0.0150),
  (8, 'VIP 8', 1000000, 6000000, 60000, 0.0180),
  (9, 'VIP 9', 2000000, 12000000, 120000, 0.0200),
  (10, 'VIP 10', 5000000, 30000000, 300000, 0.0250)
ON DUPLICATE KEY UPDATE level_name = VALUES(level_name);

INSERT INTO agent_levels (level, level_name, commission_rate, min_subordinates, min_recharge) VALUES
  (1, 'Agent Lv1', 0.0100, 0, 0),
  (2, 'Agent Lv2', 0.0150, 10, 10000),
  (3, 'Agent Lv3', 0.0200, 50, 50000)
ON DUPLICATE KEY UPDATE commission_rate = VALUES(commission_rate);

INSERT INTO admin_users (username, password_hash, display_name, role) VALUES
  ('admin', '$2a$10$rOzQqb7BEdKxjz6E8VxFOOHPdJmKPOBBiF5NfY6hZpHczTQvOxM9i', 'Super Admin', 'superadmin')
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);
-- Default admin password: admin123 (bcrypt hash above)

INSERT INTO game_list (game_name, game_code, game_type, category_id, draw_interval, selling_price, config_json) VALUES
  ('Run & Guess Basic', 'race_basic_6', 'race', 4, 30, 10, '{"runnerCount": 6}'),
  ('Run & Guess', 'race_standard_12', 'race', 4, 30, 10, '{"runnerCount": 12}'),
  ('K3 1min', 'k3_1min', 'dice', 4, 60, 10, '{"duration": 60}'),
  ('K3 3min', 'k3_3min', 'dice', 4, 180, 10, '{"duration": 180}'),
  ('K3 5min', 'k3_5min', 'dice', 4, 300, 10, '{"duration": 300}'),
  ('K3 10min', 'k3_10min', 'dice', 4, 600, 10, '{"duration": 600}'),
  ('WinGo 1min', 'wingo_1min', 'color', 4, 60, 10, '{"duration": 60}'),
  ('WinGo 3min', 'wingo_3min', 'color', 4, 180, 10, '{"duration": 180}'),
  ('WinGo 5min', 'wingo_5min', 'color', 4, 300, 10, '{"duration": 300}'),
  ('WinGo 10min', 'wingo_10min', 'color', 4, 600, 10, '{"duration": 600}'),
  ('3 Digit Normal', 'digit_normal', 'digit', 4, 0, 10, '{"mode": "normal"}'),
  ('3 Digit Quick', 'digit_quick', 'digit', 4, 300, 10, '{"mode": "quick"}'),
  ('Kerala Win Win', 'kerala_winwin', 'kerala', 4, 0, 30, '{"subType": "WinWin"}'),
  ('Kerala Nirmal', 'kerala_nirmal', 'kerala', 4, 0, 30, '{"subType": "Nirmal"}'),
  ('Punjab Dear 10', 'punjab_dear10', 'punjab', 4, 0, 6, '{"subType": "Dear10"}'),
  ('Dubai Lottery', 'dubai_main', 'dubai', 4, 300, 10, '{}'),
  ('4D Lottery', 'p4b_4d', 'p4b', 4, 300, 10, '{"digits": 4}'),
  ('5D Lottery', 'p4b_5d', 'p4b', 4, 300, 10, '{"digits": 5}'),
  ('State Lottery Original', 'state_original', 'kerala', 4, 0, 50, '{"variant": "original"}'),
  ('State Lottery Quick', 'state_quick', 'kerala', 4, 60, 50, '{"variant": "quick"}')
ON DUPLICATE KEY UPDATE game_name = VALUES(game_name);
