// Forgot Password Manager
class ForgotPasswordManager {
  constructor() {
    this.supabase = null;
    this.init();
  }

  async init() {
    try {
      // Wait for config to load
      await this.waitForConfig();
      
      // Initialize Supabase client
      this.supabase = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      console.log('Supabase client initialized for forgot password');
      
      // Set up form handler
      this.setupFormHandler();
      
    } catch (error) {
      console.error('Forgot password initialization error:', error);
    }
  }

  async waitForConfig() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      
      const checkConfig = () => {
        attempts++;
        
        if (window.SUPABASE_URL && window.SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE') {
          console.log('Config loaded successfully for forgot password');
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

  setupFormHandler() {
    const form = document.getElementById('forgot-password-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleForgotPassword();
      });
    }
  }

  async handleForgotPassword() {
    try {
      const email = document.getElementById('email').value.trim();
      
      if (!email) {
        this.showMessage('Vänligen ange din e-postadress', 'error');
        return;
      }

      if (!this.validateEmail(email)) {
        this.showMessage('Vänligen ange en giltig e-postadress', 'error');
        return;
      }

      // Show loading state
      const submitButton = document.querySelector('#forgot-password-form button[type="submit"]');
      const originalText = submitButton.textContent;
      submitButton.textContent = 'Skickar...';
      submitButton.disabled = true;

      console.log('Sending password reset request for:', email);

      // Send password reset email using Supabase Auth
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password.html`
      });

      if (error) {
        console.error('Password reset error:', error);
        throw new Error('Kunde inte skicka återställningslänk: ' + error.message);
      }

      this.showMessage('Återställningslänk har skickats till din e-postadress!', 'success');
      
      // Clear form
      document.getElementById('email').value = '';

    } catch (error) {
      console.error('Forgot password error:', error);
      this.showMessage('Ett fel uppstod: ' + error.message, 'error');
    } finally {
      // Reset button
      const submitButton = document.querySelector('#forgot-password-form button[type="submit"]');
      submitButton.textContent = 'Skicka återställningslänk';
      submitButton.disabled = false;
    }
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  showMessage(text, type) {
    const messageContainer = document.getElementById('message-container');
    const message = document.getElementById('message');
    
    if (messageContainer && message) {
      message.textContent = text;
      message.className = `message message--${type}`;
      messageContainer.style.display = 'block';
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        messageContainer.style.display = 'none';
      }, 5000);
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.forgotPasswordManager = new ForgotPasswordManager();
});
