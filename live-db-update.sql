-- =============================================================================
-- live-db-update.sql
-- =============================================================================
-- PURPOSE : Apply ALL recent DB changes to the LIVE production database.
--           Translates the seven 1741xxx migrations + the DynamicRoles RBAC
--           migration into portable, idempotent MariaDB 10.4 SQL.
-- DATE    : 2026-06-28
-- TARGET  : MariaDB 10.4 (XAMPP) / MySQL-compatible.
-- HOW TO  : Run MANUALLY via phpMyAdmin (Import / SQL tab) or CLI on the live
--           server. Do NOT use `migration:run` for this file.
--             CLI: mysql -u <user> -p <live_db_name> < live-db-update.sql
--
-- RUN ORDER (sections are ordered; each is guarded so re-running is safe):
--   1. AddBoxConfigIconUrl          (game_box_config.icon_url)
--   2. AddRechargePaymentRefUnique  (UNIQUE index on recharge_records.payment_ref)
--   3. FinanceDisplayColumnsNotNull (7 finance display cols -> NOT NULL DEFAULT '')
--   4. DropUnusedTables             (drop 8 obsolete tables)
--   5. CreateCronJobs               (cron_jobs table + 5 seed rows)
--   6. AddAdminUserAvatar           (admin_users.avatar)
--   7. RBAC / DynamicRoles          (roles, permissions, role_permissions + seed)
--   8. Record migrations            (so a future migration:run won't re-apply)
--
-- IDEMPOTENT: safe to run multiple times. Verified by double-apply on a fresh
--             scratch DB loaded from the live schema.
--
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!  MANUAL PRE-STEP  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- SECTION 2 adds a UNIQUE index on recharge_records.payment_ref. If the live
-- table already contains DUPLICATE payment_ref values, the index creation WILL
-- FAIL. Before running this file, run the dedup pre-check in Section 2 and
-- RESOLVE any duplicates first (de-duplicate or NULL-out the offending rows).
-- The rest of the file is independent of Section 2 -- if you cannot dedup
-- immediately you may comment out Section 2 and run it later.
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- =============================================================================


-- =============================================================================
-- SECTION 1 : AddBoxConfigIconUrl1741000000000
--   game_box_config.icon_url VARCHAR(500) NULL AFTER cover_img_id
--   MariaDB 10.4 supports ADD COLUMN IF NOT EXISTS -> use the clean form.
-- =============================================================================
ALTER TABLE `game_box_config`
  ADD COLUMN IF NOT EXISTS `icon_url` VARCHAR(500) NULL AFTER `cover_img_id`;


-- =============================================================================
-- SECTION 2 : AddRechargePaymentRefUnique1741010000000
--   UNIQUE INDEX UQ_recharge_records_payment_ref ON recharge_records(payment_ref)
--
--   >>> MANUAL PRE-CHECK (run this FIRST; must return ZERO rows) <<<
--   If this SELECT returns ANY rows, the index below will FAIL. Resolve the
--   duplicate payment_ref values before continuing.
--
--     SELECT payment_ref, COUNT(*) AS dup_count
--       FROM recharge_records
--      WHERE payment_ref IS NOT NULL AND payment_ref <> ''
--      GROUP BY payment_ref
--     HAVING COUNT(*) > 1;
--
--   The index is added only if it does not already exist (information_schema
--   guard) so re-running is safe.
-- =============================================================================

-- Guard: add the unique index only if it is not already present.
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'recharge_records'
     AND INDEX_NAME   = 'UQ_recharge_records_payment_ref'
);
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE `recharge_records` ADD UNIQUE INDEX `UQ_recharge_records_payment_ref` (`payment_ref`)',
  'DO 0');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- =============================================================================
-- SECTION 3 : FinanceDisplayColumnsNotNull1741020000000
--   For each of 7 display columns: backfill NULLs to '' then MODIFY to
--   NOT NULL DEFAULT ''. Each step guarded by a column-exists check so a
--   missing column is skipped (not errored).
--   Columns / types (exact from migration):
--     vip_levels.icon_url        VARCHAR(500)
--     vip_levels.level_color     VARCHAR(20)
--     payment_gateways.icon_url  VARCHAR(500)
--     payment_gateways.qr_image_url VARCHAR(500)
--     recharge_records.remark    VARCHAR(255)
--     withdrawal_records.remark  VARCHAR(500)
--     transfer_records.order_no  VARCHAR(64)
-- =============================================================================

