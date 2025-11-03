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
    
    // Check if this is a send-order request
    if (data.orderId && data.action === 'send-to-kakservice') {
      return await handleSendOrderToKakservice(data);
    }
    
    // Check if this is a send-all-orders request
    if (data.action === 'send-all-orders-to-kakservice') {
      return await handleSendAllOrdersToKakservice(data);
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

    // Create account with personal link code and pending status
    console.log('Creating account with personal link...');
    const linkCode = generateLinkCode();
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .insert([{ 
        user_id: userId, 
        personal_link_code: linkCode,
        status: 'pending'
      }])
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
          
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #f59e0b;">
            <h3 style="color: #92400e; margin-top: 0;">⏳ Din ansökan behandlas</h3>
            <p><strong>Status:</strong> Väntar på godkännande</p>
            <p>Vi kommer att granska din ansökan och godkänna ditt konto inom 24 timmar. Du kommer att få ett e-post när ditt konto är godkänt.</p>
            <p><strong>Du kan INTE logga in förrän vi har godkänt ditt konto.</strong></p>
          </div>
          
          <h3>Din personliga länk:</h3>
          <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Dela denna länk för att låta andra beställa från din organisation:</strong></p>
            <p style="font-size: 18px; font-weight: bold; color: #1976d2;">
              ${process.env.SITE_URL || 'https://klasskraft.se'}/order.html?code=${linkCode}
            </p>
            <p><small>Du kan logga in på din dashboard för att se alla beställningar som kommer via denna länk (efter godkännande).</small></p>
          </div>
          
          <h3>Logga in på din dashboard:</h3>
          <p><strong>E-post:</strong> ${email}</p>
          <p><strong>Lösenord:</strong> [Det lösenord du angav]</p>
          <p><a href="${process.env.SITE_URL || 'https://klasskraft.se'}/login.html" style="background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Logga in här</a></p>
          
          <p>Vi kommer att kontakta dig för att diskutera nästa steg när ditt konto är godkänt.</p>
          <p>Med vänliga hälsningar,<br>${process.env.COMPANY_NAME || 'Klass Kraft UF'}</p>
          
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; font-size: 12px; color: #78350f;">
              <strong>Tips:</strong> Om du inte ser detta e-postmeddelande, kontrollera din skräppost.
            </p>
          </div>
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

    // Send notification email to admin with approval links
    const adminEmailTemplate = {
      to: process.env.ADMIN_EMAIL,
      from: process.env.FROM_EMAIL,
      subject: `🔔 Ny ansökan väntar på godkännande - ${process.env.APP_NAME || 'Kakservice'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">🔔 Ny ansökan väntar på godkännande!</h2>
          <p>En ny ansökan har mottagits via webbplatsen och väntar på ditt godkännande.</p>
          
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
            <p><strong>Personlig länk:</strong> ${process.env.SITE_URL || 'https://klasskraft.se'}/order.html?code=${linkCode}</p>
            <p><strong>Konto-ID:</strong> ${accountData[0].id}</p>
          </div>
          
          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #fecaca;">
            <h3 style="color: #dc2626; margin-top: 0;">⚠️ Viktigt: Konto är inaktiverat</h3>
            <p>Användaren kan INTE logga in förrän du godkänner kontot.</p>
            <p><strong>Status:</strong> <span style="color: #dc2626; font-weight: bold;">VÄNTAR PÅ GODKÄNNANDE</span></p>
          </div>
          
          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #166534; margin-top: 0;">Godkänn eller avvis kontot:</h3>
            <p>Klicka på länkarna nedan för att godkänna eller avvisa detta konto:</p>
            
            <div style="margin: 20px 0; text-align: center;">
              <a href="${process.env.SITE_URL || 'https://klasskraft.se'}/admin-approve.html?action=approve&accountId=${accountData[0].id}&key=${process.env.ADMIN_APPROVAL_KEY}" 
                 style="background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 0 10px;">
                ✅ Godkänn konto
              </a>
              
              <a href="${process.env.SITE_URL || 'https://klasskraft.se'}/admin-approve.html?action=reject&accountId=${accountData[0].id}&key=${process.env.ADMIN_APPROVAL_KEY}" 
                 style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 0 10px;">
                ❌ Avvis konto
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280;">
              <strong>Alternativt:</strong> Du kan också logga in på admin-panelen för att hantera godkännanden.
            </p>
          </div>
          
          <p>Med vänliga hälsningar,<br>${process.env.COMPANY_NAME || 'Klass Kraft UF'}</p>
          
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; font-size: 12px; color: #78350f;">
              <strong>Tips:</strong> Om du inte ser detta e-postmeddelande, kontrollera din skräppost.
            </p>
          </div>
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

// Function to handle sending orders to Kakservice
async function handleSendOrderToKakservice(data) {
  try {
    const { orderId } = data;
    
    console.log('Sending order to Kakservice:', orderId);

    // Initialize Supabase client with service role key
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    console.log('Fetching order details for:', orderId);

    // Fetch order details first
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('Error fetching order:', orderError);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Order not found' })
      };
    }

    console.log('Order found:', order);

    // Fetch account details
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', order.account_id)
      .single();

    if (accountError) {
      console.error('Error fetching account:', accountError);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Account not found' })
      };
    }

    console.log('Account found:', account);

    // Fetch application details
    const { data: application, error: applicationError } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', account.user_id)
      .single();

    if (applicationError) {
      console.error('Error fetching application:', applicationError);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Application not found' })
      };
    }

    console.log('Application found:', application);

    // Parse order details
    const orderDetails = order.order_details || {};
    const orderItems = Object.values(orderDetails)
      .filter(item => item.quantity > 0)
      .map(item => `• ${item.name} x${item.quantity} - ${item.subtotal} kr`)
      .join('\n');

    // Get application info
    const accountCode = account.personal_link_code;

    // Create comprehensive order summary
    const orderSummary = `
BESTÄLLNING TILL KAKSERVICE
============================

FÖRENING/ORGANISATION:
• Namn: ${application.name}
• Organisation: ${application.organization}
• Typ: ${getGroupTypeText(application.group_type)}
• Kontakt: ${application.email}
• Telefon: ${application.phone || 'Ej angiven'}

BESTÄLLNINGSDETAILS:
• Beställnings-ID: ${order.id}
• Beställningskod: ${accountCode}
• Datum: ${new Date(order.created_at).toLocaleDateString('sv-SE')} kl ${new Date(order.created_at).toLocaleTimeString('sv-SE')}

KUNDINFORMATION:
• Namn: ${order.customer_name}
• E-post: ${order.customer_email || 'Ej angiven'}
• Telefon: ${order.customer_phone || 'Ej angiven'}

PRODUKTER:
${orderItems}

TOTAL SUMMA: ${order.total_amount} kr

SPECIELLA ÖNSKNINGAR:
${order.special_requests || 'Inga speciella önskemål'}

STATUS: ${getOrderStatusText(order.status)}

---
Detta är en automatisk beställning från Kakservice-plattformen.
Föreningen: ${application.organization}
Beställningslänk: ${process.env.SITE_URL || 'https://klasskraft.se'}/order.html?code=${accountCode}
    `.trim();

    // Send email to Kakservice
    const msg = {
      to: process.env.ADMIN_EMAIL || 'martinpranjic32@gmail.com',
      from: process.env.FROM_EMAIL || 'noreply@klasskraft.se',
      subject: `🍪 Ny beställning från ${application.organization} - ${order.total_amount} kr`,
      text: orderSummary,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">🍪 Ny beställning från Kakservice-plattformen</h2>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #374151; margin-top: 0;">Förening/Organisation</h3>
            <p><strong>Namn:</strong> ${application.name}</p>
            <p><strong>Organisation:</strong> ${application.organization}</p>
            <p><strong>Typ:</strong> ${getGroupTypeText(application.group_type)}</p>
            <p><strong>Kontakt:</strong> ${application.email}</p>
            <p><strong>Telefon:</strong> ${application.phone || 'Ej angiven'}</p>
          </div>

          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #92400e; margin-top: 0;">Beställningsdetaljer</h3>
            <p><strong>Beställnings-ID:</strong> ${order.id}</p>
            <p><strong>Beställningskod:</strong> ${accountCode}</p>
            <p><strong>Datum:</strong> ${new Date(order.created_at).toLocaleDateString('sv-SE')} kl ${new Date(order.created_at).toLocaleTimeString('sv-SE')}</p>
          </div>

          <div style="background: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin-top: 0;">Kundinformation</h3>
            <p><strong>Namn:</strong> ${order.customer_name}</p>
            <p><strong>E-post:</strong> ${order.customer_email || 'Ej angiven'}</p>
            <p><strong>Telefon:</strong> ${order.customer_phone || 'Ej angiven'}</p>
          </div>

          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #166534; margin-top: 0;">Produkter</h3>
            <div style="white-space: pre-line;">${orderItems}</div>
            <p style="font-size: 18px; font-weight: bold; color: #166534; margin-top: 15px;">
              TOTAL SUMMA: ${order.total_amount} kr
            </p>
          </div>

          ${order.special_requests ? `
          <div style="background: #fdf2f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #be185d; margin-top: 0;">Speciella önskemål</h3>
            <p>${order.special_requests}</p>
          </div>
          ` : ''}

          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="color: #6b7280; font-size: 14px;">
              Detta är en automatisk beställning från Kakservice-plattformen<br>
              <strong>Förening:</strong> ${application.organization}<br>
                <strong>Beställningslänk:</strong> <a href="${process.env.SITE_URL || 'https://klasskraft.se'}/order.html?code=${accountCode}">${process.env.SITE_URL || 'https://klasskraft.se'}/order.html?code=${accountCode}</a>
            </p>
            <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
              <strong>Tips:</strong> Om du inte ser detta e-postmeddelande, kontrollera din skräppost.
            </p>
          </div>
        </div>
      `
    };

    console.log('Sending email to Kakservice...');
    await sgMail.send(msg);
    console.log('Email sent successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        message: 'Beställningen har skickats till Kakservice'
      })
    };

  } catch (error) {
    console.error('Error sending order to Kakservice:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Ett fel uppstod vid skickandet av beställningen' })
    };
  }
}

