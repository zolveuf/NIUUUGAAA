// Order page functionality
class OrderManager {
  constructor() {
    this.supabase = null;
    this.accountCode = null;
    this.accountData = null;
    this.init();
  }

  async init() {
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
  }

  async waitForConfig() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50;
      
      const checkConfig = () => {
        attempts++;
        
        if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
          console.log('Config loaded successfully for orders');
          resolve();
        } else if (attempts >= maxAttempts) {
          console.error('Config loading timeout for orders');
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
      const { data: accounts, error } = await this.supabase
        .from('accounts')
        .select(`
          *,
          applications!inner(
            organization,
            name,
            group_type
          )
        `)
        .eq('personal_link_code', this.accountCode)
        .single();

      if (error) {
        console.error('Error loading account:', error);
        throw new Error('Kunde inte hitta beställningsinformation');
      }

      if (!accounts) {
        throw new Error('Beställningslänken är ogiltig');
      }

      this.accountData = accounts;
      console.log('Account loaded:', this.accountData);

      // Update UI with account information
      document.getElementById('organization-name').textContent = accounts.applications.organization;

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
      { id: 'kakburkar', name: 'Kakburkar', price: 25, description: 'Mixade kakburkar' },
      { id: 'choklad', name: 'Choklad', price: 30, description: 'Premium choklad' },
      { id: 'knack', name: 'Knäck & kola', price: 20, description: 'Hemlagad knäck och kola' },
      { id: 'smakakor', name: 'Småkakor', price: 15, description: 'Olika småkakor' }
    ];

    productSelection.innerHTML = products.map(product => `
      <div class="product-item">
        <div class="product-info">
          <h4>${product.name}</h4>
          <p>${product.description}</p>
          <span class="product-price">${product.price} kr</span>
        </div>
        <div class="product-quantity">
          <label for="qty-${product.id}">Antal:</label>
          <input type="number" id="qty-${product.id}" name="qty-${product.id}" min="0" max="100" value="0" class="quantity-input">
        </div>
      </div>
    `).join('');
  }

  setupEventListeners() {
    const orderForm = document.getElementById('order-form');
    if (orderForm) {
      orderForm.addEventListener('submit', (e) => this.handleOrderSubmit(e));
    }
  }

  async handleOrderSubmit(e) {
    e.preventDefault();
    console.log('Order form submitted');

    const formData = new FormData(e.target);
    const customerName = formData.get('customerName');
    const customerEmail = formData.get('customerEmail');
    const customerPhone = formData.get('customerPhone');
    const specialRequests = formData.get('specialRequests');

    // Collect product quantities
    const orderDetails = {};
    let totalAmount = 0;
    const products = [
      { id: 'kakburkar', name: 'Kakburkar', price: 25 },
      { id: 'choklad', name: 'Choklad', price: 30 },
      { id: 'knack', name: 'Knäck & kola', price: 20 },
      { id: 'smakakor', name: 'Småkakor', price: 15 }
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
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.order-message');
    existingMessages.forEach(msg => msg.remove());

    // Create new message
    const messageEl = document.createElement('div');
    messageEl.className = `order-message order-message--${type}`;
    messageEl.textContent = message;

    // Insert message
    const form = document.getElementById('order-form');
    if (form) {
      form.insertBefore(messageEl, form.firstChild);
    }

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.remove();
      }
    }, 5000);
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
