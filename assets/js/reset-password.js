// Reset Password Manager
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
      console.log('Supabase client initialized for reset password');
      
      // Check if we have a valid session/token
      const sessionValid = await this.checkResetSession();
      
      if (sessionValid) {
        // Set up form handler only if session is valid
        this.setupFormHandler();
      }
      
    } catch (error) {
      console.error('Reset password initialization error:', error);
    }
  }

  async waitForConfig() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      
      const checkConfig = () => {
        attempts++;
        
        if (window.SUPABASE_URL && window.SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE') {
          console.log('Config loaded successfully for reset password');
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
          console.log('Supabase library loaded successfully');
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
      // Check for access_token and refresh_token in URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get('access_token');
      const refreshToken = urlParams.get('refresh_token');
      
      console.log('URL parameters:', { 
        accessToken: !!accessToken, 
        refreshToken: !!refreshToken,
        fullUrl: window.location.href 
      });
      
      if (!accessToken || !refreshToken) {
        console.log('No reset tokens found in URL');
        this.showMessage('Återställningslänken är ogiltig eller har gått ut', 'error');
        setTimeout(() => {
          window.location.href = 'forgot-password.html';
        }, 3000);
        return false;
      }

      // Clear any existing session first to avoid conflicts
      console.log('🧹 Clearing existing session...');
      const signOutResult = await this.supabase.auth.signOut();
      console.log('Sign out result:', signOutResult);

      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));

      // Set the session using the tokens from URL
      console.log('🔐 Setting new session with reset tokens...');
      console.log('Token details:', {
        accessTokenLength: accessToken.length,
        refreshTokenLength: refreshToken.length,
        accessTokenStart: accessToken.substring(0, 20) + '...',
        refreshTokenStart: refreshToken.substring(0, 20) + '...'
      });
      
      const { data: { session }, error } = await this.supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      if (error) {
        console.error('Session set error:', error);
        this.showMessage('Återställningslänken är ogiltig eller har gått ut: ' + error.message, 'error');
        setTimeout(() => {
          window.location.href = 'forgot-password.html';
        }, 3000);
        return false;
      }

      if (!session || !session.user) {
        console.log('No valid session after setting tokens');
        this.showMessage('Återställningslänken är ogiltig eller har gått ut', 'error');
        setTimeout(() => {
          window.location.href = 'forgot-password.html';
        }, 3000);
        return false;
      }

      console.log('✅ Valid reset session established for user:', session.user.email);
      console.log('⏰ Session expires at:', new Date(session.expires_at * 1000));
      console.log('⏱️ Time until expiry:', Math.round((session.expires_at * 1000 - Date.now()) / 1000), 'seconds');
      
      // Show user info
      this.showUserInfo(session.user.email);
      
      // Set up session monitoring to prevent unexpected logouts
      this.setupSessionMonitoring();
      
      // Set up token refresh to keep session alive
      this.setupTokenRefresh();
      
      return true;
      
    } catch (error) {
      console.error('Session check error:', error);
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

      console.log('Updating password');

      // Check current session before updating
      const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('No valid session for password update:', sessionError);
        throw new Error('Ingen giltig session för lösenordsuppdatering');
      }

      console.log('Current session user:', session.user?.email);

      // Update password using Supabase Auth
      const { data, error } = await this.supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error('Password update error:', error);
        throw new Error('Kunde inte uppdatera lösenordet: ' + error.message);
      }

      console.log('Password updated successfully:', data);

      this.showMessage('Lösenordet har uppdaterats! Du omdirigeras till inloggningssidan...', 'success');
      
      // Redirect to login page after 2 seconds
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 2000);

    } catch (error) {
      console.error('Password reset error:', error);
      this.showMessage('Ett fel uppstod: ' + error.message, 'error');
    } finally {
      // Reset button
      const submitButton = document.querySelector('#reset-password-form button[type="submit"]');
      submitButton.textContent = 'Uppdatera lösenord';
      submitButton.disabled = false;
    }
  }

  validatePassword(password) {
    // At least 8 characters
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

  setupTokenRefresh() {
    console.log('🔄 Setting up token refresh...');
    
    // Refresh token every 5 minutes to keep session alive
    this.tokenRefreshInterval = setInterval(async () => {
      try {
        console.log('🔄 Refreshing token...');
        const { data: { session }, error } = await this.supabase.auth.refreshSession();
        
        if (error) {
          console.error('❌ Token refresh error:', error);
        } else if (session) {
          console.log('✅ Token refreshed successfully');
          console.log('⏰ New expiry:', new Date(session.expires_at * 1000));
        }
      } catch (error) {
        console.error('❌ Token refresh exception:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  setupSessionMonitoring() {
    console.log('Setting up session monitoring...');
    
    // Monitor auth state changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔍 Auth state change detected:', {
        event: event,
        hasSession: !!session,
        userEmail: session?.user?.email,
        expiresAt: session?.expires_at ? new Date(session.expires_at * 1000) : null,
        timestamp: new Date().toISOString()
      });
      
      if (event === 'SIGNED_OUT' || !session) {
        console.log('❌ User was signed out unexpectedly');
        this.showMessage('Din session har gått ut. Du omdirigeras till återställningssidan...', 'error');
        setTimeout(() => {
          window.location.href = 'forgot-password.html';
        }, 2000);
      } else if (event === 'SIGNED_IN') {
        console.log('✅ User signed in successfully');
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token refreshed successfully');
      }
    });

    // Check session every 10 seconds for more frequent monitoring
    this.sessionCheckInterval = setInterval(async () => {
      try {
        const { data: { session }, error } = await this.supabase.auth.getSession();
        
        console.log('🔍 Session check:', {
          hasSession: !!session,
          error: error?.message,
          userEmail: session?.user?.email,
          expiresAt: session?.expires_at ? new Date(session.expires_at * 1000) : null,
          timeUntilExpiry: session?.expires_at ? Math.round((session.expires_at * 1000 - Date.now()) / 1000) : null,
          timestamp: new Date().toISOString()
        });
        
        if (error) {
          console.error('❌ Session check error:', error);
          this.showMessage('Session-fel: ' + error.message, 'error');
          clearInterval(this.sessionCheckInterval);
          setTimeout(() => {
            window.location.href = 'forgot-password.html';
          }, 2000);
        } else if (!session) {
          console.log('❌ Session check failed - no active session');
          this.showMessage('Din session har gått ut. Du omdirigeras till återställningssidan...', 'error');
          clearInterval(this.sessionCheckInterval);
          setTimeout(() => {
            window.location.href = 'forgot-password.html';
          }, 2000);
        } else {
          console.log('✅ Session check passed - session still valid');
        }
      } catch (error) {
        console.error('❌ Session check exception:', error);
      }
    }, 10000); // Check every 10 seconds
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

// Cleanup when page is unloaded
window.addEventListener('beforeunload', () => {
  if (window.resetPasswordManager) {
    if (window.resetPasswordManager.sessionCheckInterval) {
      clearInterval(window.resetPasswordManager.sessionCheckInterval);
    }
    if (window.resetPasswordManager.tokenRefreshInterval) {
      clearInterval(window.resetPasswordManager.tokenRefreshInterval);
    }
  }
});
