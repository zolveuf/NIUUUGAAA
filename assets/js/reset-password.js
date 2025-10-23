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
      await this.checkResetSession();
      
      // Set up form handler
      this.setupFormHandler();
      
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
      
      if (!accessToken || !refreshToken) {
        console.log('No reset tokens found in URL');
        this.showMessage('Återställningslänken är ogiltig eller har gått ut', 'error');
        setTimeout(() => {
          window.location.href = 'forgot-password.html';
        }, 3000);
        return;
      }

      // Set the session using the tokens from URL
      const { data: { session }, error } = await this.supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      if (error) {
        console.error('Session set error:', error);
        this.showMessage('Återställningslänken är ogiltig eller har gått ut', 'error');
        setTimeout(() => {
          window.location.href = 'forgot-password.html';
        }, 3000);
        return;
      }

      if (!session) {
        console.log('No valid session after setting tokens');
        this.showMessage('Återställningslänken är ogiltig eller har gått ut', 'error');
        setTimeout(() => {
          window.location.href = 'forgot-password.html';
        }, 3000);
        return;
      }

      console.log('Valid reset session established');
      
    } catch (error) {
      console.error('Session check error:', error);
      this.showMessage('Återställningslänken är ogiltig eller har gått ut', 'error');
      setTimeout(() => {
        window.location.href = 'forgot-password.html';
      }, 3000);
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

      // Update password using Supabase Auth
      const { error } = await this.supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error('Password update error:', error);
        throw new Error('Kunde inte uppdatera lösenordet: ' + error.message);
      }

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
