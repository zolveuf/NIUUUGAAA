-- Migration: Add seller_name column to orders table
-- Run this SQL in your Supabase SQL Editor

-- Add seller_name column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS seller_name TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN orders.seller_name IS 'Namn på säljaren (elev eller medlem från klassen/föreningen) som kunden köpte från';

