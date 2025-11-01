-- Migration: Add terms acceptance and evidence fields to orders table
-- Run this SQL in your Supabase SQL Editor

-- Add columns for terms acceptance tracking
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS terms_version TEXT,
ADD COLUMN IF NOT EXISTS ip_address INET,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Create index on session_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id);

-- Create index on terms_accepted_at for querying by acceptance date
CREATE INDEX IF NOT EXISTS idx_orders_terms_accepted_at ON orders(terms_accepted_at);

-- Add comment for documentation
COMMENT ON COLUMN orders.terms_accepted IS 'Indicates if customer has accepted terms and conditions';
COMMENT ON COLUMN orders.terms_accepted_at IS 'Timestamp when terms were accepted';
COMMENT ON COLUMN orders.terms_version IS 'Version of terms that were accepted (e.g., v1.0-2025-01-01)';
COMMENT ON COLUMN orders.ip_address IS 'IP address of customer as evidence of acceptance';
COMMENT ON COLUMN orders.user_agent IS 'Web browser information as evidence';
COMMENT ON COLUMN orders.session_id IS 'Unique session identifier for tracking';

