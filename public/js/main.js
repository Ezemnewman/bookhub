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

  // ---- Checkout payment field formatting ----

  // Card number: digits only, grouped in 4s ("4242 4242 4242 4242")
  const cardNumber = document.getElementById('cardNumber');
  if (cardNumber) {
    cardNumber.addEventListener('input', () => {
      const digits = cardNumber.value.replace(/\D/g, '').slice(0, 16);
      cardNumber.value = digits.replace(/(.{4})/g, '$1 ').trim();
    });
  }

  // Expiry: digits only, auto-insert "/" after MM ("MM/YY")
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

  // CVC: digits only
  const cardCvc = document.getElementById('cardCvc');
  if (cardCvc) {
    cardCvc.addEventListener('input', () => {
      cardCvc.value = cardCvc.value.replace(/\D/g, '').slice(0, 4);
    });
  }
});
