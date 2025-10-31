// Order page functionality
class OrderManager {
  constructor() {
    this.supabase = null;
    this.accountCode = null;
    this.accountData = null;
    this.init();
  }

  async init() {
    try {
      // Wait for config to load
      await this.waitForConfig();
      
      // Initialize Supabase client
      this.supabase = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      console.log('Supabase client initialized for orders');
      
      // Get order code from URL
      this.accountCode = this.getOrderCodeFromURL();
      
      if (!this.accountCode) {
        this.showError('Ingen beställningskod hittades i URL:en.');
        return;
      }
      
      // Load account information
      await this.loadAccountInfo();
      
      // Set up event listeners
      this.setupEventListeners();
      
    } catch (error) {
      console.error('Order initialization error:', error);
      this.showError('Konfiguration kunde inte laddas. Kontrollera att alla API-nycklar är korrekt inställda.');
    }
  }

  async waitForConfig() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50;
      
      const checkConfig = () => {
        attempts++;
        
        if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
          console.log('Config loaded successfully for orders');
          console.log('SUPABASE_URL:', window.SUPABASE_URL);
          console.log('SUPABASE_ANON_KEY:', window.SUPABASE_ANON_KEY ? 'Present' : 'Missing');
          resolve();
        } else if (attempts >= maxAttempts) {
          console.error('Config loading timeout for orders');
          console.error('SUPABASE_URL:', window.SUPABASE_URL);
          console.error('SUPABASE_ANON_KEY:', window.SUPABASE_ANON_KEY);
          reject(new Error('Config loading timeout'));
        } else {
          setTimeout(checkConfig, 100);
        }
      };
      checkConfig();
    });
  }

  getOrderCodeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('code');
  }

  async loadAccountInfo() {
    const loadingState = document.getElementById('loading-state');
    const orderFormContainer = document.getElementById('order-form-container');
    const errorState = document.getElementById('error-state');

    try {
      // Show loading state
      loadingState.style.display = 'block';
      orderFormContainer.style.display = 'none';
      errorState.style.display = 'none';

      // Get account information
      const { data: accounts, error: accountError } = await this.supabase
        .from('accounts')
        .select('*')
        .eq('personal_link_code', this.accountCode)
        .single();

      if (accountError) {
        console.error('Error loading account:', accountError);
        throw new Error('Kunde inte hitta beställningsinformation');
      }

      if (!accounts) {
        throw new Error('Beställningslänken är ogiltig');
      }

      // Check if personal link has been deleted (sales period ended)
      if (!accounts.personal_link_code || accounts.personal_link_code === 'DELETED') {
        throw new Error('Försäljningsperioden är avslutad. Denna länk fungerar inte längre.');
      }

      // Get application information separately
      const { data: applications, error: appError } = await this.supabase
        .from('applications')
        .select('organization, name, group_type')
        .eq('user_id', accounts.user_id)
        .single();

      if (appError) {
        console.error('Error loading application:', appError);
        throw new Error('Kunde inte hitta organisationsinformation');
      }

      this.accountData = {
        ...accounts,
        applications: applications
      };
      
      console.log('Account loaded:', this.accountData);

      // Update UI with account information
      document.getElementById('organization-name').textContent = applications.organization;

      // Load products
      this.loadProducts();

      // Show order form
      loadingState.style.display = 'none';
      orderFormContainer.style.display = 'block';

    } catch (error) {
      console.error('Error loading account info:', error);
      
      loadingState.style.display = 'none';
      orderFormContainer.style.display = 'none';
      errorState.style.display = 'block';
      
      const errorMessage = document.getElementById('error-message');
      errorMessage.textContent = error.message;
    }
  }

  loadProducts() {
    const productSelection = document.getElementById('product-selection');
    
    // Sample products - you can make this dynamic later
    const products = [
      { id: 'kakburkar', name: 'Kakburkar Mix', price: 25, description: 'Mixade kakburkar med olika smaker' },
      { id: 'choklad', name: 'Premium Choklad', price: 30, description: 'Högkvalitativ choklad från Belgien' },
      { id: 'knack', name: 'Knäck & Kola', price: 20, description: 'Hemlagad knäck och kola' },
      { id: 'smakakor', name: 'Småkakor Mix', price: 15, description: 'Olika småkakor i praktisk förpackning' },
      { id: 'pepparkakor', name: 'Pepparkakor', price: 18, description: 'Klassiska pepparkakor med kanel' },
      { id: 'mazariner', name: 'Mazariner', price: 22, description: 'Svenska mazariner med mandelmassa' },
      { id: 'prinsesstårta', name: 'Prinsesstårta', price: 45, description: 'Klassisk prinsesstårta med grädde' },
      { id: 'kanelbullar', name: 'Kanelbullar', price: 12, description: 'Hemlagade kanelbullar med socker' },
      { id: 'semlor', name: 'Semlor', price: 28, description: 'Traditionella semlor med mandelmassa' },
      { id: 'kladdkaka', name: 'Kladdkaka', price: 35, description: 'Chokladkladdkaka med vispgrädde' },
      { id: 'dammsugare', name: 'Dammsugare', price: 16, description: 'Klassiska dammsugare med kokos' },
      { id: 'napoleonbakelse', name: 'Napoleonbakelse', price: 38, description: 'Elegant napoleonbakelse med vaniljkräm' }
    ];

    productSelection.innerHTML = products.map(product => `
      <div class="product-card">
        <div class="product-header">
          <h4 class="product-name">${product.name}</h4>
          <span class="product-price">${product.price} kr</span>
        </div>
        <p class="product-description">${product.description}</p>
        <div class="product-quantity">
          <label for="qty-${product.id}" class="quantity-label">Antal:</label>
          <div class="quantity-controls">
            <button type="button" class="quantity-btn quantity-decrease" data-product="${product.id}">-</button>
            <input type="number" id="qty-${product.id}" name="qty-${product.id}" min="0" max="100" value="0" class="quantity-input">
            <button type="button" class="quantity-btn quantity-increase" data-product="${product.id}">+</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  setupEventListeners() {
    const orderForm = document.getElementById('order-form');
    if (orderForm) {
      orderForm.addEventListener('submit', (e) => this.handleOrderSubmit(e));
    }
    
    // Add quantity button event listeners
    this.setupQuantityButtons();
  }

  setupQuantityButtons() {
    // Decrease buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('quantity-decrease')) {
        const productId = e.target.dataset.product;
        const input = document.getElementById(`qty-${productId}`);
        const currentValue = parseInt(input.value) || 0;
        if (currentValue > 0) {
          input.value = currentValue - 1;
        }
      }
      
      if (e.target.classList.contains('quantity-increase')) {
        const productId = e.target.dataset.product;
        const input = document.getElementById(`qty-${productId}`);
        const currentValue = parseInt(input.value) || 0;
        if (currentValue < 100) {
          input.value = currentValue + 1;
        }
      }
    });
  }

  async handleOrderSubmit(e) {
    e.preventDefault();
    console.log('Order form submitted');

    const formData = new FormData(e.target);
    const customerName = formData.get('customerName');
    const customerEmail = formData.get('customerEmail');
    const customerPhone = formData.get('customerPhone');
    const sellerName = formData.get('sellerName');
    const specialRequests = formData.get('specialRequests');

    // Collect product quantities
    const orderDetails = {};
    let totalAmount = 0;
    const products = [
      { id: 'kakburkar', name: 'Kakburkar Mix', price: 25 },
      { id: 'choklad', name: 'Premium Choklad', price: 30 },
      { id: 'knack', name: 'Knäck & Kola', price: 20 },
      { id: 'smakakor', name: 'Småkakor Mix', price: 15 },
      { id: 'pepparkakor', name: 'Pepparkakor', price: 18 },
      { id: 'mazariner', name: 'Mazariner', price: 22 },
      { id: 'prinsesstårta', name: 'Prinsesstårta', price: 45 },
      { id: 'kanelbullar', name: 'Kanelbullar', price: 12 },
      { id: 'semlor', name: 'Semlor', price: 28 },
      { id: 'kladdkaka', name: 'Kladdkaka', price: 35 },
      { id: 'dammsugare', name: 'Dammsugare', price: 16 },
      { id: 'napoleonbakelse', name: 'Napoleonbakelse', price: 38 }
    ];

    products.forEach(product => {
      const quantity = parseInt(formData.get(`qty-${product.id}`)) || 0;
      if (quantity > 0) {
        orderDetails[product.id] = {
          name: product.name,
          price: product.price,
          quantity: quantity,
          subtotal: product.price * quantity
        };
        totalAmount += product.price * quantity;
      }
    });

    if (Object.keys(orderDetails).length === 0) {
      this.showMessage('Välj minst en produkt att beställa.', 'error');
      return;
    }

    if (!customerName) {
      this.showMessage('Ange ditt namn.', 'error');
      return;
    }

    if (!sellerName) {
      this.showMessage('Ange vem du köper från.', 'error');
      return;
    }

    const submitBtn = e.target.querySelector('.order-submit');
    const originalText = submitBtn.textContent;

    try {
      // Show loading state
      submitBtn.textContent = 'Skickar beställning...';
      submitBtn.disabled = true;

      // Submit order to Netlify Function
      const response = await fetch('/.netlify/functions/submit-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountCode: this.accountCode,
          customerName,
          customerEmail,
          customerPhone,
          sellerName,
          orderDetails,
          totalAmount,
          specialRequests
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Beställning misslyckades');
      }

      // Success
      this.showMessage('Beställning skickad! Tack för din beställning.', 'success');
      
      // Clear form
      e.target.reset();
      
      // Reset product quantities
      document.querySelectorAll('.quantity-input').forEach(input => {
        input.value = 0;
      });

    } catch (error) {
      console.error('Order submission error:', error);
      this.showMessage('Ett fel uppstod vid beställningen. Försök igen.', 'error');
    } finally {
      // Reset button state
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }

  showMessage(message, type = 'info') {
    // Use global notification system if available
    if (typeof showNotification === 'function') {
      showNotification(message, type, 5000);
    } else {
      // Fallback: show as inline message
      const existingMessages = document.querySelectorAll('.order-message');
      existingMessages.forEach(msg => msg.remove());

      const messageEl = document.createElement('div');
      messageEl.className = `order-message order-message--${type}`;
      messageEl.textContent = message;

      const form = document.getElementById('order-form');
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

  showError(message) {
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    
    if (errorState && errorMessage) {
      errorMessage.textContent = message;
      errorState.style.display = 'block';
    }
  }
}

// Initialize order manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.orderManager = new OrderManager();
});
