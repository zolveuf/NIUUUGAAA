// Admin approval functionality
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('action');
  const accountId = urlParams.get('accountId');
  const adminKey = urlParams.get('key');

  const loadingState = document.getElementById('loading-state');
  const successState = document.getElementById('success-state');
  const errorState = document.getElementById('error-state');
  const successMessage = document.getElementById('success-message');
  const errorMessage = document.getElementById('error-message');

  // Validate required parameters
  if (!action || !accountId || !adminKey) {
    showError('Saknar parametrar. Kontrollera att länken är korrekt.');
    return;
  }

  if (action !== 'approve' && action !== 'reject') {
    showError('Ogiltig åtgärd. Endast "godkänn" eller "avvisa" är tillåtna.');
    return;
  }

  try {
    // Show loading state
    loadingState.style.display = 'block';

    // Call the admin approval function
    const response = await fetch('/.netlify/functions/admin-approve-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: action,
        accountId: accountId,
        adminKey: adminKey
      })
    });

    const result = await response.json();

    // Hide loading state
    loadingState.style.display = 'none';

    if (response.ok && result.success) {
      showSuccess(result.message, action);
    } else {
      showError(result.error || 'Ett fel uppstod vid godkännande.');
    }

  } catch (error) {
    console.error('Fel vid godkännande:', error);
    loadingState.style.display = 'none';
    showError('Ett fel uppstod vid kommunikation med server.');
  }
});

function showSuccess(message, action) {
  const successState = document.getElementById('success-state');
  const successMessage = document.getElementById('success-message');
  
  const actionText = action === 'godkänn' ? 'godkänt' : 'avvisat';
  successMessage.textContent = `Kontot har ${actionText} framgångsrikt. ${message}`;
  
  successState.style.display = 'block';
}

function showError(message) {
  const errorState = document.getElementById('error-state');
  const errorMessage = document.getElementById('error-message');
  
  errorMessage.textContent = message;
  errorState.style.display = 'block';
}
