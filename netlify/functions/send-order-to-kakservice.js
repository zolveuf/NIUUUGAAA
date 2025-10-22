const { createClient } = require('@supabase/supabase-js');
const sgMail = require('@sendgrid/mail');

console.log('send-order-to-kakservice function loaded');

exports.handler = async (event, context) => {
  console.log('=== SEND ORDER TO KAKSERVICE FUNCTION CALLED ===');
  console.log('Method:', event.httpMethod);
  console.log('Body:', event.body);
  
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    console.log('Method not allowed:', event.httpMethod);
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const data = JSON.parse(event.body);
    const { orderId } = data;

    if (!orderId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Order ID is required' })
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

    console.log('Fetching order details for:', orderId);

    // Fetch order details with account and application info
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        accounts!inner(
          personal_link_code,
          applications!inner(
            name,
            organization,
            email,
            phone,
            group_type
          )
        )
      `)
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

    // Parse order details
    const orderDetails = order.order_details || {};
    const orderItems = Object.values(orderDetails)
      .filter(item => item.quantity > 0)
      .map(item => `• ${item.name} x${item.quantity} - ${item.subtotal} kr`)
      .join('\n');

    // Get application info
    const application = order.accounts.applications;
    const accountCode = order.accounts.personal_link_code;

    // Create comprehensive order summary
    const orderSummary = `
BESTÄLLNING TILL KAKSERVICE
============================

FÖRENING/ORGANISATION:
• Namn: ${application.name}
• Organisation: ${application.organization}
• Typ: ${this.getGroupTypeText(application.group_type)}
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

STATUS: ${this.getOrderStatusText(order.status)}

---
Detta är en automatisk beställning från Kakservice-plattformen.
Föreningen: ${application.organization}
Beställningslänk: ${process.env.SITE_URL || 'https://rad-speculoos-252665.netlify.app'}/order.html?code=${accountCode}
    `.trim();

    // Send email to Kakservice
    const msg = {
      to: process.env.ADMIN_EMAIL || 'martinpranjic32@gmail.com',
      from: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
      subject: `🍪 Ny beställning från ${application.organization} - ${order.total_amount} kr`,
      text: orderSummary,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">🍪 Ny beställning från Kakservice-plattformen</h2>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #374151; margin-top: 0;">Förening/Organisation</h3>
            <p><strong>Namn:</strong> ${application.name}</p>
            <p><strong>Organisation:</strong> ${application.organization}</p>
            <p><strong>Typ:</strong> ${this.getGroupTypeText(application.group_type)}</p>
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
              <strong>Beställningslänk:</strong> <a href="${process.env.SITE_URL || 'https://rad-speculoos-252665.netlify.app'}/order.html?code=${accountCode}">${process.env.SITE_URL || 'https://rad-speculoos-252665.netlify.app'}/order.html?code=${accountCode}</a>
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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ 
        success: true,
        message: 'Beställningen har skickats till Kakservice'
      })
    };

  } catch (error) {
    console.error('Error sending order to Kakservice:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ error: 'Ett fel uppstod vid skickandet av beställningen' })
    };
  }
};

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
