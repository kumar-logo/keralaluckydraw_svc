-- ============================================================================
-- PayIndia payment gateway — activation row
-- ============================================================================
-- No schema change is needed: every column below already exists on
-- `payment_gateways`. This script only inserts the one data row that makes the
-- PayIndia driver usable, plus its UPI method chip.
--
-- BEFORE YOU RUN:
--   Replace the three @… placeholders with the real values from your PayIndia
--   dashboard (see steps at the bottom). Do NOT commit this file with real
--   secrets filled in.
--
--   Run it:  mysql -u root keralaluckydraw < sql/payindia-gateway.sql
-- ============================================================================

SET @api_key        = 'REPLACE_WITH_X_API_KEY';       -- pi_live_...
SET @api_secret     = 'REPLACE_WITH_X_API_SECRET';    -- sk_live_...
SET @webhook_secret = 'REPLACE_WITH_WEBHOOK_SECRET';  -- from Webhooks Portal

SET @api_url        = 'https://online.axnbetz.com/api';
SET @callback_url   = 'https://api.keralaluckydraw.com/payment/webhook/payindia';

INSERT INTO payment_gateways
  (gateway_name, provider_code, gateway_type, mode, api_url, api_key, api_secret,
   callback_url, webhook_secret, min_amount, max_amount, fee_rate, fee_fixed,
   icon_url, qr_image_url, upi_id, sort_order, require_proof,
   additional_verification, manual_fallback, status)
VALUES
  ('PayIndia', 'payindia', 'payindia', 'auto', @api_url, @api_key, @api_secret,
   @callback_url, @webhook_secret, 100.00, 50000.00, 0.0000, 0.00,
   '', '', '', 5, 0, 0, 0, 1);

INSERT INTO payment_gateway_method (gateway_id, method_code, sort_order)
VALUES (LAST_INSERT_ID(), 'upi', 0);

-- Verify:
SELECT id, gateway_name, provider_code, gateway_type, mode, status
  FROM payment_gateways
 WHERE provider_code = 'payindia';
