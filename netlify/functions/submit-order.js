// Netlify Function for handling order submissions
const { createClient } = require('@supabase/supabase-js');
const sgMail = require('@sendgrid/mail');

console.log('submit-order function loaded');

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
};
