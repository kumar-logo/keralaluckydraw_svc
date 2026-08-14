-- ============================================================================
-- keralaluckydraw — CLEAR PLAY DATA, RECORDS & ORDERS  +  ZERO EVERY BALANCE
-- ============================================================================
-- Fresh-launch reset. Wipes every game round, bet, money/transaction record and
-- per-user reward record, and resets EVERY wallet column on every user to 0.
--
-- KEEPS:
--   * user & admin ACCOUNTS (login still works)
--   * ALL CONFIG: game_list, every game_*_config (race/kerala/box/wheel/pick/
--     slat/punjab/position...), game_odds_config, game_fee_config,
--     game_prize_tier, game_number_color/prefix, game_payout config, app_config,
--     system_config, finance_config, profit_digit_settings/profit_setting_users,
--     ui_*, lobby_*, game_providers, casino_games, payment_gateways(+method),
--     roles/permissions/role_permissions, vip_levels, rank_config(+prize),
--     checkin_config, cashrain_window, recharge_preset, recharge_awards,
--     agent_levels, transfer_tier, game_daily_reward, cdkey_codes,
--     transaction_types, odds_alias, third_party_config, firebase_config,
--     migrations.
--   * CONTENT: activities, banners, announcements, popups, avatar_list,
--     notification_templates, share_configs/share_channel/share_poster,
--     messages(+message_read/message_images).
--   * USER-OWNED DATA tied to the kept accounts: bank_cards, user_favorites,
--     user_fcm_tokens.
--
-- Run it (local XAMPP):
--   "C:\xampp\mysql\bin\mysql.exe" -u root keralaluckydraw < clear_records.sql
-- (or paste into phpMyAdmin against the keralaluckydraw database)
--
-- TRUNCATE also resets AUTO_INCREMENT so IDs start clean.
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ---- Game rounds, draw results & rollups ----------------------------------
TRUNCATE TABLE game_rounds;
TRUNCATE TABLE result_decisions;
TRUNCATE TABLE race_runner_frames;
TRUNCATE TABLE wheel_draw_history;
TRUNCATE TABLE cashrain_records;
TRUNCATE TABLE lottery_draw_details;
TRUNCATE TABLE lottery_sales_rollup;
TRUNCATE TABLE game_payout_ledger;

-- ---- Orders / bets --------------------------------------------------------
TRUNCATE TABLE orders;

-- ---- Money & reward records (NOT the config that defines them) -------------
TRUNCATE TABLE transactions;
TRUNCATE TABLE recharge_records;
TRUNCATE TABLE withdrawal_records;
TRUNCATE TABLE transfer_records;
TRUNCATE TABLE wage_records;
TRUNCATE TABLE rebate_records;
TRUNCATE TABLE agent_commissions;
TRUNCATE TABLE vip_awards;
TRUNCATE TABLE rank_records;
TRUNCATE TABLE checkin_records;
TRUNCATE TABLE cdkey_usage;
TRUNCATE TABLE third_party_txn;

-- ---- Transient verification codes -----------------------------------------
TRUNCATE TABLE sms_codes;

-- ---- Reset EVERY wallet column to 0 (keeps the accounts) ------------------
-- users has four money columns: balance (main), withdrawable_balance,
-- bonus_balance, app_award. is_recharge is reset so a zeroed wallet is not
-- still flagged as "has recharged" (which would suppress the first-recharge
-- bonus and leave the account in an inconsistent fresh-launch state).
UPDATE users
   SET balance              = 0,
       withdrawable_balance = 0,
       bonus_balance        = 0,
       app_award            = 0,
       is_recharge          = 0;

SET FOREIGN_KEY_CHECKS = 1;

-- ---- OPTIONAL: also clear admin audit logs (uncomment for a clean log) -----
-- TRUNCATE TABLE admin_logs;

-- ---- Verify (run after) ---------------------------------------------------
--   SELECT COUNT(*) AS orders_left FROM orders;
--   SELECT COUNT(*) AS txns_left  FROM transactions;
--   SELECT SUM(balance)+SUM(withdrawable_balance)+SUM(bonus_balance)+SUM(app_award)
--     AS total_money_left FROM users;   -- expect 0
