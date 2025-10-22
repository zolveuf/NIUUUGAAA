// Simple Netlify Function for order submissions
const { createClient } = require('@supabase/supabase-js');

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
      orderDetails,
      totalAmount,
      specialRequests
    } = data;

    // Validate required fields
    if (!accountCode || !customerName || !orderDetails) {
      console.log('Missing required fields');
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          required: ['accountCode', 'customerName', 'orderDetails']
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
          order_details: orderDetails,
          total_amount: totalAmount,
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
