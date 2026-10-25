SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'recharge_records'
     AND INDEX_NAME   = 'IDX_recharge_records_created_at'
);
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE `recharge_records` ADD INDEX `IDX_recharge_records_created_at` (`created_at`)',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'recharge_records'
     AND INDEX_NAME   = 'IDX_recharge_records_status_created_at'
);
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE `recharge_records` ADD INDEX `IDX_recharge_records_status_created_at` (`status`, `created_at`)',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'recharge_records'
     AND INDEX_NAME   = 'IDX_recharge_records_user_created_at'
);
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE `recharge_records` ADD INDEX `IDX_recharge_records_user_created_at` (`user_id`, `created_at`)',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT INTO `migrations` (`timestamp`, `name`)
  SELECT 1741400000000, 'AddRechargeListIndexes1741400000000' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `name` = 'AddRechargeListIndexes1741400000000');
