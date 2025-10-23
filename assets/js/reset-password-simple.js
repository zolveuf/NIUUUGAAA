class ResetPasswordManager {
  constructor() {
    this.init();
  }

  async init() {
    try {
      // Wait for config to load
      await this.waitForConfig();
      
      // Check if we have a valid token in URL
      const tokenValid = this.checkResetToken();
      
      if (tokenValid) {
        // Set up form handler
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

  checkResetToken() {
    try {
      // Check for access_token in URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get('access_token');
      const refreshToken = urlParams.get('refresh_token');
      
      console.log('🔍 URL parameters:', { 
        accessToken: !!accessToken, 
        refreshToken: !!refreshToken,
        fullUrl: window.location.href 
      });
      
      if (!accessToken || !refreshToken) {
        console.log('❌ No reset tokens found in URL');
        this.showMessage('Återställningslänken är ogiltig eller har gått ut', 'error');
        setTimeout(() => {
          window.location.href = 'forgot-password.html';
        }, 3000);
        return false;
      }

      // Extract user info from token (basic validation)
      try {
        const tokenPayload = JSON.parse(atob(accessToken.split('.')[1]));
        const userEmail = tokenPayload.email;
        
        console.log('✅ Valid reset token found for user:', userEmail);
        console.log('⏰ Token expires at:', new Date(tokenPayload.exp * 1000));
        
        // Show user info
        this.showUserInfo(userEmail);
        
        // Store token for password update
        this.resetToken = accessToken;
        
        return true;
      } catch (tokenError) {
        console.error('❌ Token parsing error:', tokenError);
        this.showMessage('Återställningslänken är ogiltig', 'error');
        setTimeout(() => {
          window.location.href = 'forgot-password.html';
        }, 3000);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Token check error:', error);
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

      console.log('🔄 Updating password via Netlify Function...');

      // Call our custom Netlify Function
      const response = await fetch('/.netlify/functions/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: this.resetToken,
          password: password
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Nätverksfel');
      }

      console.log('✅ Password updated successfully');
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
