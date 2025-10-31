// Global notification system for consistent messaging across the site

/**
 * Show a notification message
 * @param {string} message - The message to display
 * @param {string} type - The type of message: 'success', 'error', 'info', 'warning'
 * @param {number} duration - How long to show the message in milliseconds (default: 5000)
 */
function showNotification(message, type = 'info', duration = 5000) {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notif => {
    if (notif.classList.contains('notification--removing')) return;
    removeNotification(notif);
  });

  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification--${type}`;
  
  const icon = getNotificationIcon(type);
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${icon}</span>
      <span class="notification-message">${message}</span>
    </div>
    <button class="notification-close" aria-label="Stäng">&times;</button>
  `;

  // Add to page
  const container = getNotificationContainer();
  container.appendChild(notification);

  // Trigger animation
  setTimeout(() => {
    notification.classList.add('notification--show');
  }, 10);

  // Close button handler
  const closeBtn = notification.querySelector('.notification-close');
  closeBtn.addEventListener('click', () => {
    removeNotification(notification);
  });

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      removeNotification(notification);
    }, duration);
  }

  return notification;
}

/**
 * Show a confirmation dialog
 * @param {string} message - The message to display
 * @param {string} confirmText - Text for confirm button (default: 'Ja')
 * @param {string} cancelText - Text for cancel button (default: 'Nej')
 * @returns {Promise<boolean>} - Promise that resolves to true if confirmed, false if cancelled
 */
function showConfirmDialog(message, confirmText = 'Ja', cancelText = 'Nej') {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `
      <div class="confirm-content">
        <p class="confirm-message">${message}</p>
      </div>
      <div class="confirm-actions">
        <button class="btn btn--ghost confirm-cancel">${cancelText}</button>
        <button class="btn btn--primary confirm-ok">${confirmText}</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Show animation
    setTimeout(() => {
      overlay.classList.add('confirm-overlay--show');
      dialog.classList.add('confirm-dialog--show');
    }, 10);

    // Handle confirm
    const okBtn = dialog.querySelector('.confirm-ok');
    const cancelBtn = dialog.querySelector('.confirm-cancel');
    
    const cleanup = () => {
      overlay.classList.remove('confirm-overlay--show');
      dialog.classList.remove('confirm-dialog--show');
      setTimeout(() => {
        document.body.removeChild(overlay);
      }, 300);
    };

    okBtn.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(false);
      }
    });

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        resolve(false);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  });
}

function removeNotification(notification) {
  if (notification.classList.contains('notification--removing')) return;
  
  notification.classList.add('notification--removing');
  notification.classList.remove('notification--show');
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 300);
}

function getNotificationIcon(type) {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  return icons[type] || icons.info;
}

function getNotificationContainer() {
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'notification-container';
    document.body.appendChild(container);
  }
  return container;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { showNotification, showConfirmDialog };
}

