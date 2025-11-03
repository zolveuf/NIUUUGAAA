// Authentication and Dashboard functionality
class AuthManager {
  constructor() {
    this.supabase = null;
    this.currentUser = null;
    this.currentAccountId = null;
    this.sessionTimeout = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    this.lastActivity = Date.now();
    this.init();
  }

  async init() {
    try {
      // Wait for config to load
      await this.waitForConfig();
      
      // Initialize Supabase client
      this.supabase = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      console.log('Supabase client initialized');
      
      // Check if user is already logged in
      await this.checkAuthState();
      
      // Set up event listeners
      this.setupEventListeners();
      
    } catch (error) {
      console.error('Autentisering initialiseringsfel:', error);
      this.showConfigError();
    }
  }

  async waitForConfig() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      
      const checkConfig = () => {
        attempts++;
        
        if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
          console.log('Konfigurationen har laddats');
          resolve();
        } else if (attempts >= maxAttempts) {
          console.error('Config loading timeout. SUPABASE_URL:', window.SUPABASE_URL, 'SUPABASE_ANON_KEY:', window.SUPABASE_ANON_KEY);
          reject(new Error('Konfigurationstid överträdelse'));
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
      console.log('Inloggningsformulär hittades, lyssnare tillagd');
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    } else {
      console.log('Inloggningsformulär hittades inte!');
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
        this.startSessionTimeout();
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.handleUnauthenticatedUser();
        this.stopSessionTimeout();
      }
    });

    // Track user activity for session timeout
    this.setupActivityTracking();
  }

  async handleLogin(e) {
    console.log('handleLogin anropades!');
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');

    console.log('Inloggningsförsök med e-post:', email);

    const submitBtn = e.target.querySelector('.auth-submit');
    const originalText = submitBtn.textContent;
    
    try {
      // Show loading state
      submitBtn.textContent = 'Loggar in...';
      submitBtn.disabled = true;

      // Attempt to sign in
      console.log('Försöker att logga in med Supabase...');
      console.log('Supabase client:', this.supabase);
      
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: email,
        password: password
      });
      
      console.log('Supabase svar:', { data, error });

      if (error) {
        throw error;
      }

      // Success - check account status before redirecting
      console.log('Inloggning lyckades! Data:', data);
      
      // Check account status
      const accountStatus = await this.checkAccountStatus(data.user.id);
      
      if (accountStatus === 'pending') {
        this.showMessage('Ditt konto väntar fortfarande på godkännande. Vi kommer att kontakta dig när det är klart.', 'warning');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        return;
      } else if (accountStatus === 'rejected') {
        this.showMessage('Ditt konto har avvisats. Kontakta support för mer information.', 'error');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        return;
      }
      
      // Account is approved - proceed with login
      this.showMessage('Inloggningen lyckades! Omdirigerar...', 'success');
      
      // Force redirect if auth state change doesn't work
      setTimeout(() => {
        console.log('Tvingar omdirigering till instrumentpanelen...');
        window.location.href = 'dashboard.html';
      }, 1000);
      
    } catch (error) {
      console.error('Inloggningsfel:', error);
      
      let errorMessage = 'Inloggning misslyckades.';
      
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Ogiltig e-post eller lösenord.';
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
      console.error('Utloggningsfel:', error);
      this.showMessage('Ett fel uppstod vid utloggning.', 'error');
    }
  }

  async loadDashboardData() {
    const loadingState = document.getElementById('loading-state');
    const dashboardContent = document.getElementById('dashboard-content');
    const errorState = document.getElementById('error-state');

    try {
      // Show loading state
      if (loadingState) loadingState.style.display = 'block';
      if (dashboardContent) dashboardContent.style.display = 'none';
      if (errorState) errorState.style.display = 'none';

      // Get user's application and account
      const { data: applications, error: appError } = await this.supabase
        .from('applications')
        .select('*')
        .eq('user_id', this.currentUser.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (appError) {
        throw appError;
      }

      // Get user's account with personal link
      const { data: accountsData, error: accountError } = await this.supabase
        .from('accounts')
        .select('*')
        .eq('user_id', this.currentUser.id)
        .limit(1);

      let accounts = null;
      if (accountError && accountError.code !== 'PGRST116') {
        console.error('Kontofel:', accountError);
        // Don't throw error, just continue without account
      } else if (accountsData && accountsData.length > 0) {
        accounts = accountsData[0];
      }

      if (applications && applications.length > 0) {
        const application = applications[0];
        this.displayApplicationData(application);
        
        // Display personal link if account exists
        if (accounts) {
          this.currentAccountId = accounts.id; // Save account ID
          this.displayPersonalLink(accounts.personal_link_code);
          
          // Load and display orders and stats
          await this.loadOrders(accounts.id);
          await this.loadStats(accounts.id);
        }
      } else {
        this.showNoApplicationMessage();
      }

      // Show dashboard content
      if (loadingState) loadingState.style.display = 'none';
      if (dashboardContent) dashboardContent.style.display = 'block';

    } catch (error) {
      console.error('Fel vid ladda instrumentpaneldata:', error);
      
      if (loadingState) loadingState.style.display = 'none';
      if (dashboardContent) dashboardContent.style.display = 'none';
      if (errorState) errorState.style.display = 'block';
      
      const errorMessage = document.getElementById('error-message');
      if (errorMessage) {
        errorMessage.textContent = 'Kunde inte ladda din information. Försök igen senare eller kontakta support.';
      } else {
        // Fallback to notification if error message element doesn't exist
        if (typeof showNotification === 'function') {
          showNotification('Kunde inte ladda din information. Försök igen senare eller kontakta support.', 'error');
        }
      }
    }
  }

  displayApplicationData(application) {
    if (!application) {
      console.error('No application data provided');
      return;
    }

    // Update status
    const statusBadge = document.getElementById('status-badge');
    const statusMessage = document.getElementById('status-message');
    
    if (statusBadge && statusMessage) {
      statusBadge.textContent = this.getStatusText(application.status);
      statusBadge.className = `status-badge status-${application.status}`;
      statusMessage.textContent = this.getStatusMessage(application.status);
    }

    // Update application details
    const applicationDetails = document.getElementById('application-details');
    if (!applicationDetails) {
      console.error('Application details element not found');
      return;
    }
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

  async loadOrders(accountId) {
    try {
      console.log('Laddar beställningar för konto:', accountId);
      
      const { data: orders, error } = await this.supabase
        .from('orders')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fel vid laddning av beställningar:', error);
        return;
      }

      console.log('Beställningar laddade:', orders);
      this.displayOrders(orders || []);
      
    } catch (error) {
      console.error('Fel vid laddning av beställningar:', error);
    }
  }

  displayOrders(orders) {
    const ordersContainer = document.getElementById('orders-container');
    if (!ordersContainer) {
      console.log('Beställningar container hittades inte');
      return;
    }

    if (orders.length === 0) {
      ordersContainer.innerHTML = `
        <div class="no-orders">
          <p>Inga beställningar än. Dela din personliga länk för att börja ta emot beställningar!</p>
        </div>
      `;
      this.updateSendButtonState([]);
      return;
    }

    ordersContainer.innerHTML = `
      <div class="orders-list">
        ${orders.map(order => this.createOrderCard(order)).join('')}
      </div>
    `;
    
    // Update send button state based on orders
    this.updateSendButtonState(orders);
  }

  updateSendButtonState(orders) {
    const sendButton = document.getElementById('send-all-orders-btn');
    if (!sendButton) return;

    // Check if there are any pending orders
    const pendingOrders = orders.filter(order => order.status === 'pending');
    
    if (pendingOrders.length === 0) {
      // No pending orders - disable button
      sendButton.disabled = true;
      sendButton.textContent = 'Inga beställningar kan skickas';
      sendButton.style.background = '#9ca3af';
      sendButton.style.cursor = 'not-allowed';
    } else {
      // Has pending orders - enable button
      sendButton.disabled = false;
      sendButton.textContent = '📧 Skicka alla beställningar till Kakservice';
      sendButton.style.background = '';
      sendButton.style.cursor = 'pointer';
    }
  }

  async loadStats(accountId) {
    try {
      console.log('Laddar statistik för konto:', accountId);
      
      const { data: orders, error } = await this.supabase
        .from('orders')
        .select('*')
        .eq('account_id', accountId);

      if (error) {
        console.error('Fel vid laddning av statistik:', error);
        return;
      }

      console.log('Beställningar för statistik:', orders);
      this.displayStats(orders || []);
      
    } catch (error) {
      console.error('Fel vid laddning av statistik:', error);
    }
  }

  displayStats(orders) {
    // Calculate total profit across all orders
    const totalProfit = this.calculateTotalProfit(orders);
    
    // Update hero stats
    const heroStats = document.getElementById('hero-stats');
    if (heroStats) {
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      const pendingOrders = orders.filter(order => order.status === 'pending').length;
      
      heroStats.innerHTML = `
        <div class="stat-item">
          <span class="stat-number">${totalOrders}</span>
          <span class="stat-label">Beställningar</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">${totalRevenue.toLocaleString('sv-SE')} kr</span>
          <span class="stat-label">Total försäljning</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">${totalProfit.toLocaleString('sv-SE')} kr</span>
          <span class="stat-label">Era pengar</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">${pendingOrders}</span>
          <span class="stat-label">Väntande</span>
        </div>
      `;
    }

    // Update stats grid
    const statsGrid = document.getElementById('stats-grid');
    if (statsGrid) {
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
      const completedOrders = orders.filter(order => order.status === 'delivered').length;
      
      statsGrid.innerHTML = `
        <div class="stat-card">
          <span class="number">${totalOrders}</span>
          <span class="label">Totalt antal</span>
        </div>
        <div class="stat-card">
          <span class="number">${avgOrderValue} kr</span>
          <span class="label">Genomsnitt</span>
        </div>
        <div class="stat-card">
          <span class="number">${completedOrders}</span>
          <span class="label">Levererade</span>
        </div>
        <div class="stat-card">
          <span class="number">${totalRevenue.toLocaleString('sv-SE')} kr</span>
          <span class="label">Total summa</span>
        </div>
      `;
    }
  }
  
  calculateTotalProfit(orders) {
    // Product profit margins matching produkter.html
    const profitMargins = {
      'kasteberg-senap': 20,
      'annerstad-smakkit': 45,
      'alpacka-strumpor': 40,
      'benesta-lemonad': 8,
      'benesta-svartvinbar': 8,
      'kasteberg-gardskit': 34,
      'kasteberg-rapsolja': 20,
      'annerstad-myskit': 35
    };
    
    let totalProfit = 0;
    
    orders.forEach(order => {
      if (order.order_details && typeof order.order_details === 'object') {
        Object.entries(order.order_details).forEach(([productId, item]) => {
          const profitPerUnit = profitMargins[productId] || 0;
          const quantity = item.quantity || 0;
          totalProfit += profitPerUnit * quantity;
        });
      }
    });
    
    return totalProfit;
  }

  createOrderCard(order) {
    const orderDate = new Date(order.created_at).toLocaleDateString('sv-SE');
    const orderTime = new Date(order.created_at).toLocaleTimeString('sv-SE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    const statusClass = `status-${order.status}`;
    const statusText = this.getOrderStatusText(order.status);
    
    // Parse order details
    let orderItems = '';
    if (order.order_details && typeof order.order_details === 'object') {
      orderItems = Object.values(order.order_details)
        .map(item => `<li>${item.name} x${item.quantity} - ${item.subtotal} kr</li>`)
        .join('');
    }

    return `
      <div class="order-card">
        <div class="order-header">
          <div class="order-info">
            <h4>Beställning #${order.id.slice(-8)}</h4>
            <p class="order-date">${orderDate} kl ${orderTime}</p>
          </div>
          <div class="order-status">
            <span class="status-badge ${statusClass}">${statusText}</span>
          </div>
        </div>
        
        <div class="order-details">
          <div class="customer-info">
            <p><strong>Kund:</strong> ${order.customer_name}</p>
            ${order.seller_name ? `<p><strong>Köpt från:</strong> ${order.seller_name}</p>` : ''}
            ${order.customer_email ? `<p><strong>E-post:</strong> ${order.customer_email}</p>` : ''}
            ${order.customer_phone ? `<p><strong>Telefon:</strong> ${order.customer_phone}</p>` : ''}
          </div>
          
          <div class="order-items">
            <h5>Beställda produkter:</h5>
            <ul>${orderItems}</ul>
            <div class="order-total">
              <strong>Totalt: ${order.total_amount} kr</strong>
            </div>
          </div>
          
        </div>
      </div>
    `;
  }

  getOrderStatusText(status) {
    const statusMap = {
      'pending': 'Väntar',
      'confirmed': 'Bekräftad',
      'shipped': 'Skickad',
      'delivered': 'Levererad',
      'cancelled': 'Avbruten',
      'sent': 'Skickad till Kakservice'
    };
    return statusMap[status] || status;
  }

  displayPersonalLink(linkCode) {
    const personalLinkInput = document.getElementById('personal-link');
    const linkContainer = document.querySelector('.personal-link-card');
    
    if (linkCode && !linkCode.startsWith('DEL_')) {
      const siteUrl = window.location.origin;
      const fullLink = `${siteUrl}/order.html?code=${linkCode}`;
      
      personalLinkInput.value = fullLink;
      
      // Set up copy functionality
      const copyBtn = document.getElementById('copy-link-btn');
      copyBtn.addEventListener('click', () => {
        personalLinkInput.select();
        document.execCommand('copy');
        
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Kopierad!';
        copyBtn.style.background = '#10b981';
        
        setTimeout(() => {
          copyBtn.textContent = originalText;
          copyBtn.style.background = '';
        }, 2000);
      });
    } else if (linkContainer) {
      // Personal link has been deleted
      linkContainer.innerHTML = `
        <div class="link-deleted-message">
          <h3>🔒 Din personliga länk har raderats</h3>
          <p class="text-muted">Försäljningsperioden är avslutad</p>
        </div>
      `;
    }
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

  // Send all orders to Kakservice
  async sendAllOrdersToKakservice() {
    try {
      console.log('Skickar alla beställningar till Kakservice');
      
      // Show confirmation dialog
      const confirmed = await showConfirmDialog('Är du säker att du vill skicka beställningen? Då är eran försäljningsperiod över.', 'Ja, skicka', 'Avbryt');
      if (!confirmed) {
        return;
      }
      
      const button = document.getElementById('send-all-orders-btn');
      if (button) {
        button.textContent = 'Skickar alla beställningar...';
        button.disabled = true;
      }
      
      // Get all orders for this account
      const { data: orders, error } = await this.supabase
        .from('orders')
        .select('*')
        .eq('account_id', this.currentAccountId);

      if (error) {
        throw new Error('Kunde inte hämta beställningar: ' + error.message);
      }

      if (!orders || orders.length === 0) {
        this.showMessage('Inga beställningar att skicka till Kakservice', 'info');
        if (button) {
          button.textContent = '📧 Skicka alla beställningar till Kakservice';
          button.disabled = false;
        }
        return;
      }

      console.log('Hittade beställningar att skicka:', orders.length);

      // Send all orders
      const response = await fetch('/.netlify/functions/submit-application', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send-all-orders-to-kakservice',
          orders: orders
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        this.showMessage(`Alla ${orders.length} beställningar har skickats till Kakservice! Försäljningsperioden är nu avslutad.`, 'success');
        
        try {
          // Update orders status to "sent" instead of deleting
          await this.updateOrdersStatus(orders.map(order => order.id), 'sent');
          
          // Delete the personal link to prevent further orders
          await this.deletePersonalLink();
          
          // Reload orders to update the display (should show sent orders now)
          await this.loadOrders(this.currentAccountId);
          
          // Update stats to reflect sent orders
          await this.loadStats(this.currentAccountId);
          
          if (button) {
            button.textContent = '✅ Försäljningsperiod avslutad';
            button.style.background = '#10b981';
            button.disabled = true;
            button.style.cursor = 'not-allowed';
          }
          
          // Show success message
          this.showMessage('Försäljningsperioden är nu avslutad! Din personliga länk har raderats.', 'success');
        } catch (updateError) {
          console.error('Error updating orders status:', updateError);
          this.showMessage('Beställningar skickades men kunde inte uppdatera status. Kontakta support.', 'error');
        }
      } else {
        throw new Error(result.error || 'Kunde inte skicka beställningar');
      }

    } catch (error) {
      console.error('Error sending all orders to Kakservice:', error);
      this.showMessage('Ett fel uppstod vid skickandet: ' + error.message, 'error');
      
      // Reset button
      const button = document.getElementById('send-all-orders-btn');
      if (button) {
        button.textContent = '📧 Skicka alla beställningar till Kakservice';
        button.disabled = false;
      }
    }
  }

  // Update orders status
  async updateOrdersStatus(orderIds, status) {
    try {
      console.log('Updating orders status:', orderIds, 'to:', status);
      
      const { error } = await this.supabase
        .from('orders')
        .update({ 
          status: status,
          updated_at: new Date().toISOString()
        })
        .in('id', orderIds);

      if (error) {
        console.error('Error updating orders status:', error);
        throw new Error('Kunde inte uppdatera beställningsstatus: ' + error.message);
      } else {
        console.log('Orders status updated successfully to:', status);
        return true;
      }
    } catch (error) {
      console.error('Error updating orders status:', error);
      throw error;
    }
  }

  // Delete personal link to prevent further orders
  async deletePersonalLink() {
    try {
      console.log('Deleting personal link for account:', this.currentAccountId);
      
      const { error } = await this.supabase
        .from('accounts')
        .update({ 
          personal_link_code: `DEL_${Date.now().toString().slice(-10)}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.currentAccountId);

      if (error) {
        console.error('Error deleting personal link:', error);
        throw new Error('Kunde inte radera personlig länk: ' + error.message);
      } else {
        console.log('Personal link deleted successfully');
        return true;
      }
    } catch (error) {
      console.error('Error deleting personal link:', error);
      throw error;
    }
  }

  // Clear any cached order data
  clearOrderCache() {
    try {
      // Clear localStorage cache
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('orders')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Clear sessionStorage cache
      const sessionKeysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.includes('orders')) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
      
      console.log('Order cache cleared');
    } catch (error) {
      console.error('Error clearing order cache:', error);
    }
  }

  // Check account status for a user
  async checkAccountStatus(userId) {
    try {
      console.log('Checking account status for user:', userId);
      
      const { data: account, error } = await this.supabase
        .from('accounts')
        .select('status')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error checking account status:', error);
        return 'unknown';
      }

      console.log('Account status:', account.status);
      return account.status || 'unknown';
      
    } catch (error) {
      console.error('Error in checkAccountStatus:', error);
      return 'unknown';
    }
  }

  // Delete user account completely
  async deleteAccount(email, password) {
    try {
      console.log('Starting account deletion process');

      // First, verify the user's credentials by signing in
      const { data: signInData, error: signInError } = await this.supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (signInError) {
        throw new Error('Felaktig e-postadress eller lösenord');
      }

      if (!signInData.user) {
        throw new Error('Kunde inte verifiera användaruppgifter');
      }

      // Get the current account ID and user ID
      const accountId = this.currentAccountId;
      const userId = signInData.user.id;
      
      if (!accountId) {
        throw new Error('Kunde inte hitta kontoinformation');
      }

      console.log('Credentials verified, proceeding with account deletion');

      // Delete all orders for this account
      const { error: ordersError } = await this.supabase
        .from('orders')
        .delete()
        .eq('account_id', accountId);

      if (ordersError) {
        console.warn('Warning: Could not delete orders:', ordersError);
      } else {
        console.log('Orders deleted successfully');
      }

      // Delete the account record
      const { error: accountError } = await this.supabase
        .from('accounts')
        .delete()
        .eq('id', accountId);

      if (accountError) {
        throw new Error('Kunde inte radera kontoinformation: ' + accountError.message);
      }

      console.log('Account record deleted successfully');

      // Delete the user from Supabase Auth using Netlify Function
      console.log('Deleting user from Supabase Auth:', userId);
      
      const deleteUserResponse = await fetch('/.netlify/functions/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: userId })
      });

      const deleteUserResult = await deleteUserResponse.json();

      if (!deleteUserResponse.ok) {
        throw new Error('Kunde inte radera användare från autentiseringssystemet: ' + deleteUserResult.error);
      }

      console.log('User deleted from Supabase Auth successfully');

      // Sign out the user
      await this.supabase.auth.signOut();

      console.log('Account deletion completed successfully');
      return true;

    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }

  // Delete sent orders from database
  async deleteSentOrders(orderIds) {
    try {
      console.log('Deleting sent orders:', orderIds);
      
      const { error } = await this.supabase
        .from('orders')
        .delete()
        .in('id', orderIds);

      if (error) {
        console.error('Error deleting orders:', error);
        throw new Error('Kunde inte radera beställningar från databasen: ' + error.message);
      } else {
        console.log('Orders deleted successfully from database');
        return true;
      }
    } catch (error) {
      console.error('Error deleting orders:', error);
      throw error;
    }
  }

  // Send order to Kakservice
  async sendOrderToKakservice(orderId, buttonElement = null) {
    // Show loading state
    const button = buttonElement || document.querySelector(`[onclick*="${orderId}"]`);
    
    try {
      console.log('Sending order to Kakservice:', orderId);
      
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Skickar...';
        button.disabled = true;
      }
      
      const response = await fetch('/.netlify/functions/submit-application', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: orderId,
          action: 'send-to-kakservice'
        })
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      console.log('Response text:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Invalid response from server');
      }

      if (response.ok && result.success) {
        this.showMessage('Beställningen har skickats till Kakservice!', 'success');
        if (button) {
          button.textContent = '✅ Skickad';
          button.style.background = '#10b981';
        }
      } else {
        throw new Error(result.error || 'Kunde inte skicka beställningen');
      }

    } catch (error) {
      console.error('Error sending order to Kakservice:', error);
      this.showMessage('Ett fel uppstod vid skickandet: ' + error.message, 'error');
      
      // Reset button
      if (button) {
        button.textContent = '📧 Skicka till Kakservice';
        button.disabled = false;
      }
    }
  }

  showMessage(message, type = 'info') {
    // Use global notification system if available
    if (typeof showNotification === 'function') {
      showNotification(message, type, 5000);
    } else {
      // Fallback: show as inline message
      const existingMessages = document.querySelectorAll('.auth-message');
      existingMessages.forEach(msg => msg.remove());

      const messageEl = document.createElement('div');
      messageEl.className = `auth-message auth-message--${type}`;
      messageEl.textContent = message;

      const form = document.getElementById('login-form');
      if (form) {
        form.insertBefore(messageEl, form.firstChild);
        setTimeout(() => {
          if (messageEl.parentNode) {
            messageEl.remove();
          }
        }, 5000);
      }
    }
  }

  showConfigError() {
    const errorMessage = 'Konfiguration kunde inte laddas. Kontrollera att alla API-nycklar är korrekt inställda.';
    
    // Show error on login page
    if (window.location.pathname.includes('login.html')) {
      this.showMessage(errorMessage, 'error');
    } else {
      // Show error on dashboard
      const errorState = document.getElementById('error-state');
      const errorText = document.getElementById('error-message');
      if (errorState && errorText) {
        errorText.textContent = errorMessage;
        errorState.style.display = 'block';
      }
    }
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

  // Session timeout functions
  setupActivityTracking() {
    // Track user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(event => {
      document.addEventListener(event, () => {
        this.lastActivity = Date.now();
      }, true);
    });
  }

  startSessionTimeout() {
    this.stopSessionTimeout(); // Clear any existing timeout
    
    this.timeoutId = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - this.lastActivity;
      
      if (timeSinceActivity > this.sessionTimeout) {
        console.log('Session timeout - logging out user');
        this.showMessage('Din session har gått ut på grund av inaktivitet. Logga in igen.', 'info');
        this.handleLogout();
      }
    }, 60000); // Check every minute
  }

  stopSessionTimeout() {
    if (this.timeoutId) {
      clearInterval(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.authManager = new AuthManager();
  
  // Set up send all orders button
  const sendAllBtn = document.getElementById('send-all-orders-btn');
  if (sendAllBtn) {
    sendAllBtn.addEventListener('click', () => {
      window.authManager.sendAllOrdersToKakservice();
    });
  }
  
  // Set up refresh button
  const refreshBtn = document.getElementById('refresh-orders');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (window.authManager.currentAccountId) {
        window.authManager.loadOrders(window.authManager.currentAccountId);
      }
    });
  }

  // Set up delete account functionality
  setupDeleteAccount();
});

// Delete Account Functionality
function setupDeleteAccount() {
  const deleteForm = document.getElementById('delete-account-form');
  const deleteBtn = document.getElementById('delete-account-btn');
  const confirmCheckbox = document.getElementById('confirm-delete');
  const deleteStatus = document.getElementById('delete-status');

  if (!deleteForm || !deleteBtn || !confirmCheckbox || !deleteStatus) {
    return;
  }

  // Enable/disable delete button based on checkbox
  confirmCheckbox.addEventListener('change', () => {
    deleteBtn.disabled = !confirmCheckbox.checked;
  });

  // Handle form submission
  deleteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('delete-email').value;
    const password = document.getElementById('delete-password').value;

    if (!email || !password || !confirmCheckbox.checked) {
      showDeleteStatus('Vänligen fyll i alla fält och bekräfta att du förstår konsekvenserna.', 'error');
      return;
    }

    try {
      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Raderar konto...';
      
      await window.authManager.deleteAccount(email, password);
      
      showDeleteStatus('Ditt konto har raderats framgångsrikt. Du kommer att omdirigeras till startsidan.', 'success');
      
      // Redirect to home page after 3 seconds
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 3000);
      
    } catch (error) {
      console.error('Error deleting account:', error);
      showDeleteStatus(`Fel vid radering av konto: ${error.message}`, 'error');
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Radera konto permanent';
    }
  });
}

function showDeleteStatus(message, type) {
  const deleteStatus = document.getElementById('delete-status');
  if (deleteStatus) {
    deleteStatus.textContent = message;
    deleteStatus.className = `status-message ${type}`;
    deleteStatus.style.display = 'block';
    
    // Scroll to status message
    deleteStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