-- ---- vip_levels.icon_url ----------------------------------------------------
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema=DATABASE() AND table_name='vip_levels' AND column_name='icon_url');
SET @ddl := IF(@c>0, "UPDATE vip_levels SET icon_url='' WHERE icon_url IS NULL", 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl := IF(@c>0, "ALTER TABLE vip_levels MODIFY COLUMN icon_url VARCHAR(500) NOT NULL DEFAULT ''", 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ---- vip_levels.level_color -------------------------------------------------
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema=DATABASE() AND table_name='vip_levels' AND column_name='level_color');
SET @ddl := IF(@c>0, "UPDATE vip_levels SET level_color='' WHERE level_color IS NULL", 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl := IF(@c>0, "ALTER TABLE vip_levels MODIFY COLUMN level_color VARCHAR(20) NOT NULL DEFAULT ''", 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ---- payment_gateways.icon_url ----------------------------------------------
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema=DATABASE() AND table_name='payment_gateways' AND column_name='icon_url');
SET @ddl := IF(@c>0, "UPDATE payment_gateways SET icon_url='' WHERE icon_url IS NULL", 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl := IF(@c>0, "ALTER TABLE payment_gateways MODIFY COLUMN icon_url VARCHAR(500) NOT NULL DEFAULT ''", 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ---- payment_gateways.qr_image_url ------------------------------------------
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema=DATABASE() AND table_name='payment_gateways' AND column_name='qr_image_url');
SET @ddl := IF(@c>0, "UPDATE payment_gateways SET qr_image_url='' WHERE qr_image_url IS NULL", 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl := IF(@c>0, "ALTER TABLE payment_gateways MODIFY COLUMN qr_image_url VARCHAR(500) NOT NULL DEFAULT ''", 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ---- recharge_records.remark ------------------------------------------------
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema=DATABASE() AND table_name='recharge_records' AND column_name='remark');
SET @ddl := IF(@c>0, "UPDATE recharge_records SET remark='' WHERE remark IS NULL", 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl := IF(@c>0, "ALTER TABLE recharge_records MODIFY COLUMN remark VARCHAR(255) NOT NULL DEFAULT ''", 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ---- withdrawal_records.remark ----------------------------------------------
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema=DATABASE() AND table_name='withdrawal_records' AND column_name='remark');
SET @ddl := IF(@c>0, "UPDATE withdrawal_records SET remark='' WHERE remark IS NULL", 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl := IF(@c>0, "ALTER TABLE withdrawal_records MODIFY COLUMN remark VARCHAR(500) NOT NULL DEFAULT ''", 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ---- transfer_records.order_no ----------------------------------------------
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema=DATABASE() AND table_name='transfer_records' AND column_name='order_no');
SET @ddl := IF(@c>0, "UPDATE transfer_records SET order_no='' WHERE order_no IS NULL", 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl := IF(@c>0, "ALTER TABLE transfer_records MODIFY COLUMN order_no VARCHAR(64) NOT NULL DEFAULT ''", 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;


-- =============================================================================
-- SECTION 4 : DropUnusedTables1741030000000
--   Drop 8 obsolete tables (IF EXISTS -> safe).
-- =============================================================================
DROP TABLE IF EXISTS `activity_done`;
DROP TABLE IF EXISTS `box_draw_history`;
DROP TABLE IF EXISTS `user_recent_games`;
DROP TABLE IF EXISTS `user_sessions`;
DROP TABLE IF EXISTS `status_enums`;
DROP TABLE IF EXISTS `bak_kerala_orders`;
DROP TABLE IF EXISTS `bak_kerala_rounds`;
DROP TABLE IF EXISTS `bak_kerala_ldd`;





-- =============================================================================
-- SECTION 6 : AddAdminUserAvatar1741050000000
--   admin_users.avatar VARCHAR(500) NULL (IF NOT EXISTS -> safe).
-- =============================================================================
ALTER TABLE `admin_users`
  ADD COLUMN IF NOT EXISTS `avatar` VARCHAR(500) NULL;


-- =============================================================================
-- SECTION 7 : RBAC -- DynamicRoles1736100000000
--   Create roles / permissions / role_permissions, then seed.
--   role_permissions grants are PORTABLE: they JOIN on roles.name and
--   permissions.code (NOT on auto-increment ids, which differ on live).
-- =============================================================================

CREATE TABLE IF NOT EXISTS `roles` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `level` int NOT NULL DEFAULT 0,
  `description` varchar(255) NULL,
  `is_system` tinyint NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `permissions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `group_name` varchar(50) NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_permission_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `role_id` int unsigned NOT NULL,
  `permission_id` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_permission` (`role_id`, `permission_id`),
  KEY `idx_roleperm_role` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Seed permissions (10 codes) --------------------------------------------
INSERT INTO `permissions` (`code`, `name`, `group_name`, `sort_order`) VALUES
  ('dashboard', 'Dashboard',         'core',     1),
  ('users',     'Users',             'core',     2),
  ('games',     'Games',             'gameplay', 3),
  ('lottery',   'Lottery',           'gameplay', 4),
  ('orders',    'Orders',            'gameplay', 5),
  ('finance',   'Finance',           'finance',  6),
  ('content',   'Content',           'content',  7),
  ('reports',   'Reports',           'reports',  8),
  ('system',    'System Settings',   'system',   9),
  ('earn',      'Earn / Rewards',    'gameplay', 10)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`), `group_name` = VALUES(`group_name`), `sort_order` = VALUES(`sort_order`);

-- ---- Seed roles (4 roles) ---------------------------------------------------
INSERT INTO `roles` (`name`, `display_name`, `level`, `description`, `is_system`) VALUES
  ('super_admin', 'Super Admin', 100, 'Full system access',                    1),
  ('admin',       'Admin',        80, 'Manage games, finance, and content',    1),
  ('operator',    'Operator',     60, 'Handle daily operations',               1),
  ('viewer',      'Viewer',       20, 'View-only access to reports',           1)
ON DUPLICATE KEY UPDATE
  `display_name` = VALUES(`display_name`), `level` = VALUES(`level`),
  `description` = VALUES(`description`), `is_system` = VALUES(`is_system`);

-- ---- Grant role_permissions (PORTABLE: join on name/code, not ids) ----------
-- super_admin -> ALL permissions (no code filter)
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
  FROM `roles` r
  JOIN `permissions` p ON r.name = 'super_admin'
ON DUPLICATE KEY UPDATE `permission_id` = VALUES(`permission_id`);

-- admin -> dashboard, users, games, lottery, orders, finance, content, reports, earn
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
  FROM `roles` r
  JOIN `permissions` p
    ON r.name = 'admin'
   AND p.code IN ('dashboard','users','games','lottery','orders','finance','content','reports','earn')
ON DUPLICATE KEY UPDATE `permission_id` = VALUES(`permission_id`);

-- operator -> dashboard, orders, games, lottery, reports
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
  FROM `roles` r
  JOIN `permissions` p
    ON r.name = 'operator'
   AND p.code IN ('dashboard','orders','games','lottery','reports')
ON DUPLICATE KEY UPDATE `permission_id` = VALUES(`permission_id`);

-- viewer -> dashboard, reports
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
  FROM `roles` r
  JOIN `permissions` p
    ON r.name = 'viewer'
   AND p.code IN ('dashboard','reports')
ON DUPLICATE KEY UPDATE `permission_id` = VALUES(`permission_id`);


-- =============================================================================
-- SECTION 8 : Record migrations as applied
--   So a future `migration:run` on live will NOT re-apply these. Each insert
--   is guarded by a NOT EXISTS check on the migration name -> safe re-run.
--   (migrations table: timestamp BIGINT, name VARCHAR.)
-- =============================================================================
INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1736100000000, 'DynamicRoles1736100000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'DynamicRoles1736100000000');

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741000000000, 'AddBoxConfigIconUrl1741000000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddBoxConfigIconUrl1741000000000');

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741010000000, 'AddRechargePaymentRefUnique1741010000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddRechargePaymentRefUnique1741010000000');

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741020000000, 'FinanceDisplayColumnsNotNull1741020000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'FinanceDisplayColumnsNotNull1741020000000');

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741030000000, 'DropUnusedTables1741030000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'DropUnusedTables1741030000000');

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741040000000, 'CreateCronJobs1741040000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'CreateCronJobs1741040000000');

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741050000000, 'AddAdminUserAvatar1741050000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddAdminUserAvatar1741050000000');

-- =============================================================================
-- SECTION 9 — payment_gateways.require_proof (per-gateway proof toggle)
-- Migration 1741060000000-AddPaymentGatewayRequireProof
-- =============================================================================
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payment_gateways'
    AND COLUMN_NAME = 'require_proof');
SET @sql := IF(@col = 0,
  'ALTER TABLE `payment_gateways` ADD COLUMN `require_proof` TINYINT(1) NOT NULL DEFAULT 1',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =============================================================================
-- SECTION 10 — Widen uk_rollup_slice to include price + win_price
-- Migration 1741070000000-WidenRollupUniqueKey
-- FIXES: "Duplicate entry '...' for key 'uk_rollup_slice'" on profit-loss report.
-- Safe: the old 6-column uniqueness implies 8-column uniqueness (superset),
-- so existing rows never conflict when the wider index is built.
-- =============================================================================
SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'lottery_sales_rollup'
    AND INDEX_NAME = 'uk_rollup_slice');
SET @sql := IF(@idx > 0,
  'ALTER TABLE `lottery_sales_rollup` DROP INDEX `uk_rollup_slice`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
ALTER TABLE `lottery_sales_rollup`
  ADD UNIQUE INDEX `uk_rollup_slice`
  (`game_id`, `draw_date`, `slot_time`, `slot`, `position`, `number`, `price`, `win_price`);

-- =============================================================================
-- SECTION 11 — Seed rollup-refresh cron job (admin-editable maintenance job)
-- Migration 1741080000000-SeedRollupRefreshCron
-- =============================================================================
INSERT INTO `cron_jobs` (`name`, `cron_expression`, `enabled`) VALUES
  ('rollup-refresh', '0 */5 * * * *', 1)
  ON DUPLICATE KEY UPDATE `name` = `name`;

-- Migration bookkeeping for sections 9-11
INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741060000000, 'AddPaymentGatewayRequireProof1741060000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddPaymentGatewayRequireProof1741060000000');

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741070000000, 'WidenRollupUniqueKey1741070000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'WidenRollupUniqueKey1741070000000');

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741080000000, 'SeedRollupRefreshCron1741080000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'SeedRollupRefreshCron1741080000000');

-- =============================================================================
-- SECTION 12 — cashrain_window.max_claims_per_user (Cash Rain money-leak fix)
-- Migration 1741090000000-AddCashrainWindowMaxClaims
-- Per-user / per-window claim cap (default 1). The CODE fix (window-gated round
-- creation + claim cap) ships with the backend redeploy; this column backs the
-- admin-editable cap. Until deployed, STOP the Cash Rain game in admin to halt the leak.
-- =============================================================================
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'cashrain_window'
    AND COLUMN_NAME = 'max_claims_per_user');
SET @sql := IF(@col = 0,
  'ALTER TABLE `cashrain_window` ADD COLUMN `max_claims_per_user` SMALLINT NOT NULL DEFAULT 1',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741090000000, 'AddCashrainWindowMaxClaims1741090000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddCashrainWindowMaxClaims1741090000000');

-- =============================================================================
-- SECTION 13 — app_config.recharge_bonus_enabled (admin show/hide for the
-- home "Recharge Bonus Max" first-recharge promo). Default 1 = shown.
-- Migration 1741100000000-AddRechargeBonusEnabled
-- =============================================================================
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'app_config'
    AND COLUMN_NAME = 'recharge_bonus_enabled');
SET @sql := IF(@col = 0,
  'ALTER TABLE `app_config` ADD COLUMN `recharge_bonus_enabled` TINYINT NOT NULL DEFAULT 1 AFTER `vip_enabled`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741100000000, 'AddRechargeBonusEnabled1741100000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddRechargeBonusEnabled1741100000000');

-- =============================================================================
-- SECTION 14 — ui_status_map: transfer status label (admin Transfer Records tab)
-- Migration 1741110000000-SeedTransferStatusMap. Makes status 1 render as
-- "Success" (green) instead of a raw integer.
-- =============================================================================
INSERT INTO `ui_status_map` (`domain`, `status`, `status_text`, `color`)
  SELECT * FROM (
    SELECT 'transfer' AS domain, 1 AS status, 'Success' AS status_text, 'green' AS color
  ) AS seed
  WHERE NOT EXISTS (
    SELECT 1 FROM `ui_status_map` WHERE `domain` = 'transfer' AND `status` = 1
  );

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741110000000, 'SeedTransferStatusMap1741110000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'SeedTransferStatusMap1741110000000');

-- =============================================================================
-- SECTION 15 — payment_gateways.additional_verification (per-gateway manual
-- approve/reject hold for AUTO gateways). When 1, a successful gateway callback
-- does NOT auto-credit: the recharge is held Pending for an admin approve/reject
-- in Deposit History (approve credits + marks Success; reject marks Failed, no
-- credit). When 0, auto-credit on callback is unchanged. Default 0.
-- Migration 1741120000000-AddPaymentGatewayAdditionalVerification
-- =============================================================================
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payment_gateways'
    AND COLUMN_NAME = 'additional_verification');
SET @sql := IF(@col = 0,
  'ALTER TABLE `payment_gateways` ADD COLUMN `additional_verification` TINYINT(1) NOT NULL DEFAULT 0 AFTER `require_proof`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741120000000, 'AddPaymentGatewayAdditionalVerification1741120000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddPaymentGatewayAdditionalVerification1741120000000');

-- =============================================================================
-- SECTION 16 — lottery_sales_rollup.round_no + re-widen uk_rollup_slice to
-- include it (so the Manual-Lottery report download is scoped to the exact
-- draw/round, not every date). This RE-WIDENS the index from Section 10's
-- 8 columns to 9 (adds round_no). Drop + re-add is safe: existing rows carry
-- round_no='' and were already unique on the 8-col key.
-- Migration 1741130000000-AddRollupRoundNo
-- =============================================================================
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'lottery_sales_rollup'
    AND COLUMN_NAME = 'round_no');
SET @sql := IF(@col = 0,
  "ALTER TABLE `lottery_sales_rollup` ADD COLUMN `round_no` VARCHAR(30) NOT NULL DEFAULT '' AFTER `slot_time`",
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'lottery_sales_rollup'
    AND INDEX_NAME = 'uk_rollup_slice');
SET @sql := IF(@idx > 0,
  'ALTER TABLE `lottery_sales_rollup` DROP INDEX `uk_rollup_slice`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
ALTER TABLE `lottery_sales_rollup`
  ADD UNIQUE INDEX `uk_rollup_slice`
  (`game_id`, `draw_date`, `slot_time`, `round_no`, `slot`, `position`, `number`, `price`, `win_price`);

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741130000000, 'AddRollupRoundNo1741130000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddRollupRoundNo1741130000000');

-- =============================================================================
-- SECTION 17 — Align ypayment-protocol callback_url to the BACKEND server-to-
-- server webhook route (POST /payment/webhook/ypayment). Previously the
-- ypayment gateway's callback_url pointed at the SPA (e.g. .../recharge/return),
-- so the gateway's pushed SUCCESS callback had no backend route to land on and
-- recharges stayed Pending unless the user returned (or the reconcile cron
-- polled). This swaps the PATH to /payment/webhook/ypayment while PRESERVING
-- the configured host.
-- Migration 1741140000000-AlignYpaymentCallbackUrl
--
-- >>> MANUAL CHECK AFTER RUNNING <<<
-- Confirm every ypayment-protocol row's callback_url host is the BACKEND API
-- host (e.g. api.keralaluckydraw.com), NOT the SPA host. If a row's host is the SPA,
-- fix it manually, e.g.:
--   UPDATE payment_gateways
--      SET callback_url = 'https://api.keralaluckydraw.com/payment/webhook/ypayment'
--    WHERE gateway_type = 'ypayment' AND provider_code = 'ypayment';
-- Also set this same webhook URL as the notify/callback URL on the ypayment
-- merchant dashboard so the gateway POSTs there.
-- IDEMPOTENT: the NOT LIKE guard means re-running changes nothing.
-- =============================================================================
UPDATE `payment_gateways`
   SET `callback_url` = CONCAT(
         'https://',
         SUBSTRING_INDEX(SUBSTRING_INDEX(`callback_url`, '/', 3), '//', -1),
         '/payment/webhook/ypayment'
       )
 WHERE `gateway_type` = 'ypayment'
   AND `callback_url` IS NOT NULL
   AND `callback_url` <> ''
   AND `callback_url` NOT LIKE '%/payment/webhook/ypayment';

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741140000000, 'AlignYpaymentCallbackUrl1741140000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AlignYpaymentCallbackUrl1741140000000');

-- =============================================================================
-- SECTION 18 — Lottery report money-path fix (quantity-aware rollup).
-- No schema change. The rollup INSERT in LotteryReportService now derives
-- sales_qty = SUM(o.quantity) and draw_qty = SUM(winning o.quantity) instead of
-- COUNT(*) / COUNT(status=1). This makes the Profit & Loss report's Sale Cost
-- (= sales_qty * price) and Draw Cost (= draw_qty * win_price) reconcile with
-- the Number-Wise report and with real money (SUM(total_amount) / SUM(win_amount))
-- whenever an order's quantity > 1.
--
-- Any existing lottery_sales_rollup rows were computed with the OLD COUNT logic
-- and are therefore stale. Report generation self-heals the scope it reads
-- (getProfitLoss rebuilds the filtered round/date slice first), and the 5-minute
-- RollupRefresh cron rebuilds the last 2 days. To correct ALL historical slices
-- immediately after deploy, clear the rollup once; it is rebuilt on demand:
--   TRUNCATE TABLE `lottery_sales_rollup`;
-- (Safe: the table is a derived cache of orders; no source data is lost.)
-- =============================================================================

-- =============================================================================
-- SECTION 19 — payment_gateways.manual_fallback (per-gateway manual Approve+
-- Reject fallback for AUTO gateways). When 1, the AUTO approve/reject flow is
-- UNCHANGED (a successful gateway callback/poll STILL auto-credits — this is a
-- fallback, NOT a hold), AND admins get manual Approve+Reject buttons on Pending
-- deposits in Deposit History to resolve any recharge the auto flow left STUCK
-- (approve credits + marks Success; reject marks Failed, no credit). Both the
-- auto callback and the manual approve flip WHERE status=0 atomically, so a
-- stuck recharge can never be double-credited. When 0, this auto gateway shows
-- NO manual buttons (pure auto). Independent of additional_verification (which
-- HOLDS auto-credit); manual_fallback does NOT touch the auto-credit path.
-- Default 0.
-- Migration 1741150000000-AddPaymentGatewayManualFallback
-- =============================================================================
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payment_gateways'
    AND COLUMN_NAME = 'manual_fallback');
SET @sql := IF(@col = 0,
  'ALTER TABLE `payment_gateways` ADD COLUMN `manual_fallback` TINYINT(1) NOT NULL DEFAULT 0 AFTER `additional_verification`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741150000000, 'AddPaymentGatewayManualFallback1741150000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddPaymentGatewayManualFallback1741150000000');

-- =============================================================================
-- SECTION 20 — Firebase Cloud Messaging (FCM) push notifications. EXTENDS the
-- existing admin->user in-app notification feature (messages + WsGateway
-- 'notification' event) so admin sends ALSO push to the user's device.
--   * firebase_config (single row): the Firebase web-config fields + vapid_key
--     (SEEDED with the axnbetz-a1328 project values — all public, shipped to the
--     browser) + service_account_json (TEXT, empty by default; the owner pastes
--     the Firebase Admin SDK service-account private key via System > Firebase —
--     it is NEVER stored in this file. While empty the backend logs + no-ops on
--     push and the in-app notification is unaffected). The web-config fields are
--     exposed on GET /app/config so the
--     SPA + service worker can initialize the Firebase web SDK. Admins edit all
--     fields on the System > Firebase page.
--   * user_fcm_tokens: per-user device tokens the SPA registers via
--     POST /hall/api/usr/v1/notification/fcm-token; invalid tokens are pruned
--     on FCM 'not-registered' send errors.
-- Migration 1741160000000-CreateFirebaseConfig
-- =============================================================================
CREATE TABLE IF NOT EXISTS `firebase_config` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `api_key` VARCHAR(255) NOT NULL DEFAULT '',
  `auth_domain` VARCHAR(255) NOT NULL DEFAULT '',
  `project_id` VARCHAR(255) NOT NULL DEFAULT '',
  `storage_bucket` VARCHAR(255) NOT NULL DEFAULT '',
  `messaging_sender_id` VARCHAR(255) NOT NULL DEFAULT '',
  `app_id` VARCHAR(255) NOT NULL DEFAULT '',
  `measurement_id` VARCHAR(255) NOT NULL DEFAULT '',
  `vapid_key` VARCHAR(255) NOT NULL DEFAULT '',
  `service_account_json` TEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Idempotent: add vapid_key to an older firebase_config table that predates it
-- (migration 1741170000000-AddFirebaseVapidKey).
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema=DATABASE() AND table_name='firebase_config' AND column_name='vapid_key');
SET @ddl := IF(@c=0, "ALTER TABLE `firebase_config` ADD COLUMN `vapid_key` VARCHAR(255) NOT NULL DEFAULT '' AFTER `measurement_id`", 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

CREATE TABLE IF NOT EXISTS `user_fcm_tokens` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(32) NOT NULL,
  `token` VARCHAR(512) NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fcm_token` (`token`),
  KEY `idx_fcm_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `firebase_config`
  (`api_key`, `auth_domain`, `project_id`, `storage_bucket`, `messaging_sender_id`, `app_id`, `measurement_id`, `vapid_key`, `service_account_json`)
  SELECT
    'AIzaSyACoFzfqzZUn3mBWAYimbgn9k5XguzA5FM',
    'axnbetz-a1328.firebaseapp.com',
    'axnbetz-a1328',
    'axnbetz-a1328.firebasestorage.app',
    '887789508350',
    '1:887789508350:web:8ac115547fe16dd161b7af',
    'G-5EPQH9NBZM',
    'BE-KddmCxdi3tS_hS4_Gs1sPJOEbR6G9gaNY4UwZQMmjXBTZ0heJRvgvbXYn5n3HutdLOEYtbwYeojW8rc-WlgQ',
    ''
  FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM `firebase_config`);

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741160000000, 'CreateFirebaseConfig1741160000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'CreateFirebaseConfig1741160000000');

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741170000000, 'AddFirebaseVapidKey1741170000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddFirebaseVapidKey1741170000000');


-- =============================================================================
-- SECTION 21 — User ban reason. Optional admin message shown to a banned user
-- (status=0) on the SPA "Account Suspended" page. Nullable; blank => generic
-- message. Migration 1741180000000-AddUserBanReason.
-- =============================================================================
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema=DATABASE() AND table_name='users' AND column_name='ban_reason');
SET @ddl := IF(@c=0, 'ALTER TABLE `users` ADD COLUMN `ban_reason` VARCHAR(255) NULL AFTER `status`', 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741180000000, 'AddUserBanReason1741180000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddUserBanReason1741180000000');

-- =============================================================================
-- SECTION 22 — Notification images. Admin can attach image(s) to a system
-- message. messages.image_url = cover (list thumbnail + FCM big-picture push);
-- message_images = full gallery (sort_order 0 = cover). SPA renders a slider;
-- OS push shows the cover when PUBLIC_BASE_URL is set to a public https origin.
-- Migration 1741200000000-AddNotificationImages. (Upload 'notifications' folder
-- is code-side in upload.controller ALLOWED_FOLDERS — no DB change.)
-- =============================================================================
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema=DATABASE() AND table_name='messages' AND column_name='image_url');
SET @ddl := IF(@c=0, 'ALTER TABLE `messages` ADD COLUMN `image_url` VARCHAR(500) NULL AFTER `content`', 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

CREATE TABLE IF NOT EXISTS `message_images` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `message_id` BIGINT UNSIGNED NOT NULL,
  `image_url` VARCHAR(500) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_message_images_message` (`message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741200000000, 'AddNotificationImages1741200000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddNotificationImages1741200000000');

-- =============================================================================
-- SECTION 23 — Per-user notification delete / clear-all. message_read.hidden:
-- when a user swipe-deletes or clears a notification, a message_read row is
-- upserted with hidden=1 so getNotifications + unread-count exclude it. Broadcast
-- messages remain intact for every other user. Migration 1741210000000-AddMessageReadHidden.
-- =============================================================================
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema=DATABASE() AND table_name='message_read' AND column_name='hidden');
SET @ddl := IF(@c=0, 'ALTER TABLE `message_read` ADD COLUMN `hidden` TINYINT NOT NULL DEFAULT 0 AFTER `user_id`', 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741210000000, 'AddMessageReadHidden1741210000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddMessageReadHidden1741210000000');

-- =============================================================================
-- SECTION 24 — Lottery P&L report fix. The rollup used draw_qty(units) * win_price
-- for Draw Cost, multiplying the FIXED per-winning-order prize by the bet quantity
-- (~5-10x over-count, showing losses on profitable draws). New draw_amount column
-- stores the ACTUAL settled payout (SUM of win_amount for won orders); the report
-- now uses it directly. draw_qty becomes the count of winning orders (display).
-- The rollup is rebuilt on every report open, so this back-populates automatically.
-- Migration 1741220000000-AddRollupDrawAmount.
-- =============================================================================
SET @c := (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema=DATABASE() AND table_name='lottery_sales_rollup' AND column_name='draw_amount');
SET @ddl := IF(@c=0, 'ALTER TABLE `lottery_sales_rollup` ADD COLUMN `draw_amount` DECIMAL(16,2) NOT NULL DEFAULT 0 AFTER `draw_qty`', 'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741220000000, 'AddRollupDrawAmount1741220000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddRollupDrawAmount1741220000000');

-- =============================================================================
-- SECTION 25 — App version. Single-row table serving the mobile/PWA "current
-- version" so the app can prompt an update. Public GET hall/api/oper/v1/app/version
-- (+ appVersion in /app/config); admin GET/POST admin/api/v1/app-version to update.
-- Seeded with 1.0.4 (from the old PHP app_versions). Migration 1741230000000-CreateAppVersions.
-- =============================================================================
CREATE TABLE IF NOT EXISTS `app_versions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `version` varchar(200) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `app_versions` (`version`)
  SELECT '1.0.4' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `app_versions`);

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741230000000, 'CreateAppVersions1741230000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'CreateAppVersions1741230000000');

-- =============================================================================
-- SECTION 26 — Cron job last-run persistence. The Scheduled Jobs page showed
-- "Last run" from the in-memory cron object, which RESETS on every restart, so
-- daily jobs (commission/rebate/vip/cleanup) looked "never run" until their next
-- midnight fire. New columns persist each execution (survives restarts); a shared
-- CronRunRecorder writes them at the end of every job run. Migration 1741240000000.
-- =============================================================================
ALTER TABLE `cron_jobs`
  ADD COLUMN IF NOT EXISTS `last_run` datetime NULL AFTER `enabled`,
  ADD COLUMN IF NOT EXISTS `last_status` varchar(16) NULL AFTER `last_run`,
  ADD COLUMN IF NOT EXISTS `last_error` varchar(255) NULL AFTER `last_status`,
  ADD COLUMN IF NOT EXISTS `last_duration_ms` int NULL AFTER `last_error`;

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741240000000, 'AddCronLastRun1741240000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddCronLastRun1741240000000');

-- =============================================================================
-- SECTION 27 — Referral code prefix. The invite-code prefix (e.g. "AXN", "ARA")
-- is now admin-configurable at /system/general (Referral tab) instead of being
-- hardcoded. Both the user-signup generator and the admin user generator read
-- app_config.referral_prefix (falls back to 'AXN' if blank). Migration 1741250000000.
-- =============================================================================
ALTER TABLE `app_config`
  ADD COLUMN IF NOT EXISTS `referral_prefix` varchar(16) NOT NULL DEFAULT 'ARA' AFTER `currency`;

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741250000000, 'AddReferralPrefix1741250000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddReferralPrefix1741250000000');

-- =============================================================================
-- SECTION 28 — App auto-update. Extends app_versions so the app (PWA/TWA/native)
-- can prompt or FORCE an update when a new version is published. force_update = hard
-- gate; min_supported_version = versions below this are forced; store_url / android_
-- package_name = where "Update" sends the user (Play Store); update_message = optional
-- copy. Edited at admin /system/app-version; exposed in /app/config. Migration 1741260000000.
-- =============================================================================
ALTER TABLE `app_versions`
  ADD COLUMN IF NOT EXISTS `force_update` tinyint NOT NULL DEFAULT 0 AFTER `version`,
  ADD COLUMN IF NOT EXISTS `min_supported_version` varchar(200) NOT NULL DEFAULT '' AFTER `force_update`,
  ADD COLUMN IF NOT EXISTS `store_url` varchar(500) NOT NULL DEFAULT '' AFTER `min_supported_version`,
  ADD COLUMN IF NOT EXISTS `android_package_name` varchar(200) NOT NULL DEFAULT '' AFTER `store_url`,
  ADD COLUMN IF NOT EXISTS `update_message` varchar(500) NOT NULL DEFAULT '' AFTER `android_package_name`;

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741260000000, 'AddAppVersionUpdateFields1741260000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddAppVersionUpdateFields1741260000000');

-- =============================================================================
-- SECTION 29 — Manual lottery start_date. A MANUAL lottery (auto_generate = 0)
-- becomes playable/visible only once start_date is reached: before it, the lobby
-- hides it, getGameInfo returns a "not started" shell (no round is materialised),
-- and buying is rejected. AUTO lotteries ignore start_date (kept NULL). The backfill
-- sets every EXISTING manual lottery to a far-past date so live behaviour is
-- unchanged on deploy (they stay live); only lotteries the admin gives a future
-- start_date get gated. Migration 1741270000000.
-- =============================================================================
ALTER TABLE `game_list`
  ADD COLUMN IF NOT EXISTS `start_date` timestamp NULL DEFAULT NULL AFTER `scheduled_draw_time`;

UPDATE `game_list`
   SET `start_date` = '2000-01-01 00:00:00'
 WHERE `is_lottery` = 1 AND `auto_generate` = 0 AND `start_date` IS NULL;

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741270000000, 'AddGameStartDate1741270000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddGameStartDate1741270000000');

-- =============================================================================
-- SECTION 30 — Daily check-in Day 7 normalisation. Day 7 previously granted a
-- Kerala-lottery-specific reward; it is now a normal reward equal to Day 6 (chip
-- credited to the main balance). This is a data-only update (no schema change);
-- it aligns the live checkin_config with the seed. Idempotent.
-- =============================================================================
UPDATE `checkin_config`
   SET `award_type` = 'chip',
       `award_num` = (SELECT v FROM (SELECT `award_num` v FROM `checkin_config` WHERE `day_num` = 6) t)
 WHERE `day_num` = 7;

-- =============================================================================
-- SECTION 31 — WhatsApp support link. A dedicated, admin-toggleable WhatsApp
-- support button. When support_whatsapp_enabled=1 and a wa.me URL is set, the
-- user app shows a floating WhatsApp button linking to it (separate from the
-- SalesSmartly chat and from the OTP-delivery whatsapp_* fields). Edited at admin
-- /system/general → Support tab; exposed in /app/config.support. Migration
-- 1741280000000. Ships OFF (owner sets their number + toggles on).
-- =============================================================================
ALTER TABLE `app_config`
  ADD COLUMN IF NOT EXISTS `support_whatsapp_enabled` tinyint NOT NULL DEFAULT 0 AFTER `support_telegram_url`,
  ADD COLUMN IF NOT EXISTS `support_whatsapp_url` varchar(500) NOT NULL DEFAULT '' AFTER `support_whatsapp_enabled`;

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741280000000, 'AddSupportWhatsapp1741280000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddSupportWhatsapp1741280000000');

-- =============================================================================
-- SECTION 32 — 3-Digit home grouping. The home lottery list now returns every
-- quick 3-Digit cycle-variant (three_digit is exempt from the is_quick dedup)
-- and the user app groups the 3-Digit section by game_list.group_name (falling
-- back to the game name). This groups the three Quick 3D cycle cards under one
-- "Quick 3D" heading; the admin can re-group any lottery by editing its group.
-- Code-only feature; this data update sets the default group on existing rows.
-- =============================================================================
UPDATE `game_list`
   SET `group_name` = 'Quick 3D'
 WHERE `id` IN (604, 605, 606)
   AND (`group_name` IS NULL OR `group_name` = '');

-- =============================================================================
-- SECTION 33 — Kerala & Dubai home grouping. The Kerala and Dubai home sections
-- now render by game_list.group_name (falling back to the game name), the same
-- way the 3-Digit section does. To preserve the current single-heading look,
-- this sets the default group to the family name ("Kerala Lottery" / "Dubai
-- Lottery") on any Kerala/Dubai lottery that has none. The admin can then split
-- them into sub-groups by editing an individual lottery's group. Code-only
-- feature; this data update only seeds the default group on existing rows.
-- =============================================================================
UPDATE `game_list`
   SET `group_name` = 'Kerala Lottery'
 WHERE `game_type` = 'kerala'
   AND (`group_name` IS NULL OR `group_name` = '');

UPDATE `game_list`
   SET `group_name` = 'Dubai Lottery'
 WHERE `game_type` = 'dubai'
   AND (`group_name` IS NULL OR `group_name` = '');

-- =============================================================================
-- SECTION 34 — 4 & 5 Digit home grouping. Completes the rollout: the 4 & 5 Digit
-- home section now renders by game_list.group_name (falling back to the game
-- name) like the 3-Digit, Kerala and Dubai sections. As in SECTION 33, this sets
-- the default group to the family name on any four_five_digit lottery that has
-- none, so the section keeps its single "4 & 5 Digit" heading until an admin
-- splits it. The section's wide-card (3rd card) and full-width (single card)
-- layout rules now apply per group, which is identical to today while all rows
-- share one group. Code-only feature; this seeds the default group.
-- =============================================================================
UPDATE `game_list`
   SET `group_name` = '4 & 5 Digit'
 WHERE `game_type` = 'four_five_digit'
   AND (`group_name` IS NULL OR `group_name` = '');

-- =============================================================================
-- SECTION 35 — Live-chat (SalesSmartly) on/off switch. The Support tab could
-- toggle WhatsApp but NOT the chat widget, which had only a provider + license
-- and was therefore always on. app_config.support_chat_enabled adds the missing
-- switch: when 0 the user app neither loads the SalesSmartly script nor renders
-- the floating chat button. Edited at admin /system/general → Support tab;
-- exposed in /app/config.support.chatEnabled. Migration 1741290000000.
-- DEFAULTS TO 1 ON PURPOSE: the chat is an existing, working feature, so this
-- must not switch it off on deploy (unlike support_whatsapp_enabled, which was
-- a brand-new feature and ships off).
-- =============================================================================
ALTER TABLE `app_config`
  ADD COLUMN IF NOT EXISTS `support_chat_enabled` tinyint NOT NULL DEFAULT 1 AFTER `instagram_link`;

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741290000000, 'AddSupportChatEnabled1741290000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddSupportChatEnabled1741290000000');

-- =============================================================================
-- SECTION 36 — Restore AUTO_INCREMENT on race_runner_frames.id (live drift fix).
-- SYMPTOM: scheduler log spam
--   ERROR [GameSchedulerService] Error processing game 302 (race):
--   QueryFailedError: Field 'id' doesn't have a default value
-- CAUSE: on the live DB this table's `id` lost its AUTO_INCREMENT attribute
-- (a CREATE TABLE ... SELECT / partial import / hand-made DDL does this — it
-- copies columns but drops AUTO_INCREMENT). The app code and the InitialSchema
-- migration are BOTH correct; only the live schema drifted. The insert comes
-- from race-frame-scheduler.service (predecideRaceResult) which is race-only,
-- which is why only race games failed. It errors ONLY on servers running
-- STRICT_TRANS_TABLES; without strict mode MySQL silently writes id=0 instead,
-- so a non-strict server corrupts the row rather than erroring.
-- Idempotent: alters only when the attribute is actually missing.
-- =============================================================================
-- Order matters: purge id=0 junk BEFORE the ALTER. A non-strict server writes
-- id=0 instead of erroring, and the ALTER would silently renumber those rows to
-- 1 (they are stale frame data, so drop them rather than keep them).
DELETE FROM `race_runner_frames` WHERE `id` = 0;

SET @fix_ai := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'race_runner_frames'
     AND COLUMN_NAME  = 'id'
     AND EXTRA NOT LIKE '%auto_increment%'
);
SET @fix_sql := IF(@fix_ai > 0,
  'ALTER TABLE `race_runner_frames` MODIFY COLUMN `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT',
  'DO 0');
PREPARE fix_stmt FROM @fix_sql; EXECUTE fix_stmt; DEALLOCATE PREPARE fix_stmt;

-- DIAGNOSTIC (run manually on EACH live DB): find ANY other table that drifted
-- the same way. A full code sweep (2026-07-19) confirmed all 97 entities with a
-- generated id have correct AUTO_INCREMENT DDL in BOTH repos, so anything this
-- returns is live-only drift. The excluded tables below are intentional:
-- cron_jobs uses a varchar PK (job name), and the game_*_config / payout_ledger
-- tables use an explicit game_id PK (1:1 with game_list) - never auto_increment.
--
--   SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
--     FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND COLUMN_KEY = 'PRI'
--      AND DATA_TYPE IN ('int','bigint','smallint','tinyint','mediumint')
--      AND EXTRA NOT LIKE '%auto_increment%'
--      AND TABLE_NAME NOT IN ('game_box_config','game_kerala_config',
--          'game_payout_ledger','game_pick4_config','game_punjab_config',
--          'game_race_config','game_wheel_config')
--    ORDER BY TABLE_NAME;
--
-- For each row returned, repair it with (substituting <table>/<coltype>):
--   ALTER TABLE `<table>` MODIFY COLUMN `id` <coltype> NOT NULL AUTO_INCREMENT;
-- (delete any id=0 junk rows FIRST - see the ordering note above).

-- =============================================================================
-- §37  RESULT ENGINE: raise the max_profit decision budget (2026-07-21)
-- -----------------------------------------------------------------------------
-- Why: result_decision_budget_ms=250 truncated the candidate scan on busy
-- rounds. Measured on the fixed engine (digit5, 10k-suffix space, 40 runs per
-- cell), counting rounds where the engine FAILED to find a zero-payout result:
--
--     coverage      250ms        1000ms
--     ---------------------------------
--      2%           0/40          0/40
--     10%           0/40          0/40
--     30%           0/40          0/40
--     60%           9/40          0/40      <-- 250ms is not enough
--
-- 1000ms removes the remaining exposure with ample headroom before the draw.
-- app_config is a single-row WIDE table (one column per setting), so this is an
-- UPDATE of the result_decision_budget_ms column, not a key-value row. Guarded
-- on column existence; safe to re-run.
-- =============================================================================

SET @has_budget_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_config'
    AND COLUMN_NAME = 'result_decision_budget_ms');
SET @sql := IF(@has_budget_col > 0,
  'UPDATE `app_config` SET `result_decision_budget_ms` = 1000',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Verify:
--   SELECT result_decision_budget_ms, result_sample_size FROM app_config;

-- =============================================================================
-- §38  RECHARGE PER-AMOUNT BONUS (2026-07-22)
-- -----------------------------------------------------------------------------
-- Per-preset bonus %, credited to the wallet on top of the recharge (manual +
-- online). recharge_preset.bonus_pct = the %, recharge_records.bonus_amount =
-- the rupee bonus locked in when the user creates the recharge. Idempotent.
-- =============================================================================

SET @has_pct := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recharge_preset'
    AND COLUMN_NAME = 'bonus_pct');
SET @sql := IF(@has_pct = 0,
  'ALTER TABLE `recharge_preset` ADD COLUMN `bonus_pct` DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER `mark`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_bonus := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recharge_records'
    AND COLUMN_NAME = 'bonus_amount');
SET @sql := IF(@has_bonus = 0,
  'ALTER TABLE `recharge_records` ADD COLUMN `bonus_amount` DECIMAL(16,2) NOT NULL DEFAULT 0 AFTER `actual_amount`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Set the % per amount in admin -> Finance / Settings -> Recharge Quick-Amounts.
-- Verify:
--   SELECT amount, mark, bonus_pct FROM recharge_preset ORDER BY sort_order;

-- =============================================================================
-- §39  CASH RAIN: recharged-today gate keyed on APPROVAL time (2026-07-22)
-- -----------------------------------------------------------------------------
-- The Cash Rain claim required a successful recharge "today", but keyed on
-- created_at (initiation). A recharge started before IST midnight and approved
-- after it was wrongly blocked all next day. Add approved_at (stamped on the
-- status->1 flip) and gate on it. Backfill from updated_at for already-approved
-- rows so today's earlier recharges keep counting. Idempotent.
-- =============================================================================

SET @has_appr := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recharge_records'
    AND COLUMN_NAME = 'approved_at');
SET @sql := IF(@has_appr = 0,
  'ALTER TABLE `recharge_records` ADD COLUMN `approved_at` DATETIME(6) NULL AFTER `bonus_amount`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(@has_appr = 0,
  'UPDATE `recharge_records` SET `approved_at` = `updated_at` WHERE `status` = 1 AND `approved_at` IS NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Verify:
--   SELECT status, created_at, approved_at FROM recharge_records
--    WHERE status = 1 ORDER BY id DESC LIMIT 10;

-- =============================================================================
-- §40  GAME RULES: seed game_rule_section for every live game (2026-07-22)
-- -----------------------------------------------------------------------------
-- Rules only rendered for 3-digit because game_rule_section had rows only for
-- those games. Seed the per-game-type rule sections for EVERY live game that
-- currently has NO rule rows. Snapshot the empty set first so multiple inserts
-- do not re-exclude a game mid-seed. Idempotent; never touches games that
-- already have rules (preserves admin edits). Content mirrors RULES_BY_TYPE.
-- =============================================================================

DROP TEMPORARY TABLE IF EXISTS _rules_empty;
CREATE TEMPORARY TABLE _rules_empty AS
  SELECT g.id, g.game_type FROM game_list g
  WHERE NOT EXISTS (SELECT 1 FROM game_rule_section rs WHERE rs.game_id = g.id);

-- color (5 sections)
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Game Introduction', 'Win Go draws a single number from 0-9 each round. You can bet on the colour, the exact number, or the size of the drawn number. Betting closes a few seconds before each draw.', 0
  FROM _rules_empty e WHERE e.game_type = 'color';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Colour Betting', 'Red wins on 1, 3, 5, 7, 9. Green wins on 2, 4, 6, 8, 0. Violet wins on 0 and 5. The numbers 0 and 5 belong to both their colour and Violet.', 1
  FROM _rules_empty e WHERE e.game_type = 'color';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Number Betting', 'Pick the exact number (0-9) that will be drawn. A correct pick pays the highest odds.', 2
  FROM _rules_empty e WHERE e.game_type = 'color';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Big / Small', 'Big covers the numbers 5, 6, 7, 8, 9. Small covers the numbers 0, 1, 2, 3, 4.', 3
  FROM _rules_empty e WHERE e.game_type = 'color';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Notes', 'Every result is produced by a certified random number generator.', 4
  FROM _rules_empty e WHERE e.game_type = 'color';

-- dice (6 sections)
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Game Introduction', 'K3 rolls three dice each round. You can bet on the total sum, on dice combinations, or on individual numbers.', 0
  FROM _rules_empty e WHERE e.game_type = 'dice';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Big / Small', 'Big is a sum of 11-17; Small is a sum of 3-10. If the result is a triple, all Big/Small bets lose.', 1
  FROM _rules_empty e WHERE e.game_type = 'dice';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Odd / Even', 'Odd wins when the sum is odd; Even wins when the sum is even. Triples are excluded from Odd/Even bets.', 2
  FROM _rules_empty e WHERE e.game_type = 'dice';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Sum Bet', 'Bet on the exact total of the three dice (range 3-18). Each sum pays different odds based on its probability.', 3
  FROM _rules_empty e WHERE e.game_type = 'dice';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Triples', 'Specific Triple wins when all three dice show one chosen number (e.g. 111). Any Triple wins on any matching triple: 111, 222, 333, 444, 555 or 666.', 4
  FROM _rules_empty e WHERE e.game_type = 'dice';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Notes', 'All results are determined by a certified random number generator.', 5
  FROM _rules_empty e WHERE e.game_type = 'dice';

-- race (3 sections)
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Game Rules', 'A field of runners competes in each race. Place your bets on how they finish.', 0
  FROM _rules_empty e WHERE e.game_type = 'race';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Bet Types', 'Champion - pick the 1st-place runner. Winning Group - pick the winning team. Top 3 (Any) - pick a runner that finishes in the top 3. Top 3 (Random) - pick 3 runners in any order. Top 3 (Fixed) - pick 3 runners in exact finishing order. Each bet type pays its own odds.', 1
  FROM _rules_empty e WHERE e.game_type = 'race';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Notes', 'The finishing order shown in the race animation is the official result.', 2
  FROM _rules_empty e WHERE e.game_type = 'race';

-- three_digit (5 sections)
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Introduction', 'The 3-Digit Lottery (ABC Game) is settled on the last three digits of an official government lottery first prize. Boards are labelled A, B and C.', 0
  FROM _rules_empty e WHERE e.game_type = 'three_digit';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Single Digit', 'Play a single digit on any one board (A, B or C). You win if that digit matches the corresponding position of the result.', 1
  FROM _rules_empty e WHERE e.game_type = 'three_digit';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Two Digit', 'Pick two digits in the combinations AB, BC or AC to match two positions of the result.', 2
  FROM _rules_empty e WHERE e.game_type = 'three_digit';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Three Digit (ABC)', 'Bet on the full ABC combination. Prizes are paid for matching all three digits, the last two digits, or the last digit.', 3
  FROM _rules_empty e WHERE e.game_type = 'three_digit';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Notes', 'Winning numbers are derived from the last three digits of the first-prize number.', 4
  FROM _rules_empty e WHERE e.game_type = 'three_digit';

-- four_five_digit (4 sections)
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'How to Play', 'Pick digits for positions A B C D E to match the draw result. Use Box to generate every permutation, or Straight to fill the empty positions with 0-9. A 4-digit bet needs at least 2 digits filled; a 5-digit bet needs at least 3.', 0
  FROM _rules_empty e WHERE e.game_type = 'four_five_digit';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, '5-Digit Game (ABCDE)', 'Match the last 5 positions of the result. Prizes scale with how many trailing positions you match (5, 4, 3 or 2 digits).', 1
  FROM _rules_empty e WHERE e.game_type = 'four_five_digit';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, '4-Digit Game (BCDE)', 'Match the last 4 positions of the result. Prizes scale with how many trailing positions you match (4, 3 or 2 digits).', 2
  FROM _rules_empty e WHERE e.game_type = 'four_five_digit';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Notes', 'Box bets match in any order and each permutation counts as one bet. Straight bets fill empty positions with all possible digits (0-9).', 3
  FROM _rules_empty e WHERE e.game_type = 'four_five_digit';

-- dubai (3 sections)
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Game Instructions', 'Dubai Lottery is a single-digit game. Pick your number and choose a multiplier to scale your stake and potential winnings.', 0
  FROM _rules_empty e WHERE e.game_type = 'dubai';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'How to Play', 'Select your number, set the multiplier, and add it to the bet slip. You win when your number matches the drawn result.', 1
  FROM _rules_empty e WHERE e.game_type = 'dubai';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Notes', 'Add a bank card to receive your winnings. Enjoy the game and good luck!', 2
  FROM _rules_empty e WHERE e.game_type = 'dubai';

-- kerala (4 sections)
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Introduction', 'Kerala Lottery is a ticket-based prize-tier lottery. Buy a ticket with a unique number and wait for the official draw.', 0
  FROM _rules_empty e WHERE e.game_type = 'kerala';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'How to Play', 'Choose or auto-generate a ticket number and confirm your purchase before the draw closes. Each ticket is entered into the prize draw.', 1
  FROM _rules_empty e WHERE e.game_type = 'kerala';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Prize Tiers', 'Winnings are paid by prize tier - matching the full first-prize number pays the top prize, with smaller prizes for matching the lower tiers and trailing digits.', 2
  FROM _rules_empty e WHERE e.game_type = 'kerala';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Notes', 'Results follow the official government draw. Prizes are credited to your wallet after settlement.', 3
  FROM _rules_empty e WHERE e.game_type = 'kerala';

-- mystery_box (3 sections)
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'How to Play', 'Each draw costs a fixed amount or uses a free draw chance. Every draw is guaranteed to win a prize.', 0
  FROM _rules_empty e WHERE e.game_type = 'mystery_box';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Prize Pool', 'Prizes range from small items up to the headline product. The full prize pool is shown before you open a box.', 1
  FROM _rules_empty e WHERE e.game_type = 'mystery_box';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Notes', 'Prizes are credited to your wallet instantly after each draw.', 2
  FROM _rules_empty e WHERE e.game_type = 'mystery_box';

-- lucky_spin (4 sections)
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'How to Play', 'Spin the wheel to win a prize. Each spin costs a fixed amount, or uses a free spin if you have one. The wheel stops on a random segment and that segment’s prize is credited instantly.', 0
  FROM _rules_empty e WHERE e.game_type = 'lucky_spin';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Prizes & Odds', 'Each segment shows a prize multiplier. Higher multipliers are rarer; the segment weights determine how often each prize is won.', 1
  FROM _rules_empty e WHERE e.game_type = 'lucky_spin';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Free Spins', 'Earn free spins by inviting friends and through daily rewards.', 2
  FROM _rules_empty e WHERE e.game_type = 'lucky_spin';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Notes', 'Every spin result is produced by a certified random number generator.', 3
  FROM _rules_empty e WHERE e.game_type = 'lucky_spin';

-- cash_rain (3 sections)
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'How it Works', 'Cash Rain events run at scheduled times each day. Tap to collect rewards while an event is active - the rewards are credited to your main wallet.', 0
  FROM _rules_empty e WHERE e.game_type = 'cash_rain';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Schedule', '1st-7th of each month: 6 sessions daily. 8th to month end: 3 sessions daily.', 1
  FROM _rules_empty e WHERE e.game_type = 'cash_rain';
INSERT INTO game_rule_section (game_id, title, content, sort_order)
  SELECT e.id, 'Notes', 'Each event distributes free rewards to eligible members. The money received can be used to play games or withdrawn. The more and longer you play each day, the higher the amount you can earn.', 2
  FROM _rules_empty e WHERE e.game_type = 'cash_rain';

DROP TEMPORARY TABLE IF EXISTS _rules_empty;

-- Verify:
--   SELECT g.game_type, COUNT(rs.id) FROM game_list g
--     LEFT JOIN game_rule_section rs ON rs.game_id = g.id GROUP BY g.game_type;

-- =============================================================================
-- §41  GROUP CHAT: real-time community chat (2026-08-12)
-- -----------------------------------------------------------------------------
-- Custom real-time group chat. chat_group holds each room (public = everyone,
-- private = admin-assigned members only); chat_group_member is the private
-- roster; chat_message is the history (soft-deleted via status); chat_mute is
-- the per-user chat ban. app_config gains the enable toggle plus the link /
-- bad-word moderation switches. Mirrors migration 1741320000000. Idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `chat_group` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL DEFAULT 'Community Chat',
  `type` VARCHAR(16) NOT NULL DEFAULT 'public',
  `avatar` VARCHAR(255) NOT NULL DEFAULT '',
  `status` TINYINT NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_by` VARCHAR(32) NOT NULL DEFAULT '',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed one default public group only when the table is still empty.
INSERT INTO `chat_group` (`name`, `type`, `status`, `sort_order`)
  SELECT 'Community Chat', 'public', 1, 0
  WHERE NOT EXISTS (SELECT 1 FROM `chat_group`);

CREATE TABLE IF NOT EXISTS `chat_group_member` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `group_id` INT UNSIGNED NOT NULL,
  `user_id` VARCHAR(32) NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_group_member` (`group_id`, `user_id`),
  KEY `idx_member_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `chat_message` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `group_id` INT UNSIGNED NOT NULL DEFAULT 1,
  `user_id` VARCHAR(32) NOT NULL,
  `sender_role` VARCHAR(16) NOT NULL DEFAULT 'user',
  `sender_name` VARCHAR(64) NOT NULL DEFAULT '',
  `sender_avatar` VARCHAR(255) NOT NULL DEFAULT '',
  `content` VARCHAR(1000) NOT NULL DEFAULT '',
  `image_url` VARCHAR(500) NULL,
  `reply_to_id` BIGINT UNSIGNED NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_chat_group` (`group_id`, `status`, `id`),
  KEY `idx_chat_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `chat_mute` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(32) NOT NULL,
  `muted_until` DATETIME NULL,
  `reason` VARCHAR(255) NOT NULL DEFAULT '',
  `created_by` VARCHAR(32) NOT NULL DEFAULT '',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_chat_mute_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @has_gc_en := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_config'
    AND COLUMN_NAME = 'group_chat_enabled');
SET @sql := IF(@has_gc_en = 0,
  'ALTER TABLE `app_config` ADD COLUMN `group_chat_enabled` TINYINT NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_gc_bl := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_config'
    AND COLUMN_NAME = 'group_chat_block_links');
SET @sql := IF(@has_gc_bl = 0,
  'ALTER TABLE `app_config` ADD COLUMN `group_chat_block_links` TINYINT NOT NULL DEFAULT 1',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_gc_bw := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_config'
    AND COLUMN_NAME = 'group_chat_bad_words');
SET @sql := IF(@has_gc_bw = 0,
  'ALTER TABLE `app_config` ADD COLUMN `group_chat_bad_words` TEXT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enable in admin -> System -> Chat. Verify:
--   SELECT group_chat_enabled, group_chat_block_links FROM app_config;
--   SELECT id, name, type, status FROM chat_group;

-- =============================================================================
-- §42  GROUP CHAT PHASE 2/3: images, reply, mentions, read receipts (2026-08-14)
-- -----------------------------------------------------------------------------
-- chat_message.mentions (comma-joined userIds), app_config.group_chat_image_enabled
-- (image-sharing toggle), and chat_read (per-user last-read pointer per group,
-- drives cross-session unread + private read receipts). Mirrors migration
-- 1741330000000. Idempotent.
-- =============================================================================

SET @has_ment := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_message'
    AND COLUMN_NAME = 'mentions');
SET @sql := IF(@has_ment = 0,
  'ALTER TABLE `chat_message` ADD COLUMN `mentions` VARCHAR(500) NULL AFTER `reply_to_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_img := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_config'
    AND COLUMN_NAME = 'group_chat_image_enabled');
SET @sql := IF(@has_img = 0,
  'ALTER TABLE `app_config` ADD COLUMN `group_chat_image_enabled` TINYINT NOT NULL DEFAULT 1',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `chat_read` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `group_id` INT UNSIGNED NOT NULL,
  `user_id` VARCHAR(32) NOT NULL,
  `last_read_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_chat_read` (`group_id`, `user_id`),
  KEY `idx_chat_read_user` (`user_id`, `group_id`, `last_read_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @has_cr_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_read'
    AND INDEX_NAME = 'idx_chat_read_user');
SET @sql := IF(@has_cr_idx = 0,
  'ALTER TABLE `chat_read` ADD INDEX `idx_chat_read_user` (`user_id`, `group_id`, `last_read_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Verify:
--   SELECT group_chat_image_enabled FROM app_config;
--   SHOW COLUMNS FROM chat_message LIKE 'mentions';
--   SHOW INDEX FROM chat_read WHERE Key_name = 'idx_chat_read_user';
--   SELECT * FROM chat_read LIMIT 5;

-- =============================================================================
-- END OF live-db-update.sql
-- =============================================================================
