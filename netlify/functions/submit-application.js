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
    if (!name || !email || !organization || !groupType || !termsAccepted) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          required: ['name', 'email', 'organization', 'groupType', 'termsAccepted']
        })
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

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
