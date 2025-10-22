// Netlify Function for handling form submissions
const { createClient } = require('@supabase/supabase-js');
const sgMail = require('@sendgrid/mail');

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
      timeline,
      newsletter,
      termsAccepted
    } = data;

    // Validate required fields
    if (!name || !email || !password || !organization || !groupType || !termsAccepted) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          required: ['name', 'email', 'password', 'organization', 'groupType', 'termsAccepted']
        })
      };
    }

    // Validate password
    if (password.length < 8) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Password must be at least 8 characters' })
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid email format' })
      };
    }

    // Initialize Supabase client with service role key for backend operations
    const supabaseUrl = process.env.SUPABASE_URL;
    // Use service role key for backend, it bypasses RLS
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if user already exists
    console.log('Checking if user exists with email:', email);
    const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email);
    
    let userId;
    if (existingUser.user) {
      console.log('User already exists:', existingUser.user.id);
      userId = existingUser.user.id;
    } else {
      // First, create user account with Supabase Auth
      console.log('Creating new user with email:', email);
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          name: name,
          organization: organization,
          group_type: groupType
        }
      });

      if (authError) {
        console.error('Auth error:', authError);
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Account creation failed: ' + authError.message })
        };
      }

      console.log('User created successfully:', authData.user.id);
      userId = authData.user.id;
    }

    // Get client IP and user agent
    // x-forwarded-for can contain multiple IPs, take the first one
    const forwardedFor = event.headers['x-forwarded-for'] || event.headers['client-ip'] || '';
    const ipAddress = forwardedFor.split(',')[0].trim() || null;
    const userAgent = event.headers['user-agent'];

    // Insert application into Supabase
    const { data: applicationData, error } = await supabase
      .from('applications')
      .insert([
        {
          user_id: userId, // Link to auth user
          name,
          email,
          phone: phone || null,
          organization,
          group_type: groupType,
          participants: participants || null,
          goal: goal || null,
          timeline: timeline || null,
          newsletter: newsletter || false,
          terms_accepted: termsAccepted,
          ip_address: ipAddress,
          user_agent: userAgent
        }
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Database error: ' + error.message })
      };
    }

    const application = applicationData[0];

    // Initialize SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // Send confirmation email to user
    const userEmailTemplate = {
      to: email,
      from: process.env.FROM_EMAIL,
      subject: `Tack för din ansökan - ${process.env.APP_NAME || 'Kakservice'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Tack för din ansökan!</h2>
          <p>Hej ${name},</p>
          <p>Tack för att du har ansökt om att börja sälja med oss. Vi har mottagit din ansökan och kommer att kontakta dig inom 24 timmar.</p>
          
          <h3>Din ansökan:</h3>
          <ul>
            <li><strong>Organisation:</strong> ${organization}</li>
            <li><strong>Typ av grupp:</strong> ${groupType}</li>
            <li><strong>Antal deltagare:</strong> ${participants || 'Inte angivet'}</li>
            <li><strong>Tidsram:</strong> ${timeline || 'Inte angivet'}</li>
          </ul>
          
          <h3>Ditt konto:</h3>
          <p>Vi har skapat ett konto åt dig så att du kan logga in och följa din ansökan:</p>
          <ul>
            <li><strong>E-post:</strong> ${email}</li>
            <li><strong>Lösenord:</strong> Det du angav i formuläret</li>
          </ul>
          
          <p><strong>Logga in här:</strong> <a href="${process.env.SITE_URL || 'https://rad-speculoos-252665.netlify.app'}/login.html">login.html</a></p>
          
          <p>Vi ser fram emot att hjälpa er att nå era mål!</p>
          <p>Med vänliga hälsningar,<br>${process.env.COMPANY_NAME || 'Klass Kraft UF'}</p>
        </div>
      `
    };

    // Send notification email to admin
    const adminEmailTemplate = {
      to: process.env.ADMIN_EMAIL,
      from: process.env.FROM_EMAIL,
      subject: `Ny ansökan från ${name} - ${organization}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Ny ansökan mottagen</h2>
          
          <h3>Kontaktinformation:</h3>
          <ul>
            <li><strong>Namn:</strong> ${name}</li>
            <li><strong>E-post:</strong> ${email}</li>
            <li><strong>Telefon:</strong> ${phone || 'Inte angivet'}</li>
          </ul>
          
          <h3>Organisation:</h3>
          <ul>
            <li><strong>Organisation:</strong> ${organization}</li>
            <li><strong>Typ av grupp:</strong> ${groupType}</li>
            <li><strong>Antal deltagare:</strong> ${participants || 'Inte angivet'}</li>
            <li><strong>Tidsram:</strong> ${timeline || 'Inte angivet'}</li>
          </ul>
          
          <h3>Mål:</h3>
          <p>${goal || 'Inte angivet'}</p>
          
          <h3>Inställningar:</h3>
          <ul>
            <li><strong>Nyhetsbrev:</strong> ${newsletter ? 'Ja' : 'Nej'}</li>
            <li><strong>Villkor accepterade:</strong> ${termsAccepted ? 'Ja' : 'Nej'}</li>
          </ul>
          
          <p><strong>Ansökan ID:</strong> ${application.id}</p>
          <p><strong>Skapad:</strong> ${new Date().toLocaleString('sv-SE')}</p>
        </div>
      `
    };

    // Send emails
    try {
      await sgMail.send([userEmailTemplate, adminEmailTemplate]);
    } catch (emailError) {
      console.error('SendGrid error:', emailError);
      // Don't fail the request if email fails
    }

    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Application submitted successfully',
        applicationId: application.id
      })
    };

  } catch (error) {
    console.error('Server error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error: ' + error.message })
    };
  }
};
