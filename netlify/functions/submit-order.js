// Simple Netlify Function for order submissions
const { createClient } = require('@supabase/supabase-js');
const sgMail = require('@sendgrid/mail');

exports.handler = async (event, context) => {
  console.log('Order function called');
  
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('Parsing request body...');
    const data = JSON.parse(event.body);
    console.log('Data received:', data);

    const {
      accountCode,
      customerName,
      customerEmail,
      customerPhone,
      sellerName,
      orderDetails,
      totalAmount,
      specialRequests,
      termsAccepted,
      termsVersion,
      sessionId
    } = data;

    // Validate required fields
    if (!accountCode || !customerName || !sellerName || !orderDetails) {
      console.log('Missing required fields');
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          required: ['accountCode', 'customerName', 'sellerName', 'orderDetails']
        })
      };
    }

    // Validate terms acceptance
    if (!termsAccepted || termsAccepted !== true) {
      console.log('Terms not accepted');
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Du måste godkänna köpvillkor och sekretesspolicy för att göra en beställning.'
        })
      };
    }

    console.log('Initializing Supabase...');
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('Missing Supabase credentials');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get account information
    console.log('Looking up account with code:', accountCode);
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('personal_link_code', accountCode)
      .single();

    if (accountError || !accountData) {
      console.log('Account lookup error:', accountError);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Beställningslänken är ogiltig' })
      };
    }

    console.log('Account found:', accountData.id);

    // Get application info
    const { data: applicationData, error: appError } = await supabase
      .from('applications')
      .select('organization, name, email')
      .eq('user_id', accountData.user_id)
      .single();

    if (appError || !applicationData) {
      console.log('Application lookup error:', appError);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Kunde inte hitta organisationsinformation' })
      };
    }

    console.log('Application found:', applicationData.organization);

    // Extract IP address and user agent
    const ipAddress = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     event.headers['x-real-ip'] || 
                     event.connection?.remoteAddress || 
                     'Unknown';
    
    const userAgent = event.headers['user-agent'] || 'Unknown';
    
    const acceptedTermsVersion = termsVersion || 'v1.0-2025-01-01';
    const termsAcceptedAt = new Date().toISOString();

    console.log('Terms acceptance data:', {
      termsAccepted,
      termsVersion: acceptedTermsVersion,
      termsAcceptedAt,
      ipAddress: ipAddress.substring(0, 20) + '...', // Log only first 20 chars for privacy
      userAgent: userAgent.substring(0, 50) + '...', // Log only first 50 chars
      sessionId
    });

    // Insert order into database
    console.log('Inserting order...');
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          account_id: accountData.id,
          customer_name: customerName,
          customer_email: customerEmail || null,
          customer_phone: customerPhone || null,
          seller_name: sellerName,
          order_details: orderDetails,
          total_amount: totalAmount,
          status: 'pending',
          terms_accepted: termsAccepted,
          terms_accepted_at: termsAcceptedAt,
          terms_version: acceptedTermsVersion,
          ip_address: ipAddress,
          user_agent: userAgent,
          session_id: sessionId
        }
      ])
      .select();

    if (orderError) {
      console.log('Order insertion error:', orderError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Kunde inte spara beställningen: ' + orderError.message })
      };
    }

    const order = orderData[0];
    console.log('Order created successfully:', order.id);

    // Send confirmation email to customer if email is provided
    if (customerEmail && customerEmail.trim() !== '') {
      try {
        // Initialize SendGrid
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

        // Format product list from order_details
        const productList = Object.values(orderDetails)
          .filter(item => item.quantity > 0)
          .map(item => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.price} kr</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.subtotal} kr</td>
            </tr>
          `)
          .join('');

        // Format order date
        const orderDate = new Date(order.created_at).toLocaleString('sv-SE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        // Format terms accepted date
        const termsAcceptedDate = new Date(termsAcceptedAt).toLocaleString('sv-SE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const siteUrl = process.env.SITE_URL || 'https://rad-speculoos-252665.netlify.app';
        const companyName = process.env.COMPANY_NAME || 'Klass Kraft UF';

        // Create email template
        const emailTemplate = {
          to: customerEmail,
          from: process.env.FROM_EMAIL,
          subject: `Bekräftelse av din beställning - Order ${order.id.substring(0, 8).toUpperCase()}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #203f30 0%, #3f624a 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 28px;">Beställning Bekräftad</h1>
                <p style="margin: 10px 0 0; opacity: 0.9; font-size: 16px;">Tack för din beställning!</p>
              </div>

              <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
                <p>Hej ${customerName},</p>
                <p>Vi har mottagit din beställning och bekräftar att den är registrerad. Beställningen är <strong>bindande</strong> och du är förbunden att betala för beställda produkter enligt köpvillkoren.</p>

                <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
                  <h3 style="color: #166534; margin-top: 0;">✓ Beställning Mottagen</h3>
                  <p style="margin: 5px 0;"><strong>Order-ID:</strong> ${order.id.substring(0, 8).toUpperCase()}</p>
                  <p style="margin: 5px 0;"><strong>Beställningsdatum:</strong> ${orderDate}</p>
                  <p style="margin: 5px 0;"><strong>Organisation:</strong> ${applicationData.organization}</p>
                  ${sellerName ? `<p style="margin: 5px 0;"><strong>Köper från:</strong> ${sellerName}</p>` : ''}
                </div>

                <h3 style="color: #1f2937; margin-top: 30px;">Beställda Produkter</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                  <thead>
                    <tr style="background: #f8fafc;">
                      <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Produkt</th>
                      <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Antal</th>
                      <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Pris/st</th>
                      <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Totalt</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${productList}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="3" style="padding: 12px; text-align: right; border-top: 2px solid #e5e7eb; font-weight: 600; color: #1f2937;">Totalt:</td>
                      <td style="padding: 12px; text-align: right; border-top: 2px solid #e5e7eb; font-weight: 700; font-size: 18px; color: #203f30;">${totalAmount} kr</td>
                    </tr>
                  </tfoot>
                </table>

                ${specialRequests ? `
                  <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                    <h4 style="color: #92400e; margin-top: 0;">Särskilda Önskemål</h4>
                    <p style="margin: 0; color: #78350f;">${specialRequests}</p>
                  </div>
                ` : ''}

                <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                  <h3 style="color: #1e40af; margin-top: 0;">Juridisk Bekräftelse</h3>
                  <p style="margin: 5px 0;"><strong>✓ Du har godkänt köpvillkor och sekretesspolicy</strong></p>
                  <p style="margin: 5px 0;"><strong>Villkorsversion:</strong> ${acceptedTermsVersion}</p>
                  <p style="margin: 5px 0;"><strong>Godkänt datum:</strong> ${termsAcceptedDate}</p>
                  <p style="margin: 10px 0 0; font-size: 14px; color: #374151;">
                    Genom att godkänna villkoren bekräftar du att beställningen är bindande och att du är förbunden att betala för beställda produkter enligt köpvillkoren.
                  </p>
                </div>

                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #1f2937; margin-top: 0;">Godkända Villkor och Sekretesspolicy</h3>
                  <p style="margin: 10px 0;">Du kan läsa de villkor och sekretesspolicy som du godkänt vid beställningstillfället:</p>
                  <div style="margin: 15px 0;">
                    <a href="${siteUrl}/villkor.html" 
                       style="background: #203f30; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 5px 5px 5px 0;">
                      Läs Köpvillkor
                    </a>
                    <a href="${siteUrl}/integritet.html" 
                       style="background: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 5px 0;">
                      Läs Sekretesspolicy
                    </a>
                  </div>
                  <p style="margin: 10px 0 0; font-size: 12px; color: #6b7280;">
                    Version: ${acceptedTermsVersion} | Godkänt: ${termsAcceptedDate}
                  </p>
                </div>

                <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
                  <h3 style="color: #991b1b; margin-top: 0;">⚠️ Viktig Information om Betalning</h3>
                  <p style="margin: 5px 0; color: #7f1d1d;">
                    <strong>Faktura skickas till:</strong> ${applicationData.organization}<br>
                    <strong>Kontaktperson:</strong> ${applicationData.name}<br>
                    <strong>E-post:</strong> ${applicationData.email}
                  </p>
                  <p style="margin: 10px 0 0; font-size: 14px; color: #7f1d1d;">
                    Fakturan kommer att skickas när försäljningsperioden är avslutad. Det är ${applicationData.organization}s ansvar att samla in betalning från sina kunder enligt fakturan.
                  </p>
                </div>

                <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
                  <h3 style="color: #1f2937; margin-top: 0;">Kontaktinformation</h3>
                  <p style="margin: 5px 0;">Om du har frågor om din beställning, kontakta oss:</p>
                  <p style="margin: 5px 0;"><strong>E-post:</strong> <a href="mailto:info@klasskraftuf.se" style="color: #203f30; text-decoration: underline;">info@klasskraftuf.se</a></p>
                  <p style="margin: 5px 0;"><strong>Telefon:</strong> <a href="tel:+46703000000" style="color: #203f30; text-decoration: underline;">070-300 00 00</a></p>
                </div>

                <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280;">
                  Med vänliga hälsningar,<br>
                  <strong>${companyName}</strong>
                </p>
              </div>

              <div style="background: #f8fafc; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; border: 1px solid #e5e7eb; border-top: none;">
                <p style="margin: 0; font-size: 12px; color: #6b7280;">
                  Detta är en automatisk bekräftelse. Svara inte på detta e-postmeddelande.<br>
                  Order-ID: ${order.id} | Session-ID: ${sessionId || 'N/A'}
                </p>
              </div>
            </div>
          `
        };

        await sgMail.send(emailTemplate);
        console.log('Order confirmation email sent to:', customerEmail);
      } catch (emailError) {
        console.error('Email error:', emailError);
        // Don't fail the order if email fails
        console.log('Order saved successfully, but email could not be sent');
      }
    } else {
      console.log('No customer email provided, skipping confirmation email');
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
    console.log('Order submission error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Ett fel uppstod vid beställningen: ' + error.message })
    };
  }
};
