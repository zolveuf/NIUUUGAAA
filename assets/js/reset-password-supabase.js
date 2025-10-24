class ResetPasswordManager {
  constructor() {
    this.supabase = null;
    this.init();
  }

  async init() {
    try {
      // Wait for config to load
      await this.waitForConfig();
      
      // Wait for Supabase library to load
      await this.waitForSupabase();
      
      // Initialize Supabase client
      this.supabase = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      console.log('✅ Supabase client initialized for reset password');
      
      // Check if we have a valid session/token
      const sessionValid = await this.checkResetSession();
      
      if (sessionValid) {
        // Set up form handler only if session is valid
        this.setupFormHandler();
      }
      
    } catch (error) {
      console.error('❌ Reset password initialization error:', error);
    }
  }

  async waitForConfig() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      
      const checkConfig = () => {
        attempts++;
        
        if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
          console.log('✅ Config loaded successfully');
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('Config loading timeout'));
        } else {
          setTimeout(checkConfig, 100);
        }
      };
      
      checkConfig();
    });
  }

  async waitForSupabase() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      
      const checkSupabase = () => {
        attempts++;
        
        if (typeof supabase !== 'undefined') {
          console.log('✅ Supabase library loaded');
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('Supabase library loading timeout'));
        } else {
          setTimeout(checkSupabase, 100);
        }
      };
      
      checkSupabase();
    });
  }

  async checkResetSession() {
    try {
      // Save debug info to localStorage so we can see it even after redirect
      const debugInfo = {
        timestamp: new Date().toISOString(),
        fullUrl: window.location.href,
        userAgent: navigator.userAgent
      };
      
      // Check for access_token and refresh_token in URL hash fragment
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      console.log('🔍 Hash fragment:', window.location.hash);
      console.log('🔍 Hash params:', Object.fromEntries(hashParams.entries()));
      
      debugInfo.urlParams = { 
        accessToken: !!accessToken, 
        refreshToken: !!refreshToken,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        accessTokenLength: accessToken?.length || 0,
        refreshTokenLength: refreshToken?.length || 0
      };
      
      console.log('🔍 URL parameters:', debugInfo.urlParams);
      console.log('🌐 Full URL:', window.location.href);
      
      // Save to localStorage immediately
      localStorage.setItem('passwordResetDebug', JSON.stringify(debugInfo));
      
      // Show debug info on page immediately
      this.showDebugInfo(debugInfo);
      
      if (!accessToken || !refreshToken) {
        console.log('❌ No reset tokens found in URL');
        
        // Check for error parameters
        const error = hashParams.get('error');
        const errorCode = hashParams.get('error_code');
        const errorDescription = hashParams.get('error_description');
        
        if (error) {
          console.log('❌ Supabase error:', { error, errorCode, errorDescription });
          
          if (errorCode === 'otp_expired') {
            this.showMessage('Återställningslänken har gått ut. Begär en ny länk.', 'error');
          } else {
            this.showMessage('Återställningslänken är ogiltig: ' + errorDescription, 'error');
          }
        } else {
          this.showMessage('Återställningslänken är ogiltig eller har gått ut', 'error');
        }
        
        setTimeout(() => {
          window.location.href = 'forgot-password.html';
        }, 5000);
        return false;
      }

      // Set the session using the tokens from URL
      console.log('🔐 Setting session with reset tokens...');
      const { data: { session }, error } = await this.supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      if (error) {
        console.error('❌ Session set error:', error);
        this.showMessage('Återställningslänken är ogiltig eller har gått ut: ' + error.message, 'error');
        setTimeout(() => {
          window.location.href = 'forgot-password.html';
        }, 3000);
        return false;
      }

      if (!session || !session.user) {
        console.log('❌ No valid session after setting tokens');
        this.showMessage('Återställningslänken är ogiltig eller har gått ut', 'error');
        setTimeout(() => {
          window.location.href = 'forgot-password.html';
        }, 3000);
        return false;
      }

      console.log('✅ Valid reset session established for user:', session.user.email);
      console.log('⏰ Session expires at:', new Date(session.expires_at * 1000));
      
      // Show user info
      this.showUserInfo(session.user.email);
      
      return true;
      
    } catch (error) {
      console.error('❌ Session check error:', error);
      this.showMessage('Återställningslänken är ogiltig eller har gått ut', 'error');
      setTimeout(() => {
        window.location.href = 'forgot-password.html';
      }, 3000);
      return false;
    }
  }

  setupFormHandler() {
    const form = document.getElementById('reset-password-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handlePasswordReset();
      });
    }
  }

  async handlePasswordReset() {
    try {
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirm-password').value;
      
      // Validate passwords
      if (!password || !confirmPassword) {
        this.showMessage('Vänligen fyll i båda lösenordsfälten', 'error');
        return;
      }

      if (password !== confirmPassword) {
        this.showMessage('Lösenorden matchar inte', 'error');
        return;
      }

      if (!this.validatePassword(password)) {
        this.showMessage('Lösenordet uppfyller inte kraven', 'error');
        return;
      }

      // Show loading state
      const submitButton = document.querySelector('#reset-password-form button[type="submit"]');
      const originalText = submitButton.textContent;
      submitButton.textContent = 'Uppdaterar...';
      submitButton.disabled = true;

      console.log('🔄 Updating password using Supabase Auth...');

      // Update password using Supabase Auth
      const { data, error } = await this.supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error('❌ Password update error:', error);
        throw new Error('Kunde inte uppdatera lösenordet: ' + error.message);
      }

      console.log('✅ Password updated successfully:', data);
      this.showMessage('Lösenordet har uppdaterats! Du omdirigeras till inloggningssidan...', 'success');
      
      // Redirect to login page after 2 seconds
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 2000);

    } catch (error) {
      console.error('❌ Password reset error:', error);
      this.showMessage('Ett fel uppstod: ' + error.message, 'error');
    } finally {
      // Reset button
      const submitButton = document.querySelector('#reset-password-form button[type="submit"]');
      submitButton.textContent = 'Uppdatera lösenord';
      submitButton.disabled = false;
    }
  }

  validatePassword(password) {
    // Minimum 8 characters
    if (password.length < 8) {
      return false;
    }

    // Must contain uppercase letter
    if (!/[A-Z]/.test(password)) {
      return false;
    }

    // Must contain lowercase letter
    if (!/[a-z]/.test(password)) {
      return false;
    }

    // Must contain number
    if (!/\d/.test(password)) {
      return false;
    }

    // Must contain special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return false;
    }

    return true;
  }

  showDebugInfo(debugInfo) {
    const debugUrl = document.getElementById('debug-url');
    const debugTokens = document.getElementById('debug-tokens');
    
    if (debugUrl && debugTokens) {
      debugUrl.textContent = `URL: ${debugInfo.fullUrl}`;
      debugTokens.textContent = `Tokens: Access=${debugInfo.urlParams.hasAccessToken ? 'YES' : 'NO'}, Refresh=${debugInfo.urlParams.hasRefreshToken ? 'YES' : 'NO'}`;
    }
  }

  showUserInfo(email) {
    const userInfo = document.getElementById('user-info');
    const userEmail = document.getElementById('user-email');
    
    if (userInfo && userEmail) {
      userEmail.textContent = email;
      userInfo.style.display = 'block';
    }
  }

  showMessage(text, type) {
    const messageContainer = document.getElementById('message-container');
    const message = document.getElementById('message');
    
    if (messageContainer && message) {
      message.textContent = text;
      message.className = `message message--${type}`;
      messageContainer.style.display = 'block';
      
      // Auto-hide after 5 seconds (except for success messages)
      if (type !== 'success') {
        setTimeout(() => {
          messageContainer.style.display = 'none';
        }, 5000);
      }
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.resetPasswordManager = new ResetPasswordManager();
});
