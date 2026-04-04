// Simple Netlify Function for order submissions
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

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
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const fromEmail = process.env.FROM_EMAIL || 'klasskraftuf@gmail.com';
    if (!smtpUser || !smtpPass) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'E-postkonfiguration saknas. Kontakta support.' })
      };
    }
    const smtpHost = process.env.SMTP_HOST || 'smtp.strato.com';
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpSecure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : smtpPort === 465;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

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

    // Debug: Log order details to see what we're saving
    console.log('Order details being saved to database:', JSON.stringify(orderDetails, null, 2));
    // Log each item to verify size is included
    Object.values(orderDetails).forEach(item => {
      console.log(`Saving item: ${item.name}, Size: ${item.size || 'NO SIZE'}, Item keys:`, Object.keys(item));
    });
    
    // Ensure order_details is properly formatted and size is preserved
    // Convert orderDetails to ensure all properties are preserved
    const formattedOrderDetails = {};
    Object.keys(orderDetails).forEach(key => {
      const item = orderDetails[key];
      formattedOrderDetails[key] = {
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.subtotal
      };
      // Explicitly preserve size if it exists
      if (item.size !== undefined && item.size !== null && String(item.size).trim() !== '') {
        formattedOrderDetails[key].size = String(item.size).trim();
        console.log(`Preserving size "${formattedOrderDetails[key].size}" for ${item.name}`);
      }
    });
    
    console.log('Formatted order details:', JSON.stringify(formattedOrderDetails, null, 2));
    
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
          order_details: formattedOrderDetails, // Use formatted version
          total_amount: totalAmount,
          special_requests: specialRequests || null,
          status: 'pending'
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
    // Debug: Verify order_details was saved correctly
    console.log('Order details in saved order:', JSON.stringify(order.order_details, null, 2));
    if (order.order_details && typeof order.order_details === 'object') {
      Object.values(order.order_details).forEach(item => {
        console.log(`Saved item: ${item.name}, Size in DB: ${item.size || 'NO SIZE IN DATABASE'}`);
      });
    }

    // Send confirmation email to customer if email is provided
    if (customerEmail && customerEmail.trim() !== '') {
      try {
        // Format product list from order_details
        const productList = Object.values(orderDetails)
          .filter(item => item.quantity > 0)
          .map(item => {
            console.log('Processing item for customer email:', item);
            console.log('Item keys:', Object.keys(item || {}));
            console.log('Item size:', item.size);
            
            // Check for size in multiple ways to be sure
            const size = item.size || item.Size || item.STORLEK || item.storlek;
            let productName = item.name;
            if (size && String(size).trim() !== '') {
              const sizeStr = String(size).trim();
              productName += ` <span style="background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-weight: bold; margin-left: 8px;">STORLEK: ${sizeStr}</span>`;
              console.log('Added size to customer email item:', sizeStr);
            } else {
              console.log('No size found for customer email item:', item.name);
            }
            return `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${productName}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.price} kr</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.subtotal} kr</td>
            </tr>
          `;
          })
          .join('');

        // Format order date
        const orderDate = new Date(order.created_at).toLocaleString('sv-SE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const siteUrl = process.env.SITE_URL || 'https://klasskraft.se';
        const companyName = process.env.COMPANY_NAME || 'Klass Kraft UF';

        // Create email template
        const emailTemplate = {
          to: customerEmail,
          from: fromEmail,
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
                  <p style="margin: 5px 0;"><strong>E-post:</strong> <a href="mailto:klasskraftuf@gmail.com" style="color: #203f30; text-decoration: underline;">klasskraftuf@gmail.com</a></p>
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
                <p style="margin: 10px 0 0; font-size: 11px; color: #9ca3af;">
                  <strong>Hittar du inte mailet?</strong> Kontrollera din skräppost/spam-mapp.
                </p>
              </div>
            </div>
          `
        };

        await transporter.sendMail(emailTemplate);
        console.log('Order confirmation email sent to:', customerEmail);
      } catch (emailError) {
        console.error('Email error:', emailError);
        // Don't fail the order if email fails
        console.log('Order saved successfully, but email could not be sent');
      }
    } else {
      console.log('No customer email provided, skipping confirmation email');
    }

    // Send notification email to contact person
    try {
      // Format product list from order_details
      const productList = Object.values(orderDetails)
        .filter(item => item.quantity > 0)
        .map(item => {
          console.log('Processing item for contact person email:', item);
          console.log('Item keys:', Object.keys(item || {}));
          console.log('Item size:', item.size);
          
          // Check for size in multiple ways to be sure
          const size = item.size || item.Size || item.STORLEK || item.storlek;
          let productName = item.name;
          if (size && String(size).trim() !== '') {
            const sizeStr = String(size).trim();
            productName += ` <span style="background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-weight: bold; margin-left: 8px;">STORLEK: ${sizeStr}</span>`;
            console.log('Added size to contact person email item:', sizeStr);
          } else {
            console.log('No size found for contact person email item:', item.name);
          }
          return `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${productName}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.price} kr</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.subtotal} kr</td>
          </tr>
        `;
        })
        .join('');

      // Format order date
      const orderDate = new Date(order.created_at).toLocaleString('sv-SE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const siteUrl = process.env.SITE_URL || 'https://klasskraft.se';
      const companyName = process.env.COMPANY_NAME || 'Klass Kraft UF';

      const contactEmailTemplate = {
        to: applicationData.email,
        from: fromEmail,
        subject: `Ny beställning mottagen - ${applicationData.organization}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #203f30 0%, #3f624a 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">Ny Beställning!</h1>
              <p style="margin: 10px 0 0; opacity: 0.9; font-size: 16px;">En ny beställning har mottagits</p>
            </div>

            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Hej ${applicationData.name},</p>
              <p>En ny beställning har registrerats för <strong>${applicationData.organization}</strong>!</p>

              <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                <h3 style="color: #1e40af; margin-top: 0;">📋 Beställningsinformation</h3>
                <p style="margin: 5px 0;"><strong>Order-ID:</strong> ${order.id.substring(0, 8).toUpperCase()}</p>
                <p style="margin: 5px 0;"><strong>Beställningsdatum:</strong> ${orderDate}</p>
                <p style="margin: 5px 0;"><strong>Kund:</strong> ${customerName}</p>
                ${customerEmail ? `<p style="margin: 5px 0;"><strong>Kundens e-post:</strong> ${customerEmail}</p>` : ''}
                ${customerPhone ? `<p style="margin: 5px 0;"><strong>Kundens telefon:</strong> ${customerPhone}</p>` : ''}
                <p style="margin: 5px 0;"><strong>Köper från:</strong> ${sellerName}</p>
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

              <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #16a34a;">
                <p style="margin: 0; font-size: 16px;">
                  <a href="${siteUrl}/dashboard.html" style="background: #203f30; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">
                    👁️ Visa alla beställningar i dashboard
                  </a>
                </p>
              </div>

              <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280;">
                Med vänliga hälsningar,<br>
                <strong>${companyName}</strong>
              </p>
            </div>

            <div style="background: #f8fafc; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; border: 1px solid #e5e7eb; border-top: none;">
              <p style="margin: 0; font-size: 12px; color: #6b7280;">
                Detta är en automatisk notifiering. Svara inte på detta e-postmeddelande.<br>
                Order-ID: ${order.id}
              </p>
              <p style="margin: 10px 0 0; font-size: 11px; color: #9ca3af;">
                <strong>Hittar du inte mailet?</strong> Kontrollera din skräppost/spam-mapp.
              </p>
            </div>
          </div>
        `
      };

      await transporter.sendMail(contactEmailTemplate);
      console.log('Order notification email sent to contact person:', applicationData.email);
    } catch (contactEmailError) {
      console.error('Contact email error:', contactEmailError);
      // Don't fail the order if contact email fails
      console.log('Order saved successfully, but contact email could not be sent');
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
