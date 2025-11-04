-- Migration: Add deletion_scheduled_at column to accounts table
-- Run this SQL in your Supabase SQL Editor

-- Add deletion_scheduled_at column to accounts table
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMP WITH TIME ZONE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_accounts_deletion_scheduled_at ON accounts(deletion_scheduled_at);

-- Add comment to explain the column
COMMENT ON COLUMN accounts.deletion_scheduled_at IS 'Timestamp when account is scheduled for deletion (7 days after order is sent)';

