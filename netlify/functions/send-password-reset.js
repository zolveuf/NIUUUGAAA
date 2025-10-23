// Netlify Function for sending password reset emails
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
    const { email, redirectTo } = data;

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'E-postadress krävs' })
      };
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Check if user exists
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Databasfel' })
      };
    }

    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      // Don't reveal if user exists or not for security
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          message: 'Om e-postadressen finns i systemet kommer en återställningslänk att skickas.' 
        })
      };
    }

    // Generate reset token using Supabase Auth
    console.log('Generating reset link for:', email);
    console.log('Redirect to:', redirectTo);
    
    const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: redirectTo
      }
    });

    if (resetError) {
      console.error('Error generating reset link:', resetError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Kunde inte generera återställningslänk' })
      };
    }

    console.log('Reset data received:', resetData);
    console.log('Action link:', resetData.properties.action_link);

    // Initialize SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // Create reset link
    const resetLink = resetData.properties.action_link;

    // Email template
    const msg = {
      to: email,
      from: process.env.FROM_EMAIL,
      subject: 'Återställ ditt lösenord - Kakservice',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Återställ lösenord</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Återställ ditt lösenord</h1>
            </div>
            <div class="content">
              <p>Hej!</p>
              <p>Du har begärt att återställa ditt lösenord för ditt Kakservice-konto.</p>
              <p>Klicka på knappen nedan för att skapa ett nytt lösenord:</p>
              <p style="text-align: center;">
                <a href="${resetLink}" class="button">Återställ lösenord</a>
              </p>
              <p><strong>Obs:</strong> Denna länk är giltig i 24 timmar.</p>
              <p>Om du inte begärde denna återställning kan du ignorera detta e-post.</p>
              <p>Med vänliga hälsningar,<br>Kakservice-teamet</p>
            </div>
            <div class="footer">
              <p>Detta e-post skickades automatiskt från Kakservice</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    // Send email
    await sgMail.send(msg);

    console.log('Password reset email sent to:', email);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'Återställningslänk har skickats till din e-postadress!' 
      })
    };

  } catch (error) {
    console.error('Password reset error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Ett fel uppstod vid skickandet av återställningslänken' })
    };
  }
};
