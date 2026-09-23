document.addEventListener('DOMContentLoaded', () => {
  // Quantity stepper buttons on book detail / cart pages
  document.querySelectorAll('[data-qty-step]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.querySelector(btn.dataset.target);
      if (!input) return;
      const step = parseInt(btn.dataset.qtyStep, 10);
      const next = Math.max(1, (parseInt(input.value, 10) || 1) + step);
      input.value = next;
    });
  });

  // Auto-dismiss alerts after 4s
  document.querySelectorAll('.alert').forEach(alert => {
    setTimeout(() => {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
      bsAlert.close();
    }, 4000);
  });

  // Close the mobile nav automatically after tapping a link inside it,
  // so the menu doesn't stay open covering the page on small screens.
  const mainNav = document.getElementById('mainNav');
  if (mainNav) {
    mainNav.querySelectorAll('a.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        if (mainNav.classList.contains('show')) {
          bootstrap.Collapse.getOrCreateInstance(mainNav).hide();
        }
      });
    });
  }

  // ---- Checkout payment field formatting ----
  const cardNumber = document.getElementById('cardNumber');
  if (cardNumber) {
    cardNumber.addEventListener('input', () => {
      const digits = cardNumber.value.replace(/\D/g, '').slice(0, 16);
      cardNumber.value = digits.replace(/(.{4})/g, '$1 ').trim();
    });
  }

  const cardExpiry = document.getElementById('cardExpiry');
  if (cardExpiry) {
    cardExpiry.addEventListener('input', () => {
      let digits = cardExpiry.value.replace(/\D/g, '').slice(0, 4);
      if (digits.length >= 3) {
        digits = digits.slice(0, 2) + '/' + digits.slice(2);
      }
      cardExpiry.value = digits;
    });
  }

  const cardCvc = document.getElementById('cardCvc');
  if (cardCvc) {
    cardCvc.addEventListener('input', () => {
      cardCvc.value = cardCvc.value.replace(/\D/g, '').slice(0, 4);
    });
  }
});
