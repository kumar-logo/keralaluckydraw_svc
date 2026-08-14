-- ============================================================================
-- Rebrand helper — rename the physical database  arasiagency -> keralaluckydraw
-- ============================================================================
-- The application code, .env files and every SQL script now expect the schema
-- to be called `keralaluckydraw`. If your server still holds the old
-- `arasiagency` database, run this once to move it across.
--
-- MySQL has no "RENAME DATABASE", so this creates the new schema and moves each
-- table into it with RENAME TABLE. That is a metadata-only operation: it does
-- NOT copy row data, so it is fast even on large tables.
--
--   Run it:  mysql -u root < sql/rename-database.sql
--
-- BEFORE YOU RUN:
--   1. Stop the API server, so nothing writes mid-move.
--   2. Take a backup:
--        mysqldump -u root --routines --triggers --events \
--          arasiagency > arasiagency-backup.sql
--   3. Confirm nothing else on this server points at `arasiagency`.
--
-- NOTE: RENAME TABLE moves tables and their triggers, but NOT views, stored
-- procedures, functions or events. If you use any, restore them into the new
-- schema from the dump in step 2 after this finishes.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS keralaluckydraw
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Generate one RENAME TABLE statement covering every base table, then run it.
-- ----------------------------------------------------------------------------
SET SESSION group_concat_max_len = 1048576;

SELECT GROUP_CONCAT(
         CONCAT('`arasiagency`.`', TABLE_NAME, '` TO `keralaluckydraw`.`', TABLE_NAME, '`')
         SEPARATOR ', '
       )
  INTO @moves
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = 'arasiagency'
   AND TABLE_TYPE = 'BASE TABLE';

SET @sql = IF(@moves IS NULL OR @moves = '',
              'SELECT ''Nothing to move: no base tables found in `arasiagency`.'' AS result',
              CONCAT('RENAME TABLE ', @moves));

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- Verify, then drop the empty husk manually once you are satisfied.
-- ----------------------------------------------------------------------------
SELECT TABLE_SCHEMA, COUNT(*) AS tables_present
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA IN ('arasiagency', 'keralaluckydraw')
   AND TABLE_TYPE = 'BASE TABLE'
 GROUP BY TABLE_SCHEMA;

-- Only after the counts above look right:
--   DROP DATABASE arasiagency;