// Helper functions
function getGroupTypeText(groupType) {
  const typeMap = {
    'sports': 'Idrottslag',
    'school': 'Skolklass',
    'association': 'Förening',
    'other': 'Annat'
  };
  return typeMap[groupType] || groupType;
}

function getOrderStatusText(status) {
  const statusMap = {
    'pending': 'Väntar',
    'confirmed': 'Bekräftad',
    'shipped': 'Skickad',
    'delivered': 'Levererad',
    'cancelled': 'Avbruten'
  };
  return statusMap[status] || status;
}

// Function to handle sending all orders to Kakservice
async function handleSendAllOrdersToKakservice(data) {
  try {
    const { orders } = data;
    
    console.log('Sending all orders to Kakservice:', orders.length);

    if (!orders || orders.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No orders to send' })
      };
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // Get account and application info for the first order
    const firstOrder = orders[0];
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', firstOrder.account_id)
      .single();

    if (accountError) {
      console.error('Error fetching account:', accountError);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Account not found' })
      };
    }

    const { data: application, error: applicationError } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', account.user_id)
      .single();

    if (applicationError) {
      console.error('Error fetching application:', applicationError);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Application not found' })
      };
    }

    console.log('Account and application found:', { account, application });

    // Create comprehensive order summary for all orders
    let allOrderItems = '';
    let totalSum = 0;
    let orderCount = 0;

    orders.forEach((order, index) => {
      const orderDetails = order.order_details || {};
      const orderItems = Object.values(orderDetails)
        .filter(item => item.quantity > 0)
        .map(item => `• ${item.name} x${item.quantity} - ${item.subtotal} kr`)
        .join('\n');

      allOrderItems += `\n\nBESTÄLLNING ${index + 1}:\n`;
      allOrderItems += `• Beställnings-ID: ${order.id}\n`;
      allOrderItems += `• Kund: ${order.customer_name}\n`;
      allOrderItems += `• E-post: ${order.customer_email || 'Ej angiven'}\n`;
      allOrderItems += `• Telefon: ${order.customer_phone || 'Ej angiven'}\n`;
      allOrderItems += `• Datum: ${new Date(order.created_at).toLocaleDateString('sv-SE')} kl ${new Date(order.created_at).toLocaleTimeString('sv-SE')}\n`;
      allOrderItems += `• Produkter:\n${orderItems}\n`;
      allOrderItems += `• Summa: ${order.total_amount} kr\n`;
      if (order.special_requests) {
        allOrderItems += `• Speciella önskemål: ${order.special_requests}\n`;
      }

      totalSum += order.total_amount || 0;
      orderCount++;
    });

    const orderSummary = `
ALLA BESTÄLLNINGAR TILL KAKSERVICE
==================================

FÖRENING/ORGANISATION:
• Namn: ${application.name}
• Organisation: ${application.organization}
• Typ: ${getGroupTypeText(application.group_type)}
• Kontakt: ${application.email}
• Telefon: ${application.phone || 'Ej angiven'}

SAMMANFATTNING:
• Antal beställningar: ${orderCount}
• Total summa: ${totalSum} kr
• Beställningskod: ${account.personal_link_code}

DETALJERADE BESTÄLLNINGAR:${allOrderItems}

---
Detta är en automatisk sammanfattning av alla beställningar från Kakservice-plattformen.
Föreningen: ${application.organization}
Beställningslänk: ${process.env.SITE_URL || 'https://klasskraft.se'}/order.html?code=${account.personal_link_code}
    `.trim();

    // Send email to Kakservice
    const msg = {
      to: process.env.ADMIN_EMAIL || 'martinpranjic32@gmail.com',
      from: process.env.FROM_EMAIL || 'noreply@klasskraft.se',
      subject: `🍪 ${orderCount} beställningar från ${application.organization} - ${totalSum} kr`,
      text: orderSummary,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">🍪 ${orderCount} beställningar från Kakservice-plattformen</h2>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #374151; margin-top: 0;">Förening/Organisation</h3>
            <p><strong>Namn:</strong> ${application.name}</p>
            <p><strong>Organisation:</strong> ${application.organization}</p>
            <p><strong>Typ:</strong> ${getGroupTypeText(application.group_type)}</p>
            <p><strong>Kontakt:</strong> ${application.email}</p>
            <p><strong>Telefon:</strong> ${application.phone || 'Ej angiven'}</p>
          </div>

          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #92400e; margin-top: 0;">Sammanfattning</h3>
            <p><strong>Antal beställningar:</strong> ${orderCount}</p>
            <p><strong>Total summa:</strong> ${totalSum} kr</p>
            <p><strong>Beställningskod:</strong> ${account.personal_link_code}</p>
          </div>

          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #166534; margin-top: 0;">Detaljerade beställningar</h3>
            <div style="white-space: pre-line; font-family: monospace; font-size: 14px;">${allOrderItems}</div>
          </div>

          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="color: #6b7280; font-size: 14px;">
              Detta är en automatisk sammanfattning av alla beställningar från Kakservice-plattformen<br>
              <strong>Förening:</strong> ${application.organization}<br>
              <strong>Beställningslänk:</strong> <a href="${process.env.SITE_URL || 'https://klasskraft.se'}/order.html?code=${account.personal_link_code}">${process.env.SITE_URL || 'https://klasskraft.se'}/order.html?code=${account.personal_link_code}</a>
            </p>
            <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
              <strong>Tips:</strong> Om du inte ser detta e-postmeddelande, kontrollera din skräppost.
            </p>
          </div>
        </div>
      `
    };

    console.log('Sending bulk email to Kakservice...');
    await sgMail.send(msg);
    console.log('Bulk email sent successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        message: `Alla ${orderCount} beställningar har skickats till Kakservice`,
        orderCount: orderCount,
        totalSum: totalSum
      })
    };

  } catch (error) {
    console.error('Error sending all orders to Kakservice:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Ett fel uppstod vid skickandet av beställningarna' })
    };
  }
}