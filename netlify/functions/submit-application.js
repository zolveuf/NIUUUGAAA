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

// Handle order submissions
async function handleOrderSubmission(data) {
  try {
    const {
      accountCode,
      customerName,
      customerEmail,
      customerPhone,
      orderDetails,
      totalAmount,
      specialRequests
    } = data;

    // Validate required fields
    if (!accountCode || !customerName || !orderDetails) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          required: ['accountCode', 'customerName', 'orderDetails']
        })
      };
    }

    // Initialize Supabase client with service role key for backend operations
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get account information
    console.log('Looking up account with code:', accountCode);
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .select(`
        *,
        applications!inner(
          organization,
          name,
          email,
          group_type
        )
      `)
      .eq('personal_link_code', accountCode)
      .single();

    if (accountError || !accountData) {
      console.error('Account lookup error:', accountError);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Beställningslänken är ogiltig' })
      };
    }

    console.log('Account found:', accountData.id);

    // Insert order into database
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          account_id: accountData.id,
          customer_name: customerName,
          customer_email: customerEmail || null,
          customer_phone: customerPhone || null,
          order_details: orderDetails,
          total_amount: totalAmount,
          status: 'pending'
        }
      ])
      .select();

    if (orderError) {
      console.error('Order insertion error:', orderError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Kunde inte spara beställningen: ' + orderError.message })
      };
    }

    const order = orderData[0];
    console.log('Order created:', order.id);

    // Initialize SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // Send confirmation email to customer (if email provided)
    if (customerEmail) {
      const customerEmailTemplate = {
        to: customerEmail,
        from: process.env.FROM_EMAIL,
        subject: `Beställningsbekräftelse - ${process.env.APP_NAME || 'Kakservice'}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Tack för din beställning!</h2>
            <p>Hej ${customerName},</p>
            <p>Tack för din beställning från ${accountData.applications.organization}. Vi har mottagit din beställning och kommer att kontakta dig inom kort.</p>
            
            <h3>Din beställning:</h3>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              ${Object.values(orderDetails).map(item => `
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span>${item.name} x${item.quantity}</span>
                  <span>${item.subtotal} kr</span>
                </div>
              `).join('')}
              <hr style="margin: 15px 0;">
              <div style="display: flex; justify-content: space-between; font-weight: bold;">
                <span>Totalt:</span>
                <span>${totalAmount} kr</span>
              </div>
            </div>
            
            ${specialRequests ? `<p><strong>Särskilda önskemål:</strong> ${specialRequests}</p>` : ''}
            
            <p>Vi kommer att kontakta dig för att bekräfta beställningen och diskutera leverans.</p>
            <p>Med vänliga hälsningar,<br>${process.env.COMPANY_NAME || 'Klass Kraft UF'}</p>
          </div>
        `
      };

      try {
        await sgMail.send(customerEmailTemplate);
        console.log('Customer confirmation email sent');
      } catch (emailError) {
        console.error('Customer email error:', emailError);
        // Don't fail the order if email fails
      }
    }

    // Send notification email to account owner
    const ownerEmailTemplate = {
      to: accountData.applications.email,
      from: process.env.FROM_EMAIL,
      subject: `Ny beställning mottagen - ${process.env.APP_NAME || 'Kakservice'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Ny beställning mottagen!</h2>
          <p>Hej ${accountData.applications.name},</p>
          <p>Du har fått en ny beställning via din personliga länk.</p>
            
          <h3>Beställningsinformation:</h3>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Kund:</strong> ${customerName}</p>
            ${customerEmail ? `<p><strong>E-post:</strong> ${customerEmail}</p>` : ''}
            ${customerPhone ? `<p><strong>Telefon:</strong> ${customerPhone}</p>` : ''}
            
            <h4>Beställda produkter:</h4>
            ${Object.values(orderDetails).map(item => `
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>${item.name} x${item.quantity}</span>
                <span>${item.subtotal} kr</span>
              </div>
            `).join('')}
            <hr style="margin: 15px 0;">
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <span>Totalt:</span>
              <span>${totalAmount} kr</span>
            </div>
          </div>
          
          ${specialRequests ? `<p><strong>Särskilda önskemål:</strong> ${specialRequests}</p>` : ''}
          
          <p><strong>Logga in på din dashboard för att se alla beställningar:</strong></p>
          <p><a href="${process.env.SITE_URL || 'https://rad-speculoos-252665.netlify.app'}/dashboard.html" style="background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Öppna Dashboard</a></p>
          
          <p>Med vänliga hälsningar,<br>${process.env.COMPANY_NAME || 'Klass Kraft UF'}</p>
        </div>
      `
    };

    try {
      await sgMail.send(ownerEmailTemplate);
      console.log('Owner notification email sent');
    } catch (emailError) {
      console.error('Owner email error:', emailError);
      // Don't fail the order if email fails
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        orderId: order.id,
        message: 'Beställning skickad framgångsrikt'
      })
    };

  } catch (error) {
    console.error('Order submission error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Ett fel uppstod vid beställningen' })
    };
  }
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
    // Parse request body once
    const data = JSON.parse(event.body);
    
    // Check if this is an order submission (has accountCode)
    if (data.accountCode) {
      return handleOrderSubmission(data);
    }
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

    // Create user account with Supabase Auth
    console.log('Creating user with email:', email);
    let userId;
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
      
      // If user already exists, try to get the existing user
      if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
        console.log('User already exists, attempting to get user by email');
        
        // Try to get user by email using listUsers and filter
        const { data: users, error: listError } = await supabase.auth.admin.listUsers();
        
        if (listError) {
          console.error('Error listing users:', listError);
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Could not check existing users: ' + listError.message })
          };
        }
        
        const existingUser = users.users.find(user => user.email === email);
        if (existingUser) {
          console.log('Found existing user:', existingUser.id);
          userId = existingUser.id;
        } else {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'User creation failed and user not found: ' + authError.message })
          };
        }
      } else {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Account creation failed: ' + authError.message })
        };
      }
    } else {
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

    // Create account with personal link code
    console.log('Creating account with personal link for user:', userId);
    const linkCode = generateLinkCode();
    
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .insert([
        {
          user_id: userId,
          personal_link_code: linkCode
        }
      ])
      .select();

    if (accountError) {
      console.error('Account creation error:', accountError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Account creation failed: ' + accountError.message })
      };
    }

    console.log('Account created with link code:', linkCode);

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
          
          <h3>Din personliga beställningslänk:</h3>
          <p>Dela denna länk med dina kunder så att de kan lägga beställningar:</p>
          <p style="background: #f0f9ff; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 18px; text-align: center;">
            <strong>${process.env.SITE_URL || 'https://rad-speculoos-252665.netlify.app'}/order.html?code=${linkCode}</strong>
          </p>
          <p><em>Alla beställningar som görs via denna länk kommer att visas på din dashboard!</em></p>
          
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
