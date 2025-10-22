-- Supabase Database Schema for Kakservice Website
-- Run this SQL in your Supabase SQL Editor

-- Create applications table
CREATE TABLE applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Link to auth user
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Personal Information
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  
  -- Organization Information
  organization TEXT NOT NULL,
  group_type TEXT NOT NULL CHECK (group_type IN ('sports', 'school', 'association', 'other')),
  participants TEXT,
  
  -- Application Details
  goal TEXT,
  timeline TEXT,
  
  -- Preferences
  newsletter BOOLEAN DEFAULT FALSE,
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'active', 'completed', 'cancelled')),
  notes TEXT,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT
);

-- Create indexes for better performance
CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_email ON applications(email);
CREATE INDEX idx_applications_created_at ON applications(created_at);
CREATE INDEX idx_applications_status ON applications(status);

-- Enable Row Level Security (RLS)
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Create policy for inserting applications (public can submit)
CREATE POLICY "Anyone can submit applications" ON applications
  FOR INSERT WITH CHECK (true);

-- Create policy for users to view their own applications
CREATE POLICY "Users can view own applications" ON applications
  FOR SELECT USING (auth.uid() = user_id);

-- Create policy for users to update their own applications
CREATE POLICY "Users can update own applications" ON applications
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policy for admin access (service role bypasses RLS)
-- CREATE POLICY "Admins can view all applications" ON applications
--   FOR ALL USING (auth.role() = 'service_role');

-- Create a function to send email notifications
CREATE OR REPLACE FUNCTION notify_new_application()
RETURNS TRIGGER AS $$
BEGIN
  -- This will be handled by SendGrid API, not database triggers
  -- But we can log it here if needed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new applications
CREATE TRIGGER on_application_created
  AFTER INSERT ON applications
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_application();

-- Insert some sample data (optional)
-- INSERT INTO applications (name, email, organization, group_type, terms_accepted) 
-- VALUES ('Test User', 'test@example.com', 'Test Organization', 'sports', true);
