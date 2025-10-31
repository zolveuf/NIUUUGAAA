// Netlify Function to get order page information (account + application)
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const accountCode = event.queryStringParameters?.code;

    if (!accountCode) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Account code is required' })
      };
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get account information
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('personal_link_code', accountCode)
      .single();

    if (accountError || !accountData) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Beställningslänken är ogiltig' })
      };
    }

    // Check if personal link has been deleted
    if (!accountData.personal_link_code || accountData.personal_link_code.startsWith('DEL_')) {
      return {
        statusCode: 410,
        body: JSON.stringify({ error: 'Försäljningsperioden är avslutad. Denna länk fungerar inte längre.' })
      };
    }

    // Get application information using service role (bypasses RLS)
    const { data: applicationData, error: appError } = await supabase
      .from('applications')
      .select('organization, name, group_type')
      .eq('user_id', accountData.user_id)
      .single();

    if (appError || !applicationData) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Kunde inte hitta organisationsinformation' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        account: accountData,
        application: applicationData
      })
    };

  } catch (error) {
    console.error('Error in get-order-info:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Ett fel uppstod: ' + error.message })
    };
  }
};

