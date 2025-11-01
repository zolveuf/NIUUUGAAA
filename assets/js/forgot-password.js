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
      
      // Wait for Supabase library to load
      await this.waitForSupabase();
      
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

      // Send password reset request to our backend
      const response = await fetch('/.netlify/functions/send-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          redirectTo: `${window.location.origin}/reset-password.html`
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Kunde inte skicka återställningslänk');
      }

      this.showMessage('Återställningslänk har skickats till din e-postadress! Om du inte ser mailet, kontrollera din skräppost.', 'success');
      
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
    // Use global notification system if available
    if (typeof showNotification === 'function') {
      showNotification(text, type, 5000);
    } else {
      // Fallback: show inline message
      const messageContainer = document.getElementById('message-container');
      const message = document.getElementById('message');
      
      if (messageContainer && message) {
        message.textContent = text;
        message.className = `message message--${type}`;
        messageContainer.style.display = 'block';
        
        setTimeout(() => {
          messageContainer.style.display = 'none';
        }, 5000);
      }
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.forgotPasswordManager = new ForgotPasswordManager();
});
