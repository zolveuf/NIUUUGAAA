// Netlify build script to inject environment variables
// This runs during the build process

const fs = require('fs');
const path = require('path');

// Environment variables from Netlify
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY_HERE';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || 'YOUR_SENDGRID_API_KEY_HERE';
const FROM_EMAIL = process.env.FROM_EMAIL || 'klasskraftuf@gmail.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'klasskraftuf@gmail.com';
const APP_NAME = process.env.APP_NAME || 'Kakservice';
const COMPANY_NAME = process.env.COMPANY_NAME || 'Klass Kraft UF';

// Files to process
const filesToProcess = ['login.html', 'dashboard.html', 'order.html', 'forgot-password.html', 'reset-password.html', 'sa-funkar-det.html', 'om-oss.html'];

filesToProcess.forEach(fileName => {
  const filePath = path.join(__dirname, fileName);
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace placeholder values with actual environment variables
    content = content.replace(/YOUR_SUPABASE_URL_HERE/g, SUPABASE_URL);
    content = content.replace(/YOUR_SUPABASE_ANON_KEY_HERE/g, SUPABASE_ANON_KEY);
    content = content.replace(/YOUR_SENDGRID_API_KEY_HERE/g, SENDGRID_API_KEY);
    content = content.replace(/noreply@yourdomain\.com/g, FROM_EMAIL);
    content = content.replace(/admin@yourdomain\.com/g, ADMIN_EMAIL);
    content = content.replace(/APP_NAME: 'Kakservice'/g, `APP_NAME: '${APP_NAME}'`);
    content = content.replace(/COMPANY_NAME: 'Klass Kraft UF'/g, `COMPANY_NAME: '${COMPANY_NAME}'`);
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Processed ${fileName}`);
  } else {
    console.log(`⚠️ File not found: ${fileName}`);
  }
});

console.log('🎉 Build script completed!');
