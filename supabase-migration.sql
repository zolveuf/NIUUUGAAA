-- Add missing columns to applications table
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS experience TEXT,
ADD COLUMN IF NOT EXISTS additional_info TEXT;

-- Remove timeline column if it exists (not used in current code)
-- ALTER TABLE applications DROP COLUMN IF EXISTS timeline;
