// Netlify Function for handling form submissions
const { createClient } = require('@supabase/supabase-js');
const sgMail = require('@sendgrid/mail');

// Function to generate unique link codes
function generateLinkCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const data = JSON.parse(event.body);
    const {
      name,
      email,
      password,
      phone,
      organization,
      groupType,
      participants,
      goal,
      experience,
      additionalInfo
    } = data;

    // Validate required fields
    if (!name || !email || !password || !organization || !groupType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          required: ['name', 'email', 'password', 'organization', 'groupType']
        })
      };
    }

    // Get client IP address
    const ipAddress = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     event.headers['x-real-ip'] || 
                     event.connection?.remoteAddress || 
                     'Unknown';

    // Initialize Supabase client with service role key for backend operations
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if user already exists
    console.log('Checking for existing user...');
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('Error listing users:', listError);
      return { statusCode: 400, body: JSON.stringify({ error: 'Could not check existing users: ' + listError.message }) };
    }
    const existingUser = users.users.find(user => user.email === email);

    let userId;
    if (existingUser) {
      console.log('User already exists, using existing user ID');
      userId = existingUser.id;
    } else {
      // Create user account
      console.log('Creating new user account...');
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          name: name,
          organization: organization,
          group_type: groupType
        }
      });

      if (authError) {
        console.error('User creation error:', authError);
        return { statusCode: 400, body: JSON.stringify({ error: 'Account creation failed: ' + authError.message }) };
      }

      userId = authData.user.id;
      console.log('User created successfully:', userId);
    }

    // Insert application into database
    console.log('Inserting application...');
    const { data: applicationData, error: applicationError } = await supabase
      .from('applications')
      .insert([
        {
          user_id: userId,
          name: name,
          email: email,
          phone: phone || null,
          organization: organization,
          group_type: groupType,
          participants: participants || null,
          goal: goal || null,
          experience: experience || null,
          additional_info: additionalInfo || null,
          ip_address: ipAddress,
          status: 'pending'
        }
      ])
      .select();

    if (applicationError) {
      console.error('Application insertion error:', applicationError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Database error: ' + applicationError.message })
      };
    }

    const application = applicationData[0];
    console.log('Application created:', application.id);

    // Create account with personal link code
    console.log('Creating account with personal link...');
    const linkCode = generateLinkCode();
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .insert([{ user_id: userId, personal_link_code: linkCode }])
      .select();

    if (accountError) {
      console.error('Account creation error:', accountError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Could not create account: ' + accountError.message })
      };
    }

    console.log('Account created with link code:', linkCode);

    // Initialize SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // Send confirmation email
    const emailTemplate = {
      to: email,
      from: process.env.FROM_EMAIL,
      subject: `Tack för din ansökan - ${process.env.APP_NAME || 'Kakservice'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Tack för din ansökan!</h2>
          <p>Hej ${name},</p>
          <p>Tack för din ansökan till ${process.env.APP_NAME || 'Kakservice'}. Vi har mottagit din ansökan och kommer att kontakta dig inom kort.</p>
          
          <h3>Din ansökan:</h3>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Organisation:</strong> ${organization}</p>
            <p><strong>Grupptyp:</strong> ${groupType}</p>
            ${participants ? `<p><strong>Antal deltagare:</strong> ${participants}</p>` : ''}
            ${goal ? `<p><strong>Mål:</strong> ${goal}</p>` : ''}
            ${experience ? `<p><strong>Erfarenhet:</strong> ${experience}</p>` : ''}
            ${additionalInfo ? `<p><strong>Ytterligare information:</strong> ${additionalInfo}</p>` : ''}
          </div>
          
          <h3>Din personliga länk:</h3>
          <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Dela denna länk för att låta andra beställa från din organisation:</strong></p>
            <p style="font-size: 18px; font-weight: bold; color: #1976d2;">
              ${process.env.SITE_URL || 'https://rad-speculoos-252665.netlify.app'}/order.html?code=${linkCode}
            </p>
            <p><small>Du kan logga in på din dashboard för att se alla beställningar som kommer via denna länk.</small></p>
          </div>
          
          <h3>Logga in på din dashboard:</h3>
          <p><strong>E-post:</strong> ${email}</p>
          <p><strong>Lösenord:</strong> [Det lösenord du angav]</p>
          <p><a href="${process.env.SITE_URL || 'https://rad-speculoos-252665.netlify.app'}/login.html" style="background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Logga in här</a></p>
          
          <p>Vi kommer att kontakta dig för att diskutera nästa steg.</p>
          <p>Med vänliga hälsningar,<br>${process.env.COMPANY_NAME || 'Klass Kraft UF'}</p>
        </div>
      `
    };

    try {
      await sgMail.send(emailTemplate);
      console.log('Confirmation email sent');
    } catch (emailError) {
      console.error('Email error:', emailError);
      // Don't fail the application if email fails
    }

    // Send notification email to admin
    const adminEmailTemplate = {
      to: process.env.ADMIN_EMAIL,
      from: process.env.FROM_EMAIL,
      subject: `Ny ansökan mottagen - ${process.env.APP_NAME || 'Kakservice'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Ny ansökan mottagen!</h2>
          <p>En ny ansökan har mottagits via webbplatsen.</p>
          
          <h3>Ansökningsinformation:</h3>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Namn:</strong> ${name}</p>
            <p><strong>E-post:</strong> ${email}</p>
            <p><strong>Telefon:</strong> ${phone || 'Ej angivet'}</p>
            <p><strong>Organisation:</strong> ${organization}</p>
            <p><strong>Grupptyp:</strong> ${groupType}</p>
            ${participants ? `<p><strong>Antal deltagare:</strong> ${participants}</p>` : ''}
            ${goal ? `<p><strong>Mål:</strong> ${goal}</p>` : ''}
            ${experience ? `<p><strong>Erfarenhet:</strong> ${experience}</p>` : ''}
            ${additionalInfo ? `<p><strong>Ytterligare information:</strong> ${additionalInfo}</p>` : ''}
            <p><strong>IP-adress:</strong> ${ipAddress}</p>
            <p><strong>Personlig länk:</strong> ${process.env.SITE_URL || 'https://rad-speculoos-252665.netlify.app'}/order.html?code=${linkCode}</p>
          </div>
          
          <p>Med vänliga hälsningar,<br>${process.env.COMPANY_NAME || 'Klass Kraft UF'}</p>
        </div>
      `
    };

    try {
      await sgMail.send(adminEmailTemplate);
      console.log('Admin notification email sent');
    } catch (emailError) {
      console.error('Admin email error:', emailError);
      // Don't fail the application if email fails
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        applicationId: application.id,
        linkCode: linkCode,
        message: 'Ansökan skickad framgångsrikt'
      })
    };

  } catch (error) {
    console.error('Application submission error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Ett fel uppstod vid ansökan' })
    };
  }
};