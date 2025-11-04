-- Migration: Add special_requests column to orders table
-- Run this SQL in your Supabase SQL Editor

-- Add special_requests column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS special_requests TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN orders.special_requests IS 'Särskilda önskemål från kunden (t.ex. allergier, leveransdatum, etc.)';
