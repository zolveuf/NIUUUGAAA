// Authentication and Dashboard functionality
class AuthManager {
  constructor() {
    this.supabase = null;
    this.currentUser = null;
    this.init();
  }

  async init() {
    // Wait for config to load
    await this.waitForConfig();
    
    // Initialize Supabase client
    this.supabase = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    
    // Check if user is already logged in
    await this.checkAuthState();
    
    // Set up event listeners
    this.setupEventListeners();
  }

  async waitForConfig() {
    return new Promise((resolve) => {
      const checkConfig = () => {
        if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
          resolve();
        } else {
          setTimeout(checkConfig, 100);
        }
      };
      checkConfig();
    });
  }

  async checkAuthState() {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error) {
        console.error('Auth error:', error);
        return;
      }

      if (session) {
        this.currentUser = session.user;
        this.handleAuthenticatedUser();
      } else {
        this.handleUnauthenticatedUser();
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      this.handleUnauthenticatedUser();
    }
  }

  handleAuthenticatedUser() {
    // If on login page, redirect to dashboard
    if (window.location.pathname.includes('login.html')) {
      window.location.href = 'dashboard.html';
      return;
    }

    // If on dashboard, load user data
    if (window.location.pathname.includes('dashboard.html')) {
      this.loadDashboardData();
    }

    // Update UI elements
    this.updateUserUI();
  }

  handleUnauthenticatedUser() {
    // If on dashboard, redirect to login
    if (window.location.pathname.includes('dashboard.html')) {
      window.location.href = 'login.html';
      return;
    }

    // If on login page, show login form
    if (window.location.pathname.includes('login.html')) {
      this.showLoginForm();
    }
  }

  setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Retry button
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.loadDashboardData());
    }

    // Update contact button
    const updateContactBtn = document.getElementById('update-contact-btn');
    if (updateContactBtn) {
      updateContactBtn.addEventListener('click', () => this.showUpdateContactForm());
    }

    // Listen for auth state changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        this.currentUser = session.user;
        this.handleAuthenticatedUser();
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.handleUnauthenticatedUser();
      }
    });
  }

  async handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');

    const submitBtn = e.target.querySelector('.auth-submit');
    const originalText = submitBtn.textContent;
    
    try {
      // Show loading state
      submitBtn.textContent = 'Loggar in...';
      submitBtn.disabled = true;

      // Attempt to sign in
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        throw error;
      }

      // Success - redirect will happen automatically via auth state change
      this.showMessage('Inloggning lyckades! Omdirigerar...', 'success');
      
    } catch (error) {
      console.error('Login error:', error);
      
      let errorMessage = 'Inloggning misslyckades.';
      
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Felaktig e-post eller lösenord.';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'E-postadressen är inte bekräftad. Kontrollera din e-post.';
      } else if (error.message.includes('Too many requests')) {
        errorMessage = 'För många försök. Vänta en stund innan du försöker igen.';
      }
      
      this.showMessage(errorMessage, 'error');
      
    } finally {
      // Reset button state
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }

  async handleLogout() {
    try {
      const { error } = await this.supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
      
      // Redirect will happen automatically via auth state change
      this.showMessage('Du har loggats ut.', 'info');
      
    } catch (error) {
      console.error('Logout error:', error);
      this.showMessage('Ett fel uppstod vid utloggning.', 'error');
    }
  }

  async loadDashboardData() {
    const loadingState = document.getElementById('loading-state');
    const dashboardContent = document.getElementById('dashboard-content');
    const errorState = document.getElementById('error-state');

    try {
      // Show loading state
      loadingState.style.display = 'block';
      dashboardContent.style.display = 'none';
      errorState.style.display = 'none';

      // Get user's application
      const { data: applications, error } = await this.supabase
        .from('applications')
        .select('*')
        .eq('user_id', this.currentUser.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        throw error;
      }

      if (applications && applications.length > 0) {
        const application = applications[0];
        this.displayApplicationData(application);
      } else {
        this.showNoApplicationMessage();
      }

      // Show dashboard content
      loadingState.style.display = 'none';
      dashboardContent.style.display = 'block';

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      
      loadingState.style.display = 'none';
      dashboardContent.style.display = 'none';
      errorState.style.display = 'block';
      
      const errorMessage = document.getElementById('error-message');
      errorMessage.textContent = 'Kunde inte ladda din information. Försök igen senare.';
    }
  }

  displayApplicationData(application) {
    // Update status
    const statusBadge = document.getElementById('status-badge');
    const statusMessage = document.getElementById('status-message');
    
    statusBadge.textContent = this.getStatusText(application.status);
    statusBadge.className = `status-badge status-${application.status}`;
    statusMessage.textContent = this.getStatusMessage(application.status);

    // Update application details
    const applicationDetails = document.getElementById('application-details');
    applicationDetails.innerHTML = `
      <div class="detail-row">
        <span class="detail-label">Organisation:</span>
        <span class="detail-value">${application.organization}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Typ av grupp:</span>
        <span class="detail-value">${this.getGroupTypeText(application.group_type)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Antal deltagare:</span>
        <span class="detail-value">${application.participants || 'Inte angivet'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Tidsram:</span>
        <span class="detail-value">${application.timeline || 'Inte angivet'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Mål:</span>
        <span class="detail-value">${application.goal || 'Inte angivet'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Ansökan skickad:</span>
        <span class="detail-value">${new Date(application.created_at).toLocaleDateString('sv-SE')}</span>
      </div>
    `;

    // Update contact info
    document.getElementById('contact-email').textContent = application.email;
    document.getElementById('contact-phone').textContent = application.phone || 'Inte angivet';
    document.getElementById('contact-organization').textContent = application.organization;
  }

  showNoApplicationMessage() {
    const applicationDetails = document.getElementById('application-details');
    applicationDetails.innerHTML = `
      <div class="no-application">
        <p>Ingen ansökan hittades för ditt konto.</p>
        <a href="börja-sälja.html" class="btn btn--primary">Skapa ansökan</a>
      </div>
    `;
  }

  updateUserUI() {
    const userName = document.getElementById('user-name');
    if (userName && this.currentUser) {
      userName.textContent = this.currentUser.user_metadata?.name || this.currentUser.email;
    }
  }

  showLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.style.display = 'block';
    }
  }

  getStatusText(status) {
    const statusMap = {
      'pending': 'Mottagen',
      'reviewing': 'Granskas',
      'approved': 'Godkänd',
      'rejected': 'Avslagen',
      'completed': 'Slutförd'
    };
    return statusMap[status] || 'Okänd';
  }

  getStatusMessage(status) {
    const messageMap = {
      'pending': 'Vi har mottagit din ansökan och kommer att kontakta dig inom 24 timmar.',
      'reviewing': 'Din ansökan granskas för närvarande av vårt team.',
      'approved': 'Din ansökan har godkänts! Vi kommer att kontakta dig med nästa steg.',
      'rejected': 'Tyvärr kunde vi inte godkänna din ansökan denna gång.',
      'completed': 'Din ansökan har slutförts framgångsrikt.'
    };
    return messageMap[status] || 'Status okänd.';
  }

  getGroupTypeText(groupType) {
    const typeMap = {
      'sports': 'Idrottslag',
      'school': 'Skolklass',
      'association': 'Förening',
      'other': 'Annat'
    };
    return typeMap[groupType] || groupType;
  }

  showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.auth-message');
    existingMessages.forEach(msg => msg.remove());

    // Create new message
    const messageEl = document.createElement('div');
    messageEl.className = `auth-message auth-message--${type}`;
    messageEl.textContent = message;

    // Insert message
    const form = document.getElementById('login-form');
    if (form) {
      form.insertBefore(messageEl, form.firstChild);
    } else {
      // Fallback: show as alert
      alert(message);
    }

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.remove();
      }
    }, 5000);
  }

  showUpdateContactForm() {
    // Simple implementation - could be expanded
    const newPhone = prompt('Ange nytt telefonnummer:');
    if (newPhone !== null) {
      this.updateContactInfo({ phone: newPhone });
    }
  }

  async updateContactInfo(updates) {
    try {
      const { error } = await this.supabase
        .from('applications')
        .update(updates)
        .eq('user_id', this.currentUser.id);

      if (error) {
        throw error;
      }

      this.showMessage('Kontaktinformation uppdaterad!', 'success');
      this.loadDashboardData(); // Reload data

    } catch (error) {
      console.error('Error updating contact info:', error);
      this.showMessage('Kunde inte uppdatera kontaktinformation.', 'error');
    }
  }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.authManager = new AuthManager();
});
