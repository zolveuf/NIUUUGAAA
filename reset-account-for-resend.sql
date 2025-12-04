-- RESTORE ACCOUNT TO STATE BEFORE ORDERS WERE SENT
-- This will restore the account exactly as it was before "Send all orders" was clicked
-- Run this SQL in Supabase SQL Editor
-- 
-- WHAT THIS DOES:
-- 1. Clears deletion_scheduled_at (removes deletion schedule)
-- 2. Resets all order statuses from 'sent' back to 'pending'
-- 3. Restores personal_link_code (generates new one since original was changed to DEL_*)
-- 4. This will make the dashboard work exactly like before orders were sent

-- STEP 1: Clear deletion schedule and restore personal link code
UPDATE accounts 
SET deletion_scheduled_at = NULL,
    personal_link_code = UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 12)),
    updated_at = NOW()
WHERE id = '2844aed7-953f-4bdd-99cc-bf4197ad1eaf';

-- STEP 2: Reset all order statuses from 'sent' back to 'pending'
UPDATE orders 
SET status = 'pending',
    updated_at = NOW()
WHERE account_id = '2844aed7-953f-4bdd-99cc-bf4197ad1eaf' 
  AND status = 'sent';

-- ALTERNATIVE: If you know the original personal_link_code and want to restore it exactly:
-- (Check the order emails that were sent - they contain the original link)
-- UPDATE accounts 
-- SET deletion_scheduled_at = NULL,
--     personal_link_code = 'ORIGINAL_CODE_HERE',  -- Replace with the original code
--     updated_at = NOW()
-- WHERE id = '2844aed7-953f-4bdd-99cc-bf4197ad1eaf';

-- VERIFY BEFORE RESET (Run this first to confirm the account):
SELECT 
  a.id, 
  a.personal_link_code, 
  a.deletion_scheduled_at, 
  a.created_at, 
  a.updated_at,
  app.organization,
  app.email,
  app.name
FROM accounts a
LEFT JOIN applications app ON app.user_id = (SELECT user_id FROM accounts WHERE id = a.id)
WHERE a.id = '2844aed7-953f-4bdd-99cc-bf4197ad1eaf';

-- Verify the reset worked (Run this after the UPDATE):
SELECT 
  id, 
  personal_link_code, 
  deletion_scheduled_at, 
  created_at, 
  updated_at
FROM accounts
WHERE id = '2844aed7-953f-4bdd-99cc-bf4197ad1eaf';

-- Check orders for this account:
SELECT id, status, total_amount, created_at
FROM orders
WHERE account_id = '2844aed7-953f-4bdd-99cc-bf4197ad1eaf'
ORDER BY created_at DESC;

-- IMPORTANT NOTES:
-- 1. After resetting, the account will be exactly as it was BEFORE orders were sent
-- 2. The "Skicka alla beställningar" button will be enabled again
-- 3. All orders will have status 'pending' again (ready to be sent)
-- 4. The class will get a NEW personal_link_code (the original was changed to DEL_*)
-- 5. They need to log in to their dashboard to see the new link
-- 6. The old order link (with DEL_ code) will NOT work - they need to use the new link
-- 7. All existing orders will still be visible in their dashboard with 'pending' status

