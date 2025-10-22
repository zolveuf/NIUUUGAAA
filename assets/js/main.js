(function () {
  const header = document.querySelector('[data-header]');
  const navToggle = document.querySelector('.nav-toggle');
  const siteNav = document.getElementById('site-nav');
  const dropdownToggles = document.querySelectorAll('.dropdown-toggle');

  // Mobile menu toggle
  if (navToggle && siteNav) {
    navToggle.addEventListener('click', function () {
      const expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', String(!expanded));
      // update header height CSS var for full-width dropdown positioning
      if (header) {
        const rect = header.getBoundingClientRect();
        document.documentElement.style.setProperty('--header-h', rect.height + 'px');
      }
      siteNav.classList.toggle('open');
      document.body.classList.toggle('no-scroll', !expanded);
      if (header) header.classList.toggle('menu-open', !expanded);
    });
  }

  // Update header height variable on resize when menu is open
  window.addEventListener('resize', function () {
    if (siteNav && siteNav.classList.contains('open') && header) {
      const rect = header.getBoundingClientRect();
      document.documentElement.style.setProperty('--header-h', rect.height + 'px');
    }
  });

  // Dropdowns: click to toggle, Esc to close, click outside to close
  dropdownToggles.forEach(function (btn) {
    const menuId = btn.getAttribute('aria-controls');
    const menu = menuId ? document.getElementById(menuId) : null;
    if (!menu) return;

    function closeMenu() {
      btn.setAttribute('aria-expanded', 'false');
      menu.classList.remove('open');
    }

    function openMenu() {
      btn.setAttribute('aria-expanded', 'true');
      menu.classList.add('open');
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        closeMenu();
      } else {
        // Close other open dropdowns
        document.querySelectorAll('.dropdown-toggle[aria-expanded="true"]').forEach(function (other) {
          if (other !== btn) {
            const otherMenuId = other.getAttribute('aria-controls');
            const otherMenu = otherMenuId ? document.getElementById(otherMenuId) : null;
            other.setAttribute('aria-expanded', 'false');
            if (otherMenu) otherMenu.classList.remove('open');
          }
        });
        openMenu();
      }
    });

    // Keyboard support
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeMenu();
        btn.focus();
      }
      if (e.key === 'ArrowDown') {
        openMenu();
        const firstItem = menu.querySelector('a, button');
        if (firstItem) firstItem.focus();
      }
    });

    menu.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeMenu();
        btn.focus();
      }
    });
  });

  // Click outside to close dropdowns
  document.addEventListener('click', function (e) {
    const target = e.target;
    const isDropdown = target.closest && (target.closest('.has-dropdown') || target.closest('.dropdown-menu'));
    if (!isDropdown) {
      document.querySelectorAll('.dropdown-toggle[aria-expanded="true"]').forEach(function (btn) {
        const id = btn.getAttribute('aria-controls');
        const menu = id ? document.getElementById(id) : null;
        btn.setAttribute('aria-expanded', 'false');
        if (menu) menu.classList.remove('open');
      });
    }
  });

  // Close mobile nav when a link is clicked
  if (siteNav) {
    siteNav.addEventListener('click', function (e) {
      const target = e.target;
      if (target.matches('a')) {
        // collapse menu
        siteNav.classList.remove('open');
        document.body.classList.remove('no-scroll');
        if (header) header.classList.remove('menu-open');
        if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Footer year
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  // Form handling with Supabase and SendGrid integration
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Get form data
      const formData = new FormData(this);
      const data = Object.fromEntries(formData);
      
      // Simple validation
      const requiredFields = ['name', 'email', 'password', 'organization', 'group-type', 'terms'];
      const missingFields = requiredFields.filter(field => !data[field]);
      
      if (missingFields.length > 0) {
        showMessage('Vänligen fyll i alla obligatoriska fält.', 'error');
        return;
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        showMessage('Vänligen ange en giltig e-postadress.', 'error');
        return;
      }
      
      // Enhanced password validation
      const passwordErrors = validatePassword(data.password);
      if (passwordErrors.length > 0) {
        showMessage(passwordErrors.join(' '), 'error');
        return;
      }
      
      // Prepare data for API
      const submitData = {
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone || null,
        organization: data.organization,
        groupType: data['group-type'],
        participants: data.participants || null,
        goal: data.goal || null,
        timeline: data.timeline || null,
        newsletter: data.newsletter === 'on',
        termsAccepted: data.terms === 'on'
      };
      
      // Show loading state
      const submitBtn = this.querySelector('.form-submit');
      const originalText = submitBtn.textContent;
      
      submitBtn.textContent = 'Skickar...';
      submitBtn.disabled = true;
      
      try {
        // Submit to Netlify Function
        const response = await fetch('/.netlify/functions/submit-application', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(submitData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
          showMessage('Tack för din ansökan! Vi kontaktar dig inom 24 timmar.', 'success');
          this.reset();
        } else {
          throw new Error(result.error || 'Ett fel uppstod');
        }
        
      } catch (error) {
        console.error('Form submission error:', error);
        showMessage('Ett fel uppstod. Vänligen försök igen eller kontakta oss direkt.', 'error');
      } finally {
        // Reset button state
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // Enhanced password validation
  function validatePassword(password) {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('Lösenordet måste vara minst 8 tecken långt.');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Lösenordet måste innehålla minst en stor bokstav.');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Lösenordet måste innehålla minst en liten bokstav.');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('Lösenordet måste innehålla minst en siffra.');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Lösenordet måste innehålla minst ett specialtecken.');
    }
    
    return errors;
  }

  // Helper function to show messages
  function showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessage = document.querySelector('.form-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // Create new message element
    const messageEl = document.createElement('div');
    messageEl.className = `form-message form-message--${type}`;
    messageEl.textContent = message;
    
    // Insert after form
    const form = document.getElementById('contact-form');
    if (form) {
      form.parentNode.insertBefore(messageEl, form.nextSibling);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.remove();
        }
      }, 5000);
    }
  }
})();


