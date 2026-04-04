// Configuration file for API keys and settings
// IMPORTANT: For production, use environment variables instead of hardcoding keys here
// This file is for local development only

const CONFIG = {
  // Supabase Configuration
  SUPABASE_URL: 'YOUR_SUPABASE_URL_HERE',
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY_HERE',
  
  // Email Configuration (used by backend functions)
  SMTP_HOST: 'smtp.strato.com',
  SMTP_PORT: '465',
  SMTP_SECURE: 'true',
  SMTP_USER: 'YOUR_SMTP_USER_HERE',
  SMTP_PASS: 'YOUR_SMTP_PASS_HERE',
  FROM_EMAIL: 'klasskraftuf@gmail.com', // Your verified sender email
  ADMIN_EMAIL: 'klasskraftuf@gmail.com', // Where to send notifications
  
  // Application Settings
  APP_NAME: 'KlassKraft UF',
  COMPANY_NAME: 'Klass Kraft UF'
};

// Make config available globally
window.CONFIG = CONFIG;
