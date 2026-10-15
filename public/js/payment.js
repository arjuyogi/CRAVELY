
/* 
 * Cravely checkout:
 * - Validates demo card fields locally.
 * - Supports card and digital wallet selection.
 * - Keeps promo codes.
 * - Displays and redeems loyalty points.
 * - Sends checkout details to the server.
 */

const form = document.querySelector('#payment-form');
const message = document.querySelector('#payment-message');
const cardNumber = document.querySelector('#card-number');
const expiry = document.querySelector('#card-expiry');
const summary = document.querySelector('#payment-summary');
const payButton = document.querySelector('#pay-button');

let paymentMethod = 'card';
let promoCode = sessionStorage.getItem('cravelyPromo') || '';
let cartItems = [];
let cartTotals = {};
let availablePoints = 0;
let pointsToRedeem = 0;

// Show a message to the customer.
function setMessage(text) {
  message.textContent = text;
}

// Validate a card number using the Luhn algorithm.
function luhnIsValid(number) {
  if (!/^\d{13,19}$/.test(number)) return false;

  let sum = 0;

  for (let index = 0; index < number.length; index += 1) {
    let digit = Number(number[number.length - 1 - index]);

    if (index % 2 === 1) digit *= 2;
    if (digit > 9) digit -= 9;

    sum += digit;
  }

  return sum % 10 === 0;
}

// Validate the card expiry date (MM/YY).
function expiryIsValid(value) {
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(value)) {
    return false;
  }

  const [month, shortYear] = value.split('/').map(Number);
  const now = new Date();
  const year = 2000 + shortYear;

  return (
    year > now.getFullYear() ||
    (year === now.getFullYear() && month >= now.getMonth() + 1)
  );
}

// Create a summary row safely without inserting HTML strings.
function createSummaryRow(label, value, className = 'summary-line') {
  const row = document.createElement('p');
  row.className = className;

  const labelElement = document.createElement('span');
  labelElement.textContent = label;

  const valueElement = document.createElement('strong');
  valueElement.textContent = value;

  row.append(labelElement, valueElement);

  return row;
}

// Add the loyalty-points controls to the existing order summary.
function createLoyaltyControls() {
  if (document.querySelector('#loyalty-controls')) return;

  const section = document.createElement('section');
  section.id = 'loyalty-controls';
  section.className = 'loyalty-controls';

  const heading = document.createElement('h3');
  heading.textContent = 'Cravely Rewards';

  const balance = document.createElement('p');
  balance.id = 'loyalty-balance';
  balance.textContent = 'Loading your points...';

  const label = document.createElement('label');
  label.htmlFor = 'points-to-redeem';
  label.textContent = 'Points to redeem';

  const input = document.createElement('input');
  input.id = 'points-to-redeem';
  input.type = 'number';
  input.min = '0';
  input.step = '1';
  input.value = '0';
  input.inputMode = 'numeric';
  input.autocomplete = 'off';

  const help = document.createElement('p');
  help.id = 'loyalty-help';
  help.textContent = '1 point = रु 1 discount.';

  const applyButton = document.createElement('button');
  applyButton.type = 'button';
  applyButton.id = 'apply-points';
  applyButton.className = 'button';
  applyButton.textContent = 'Apply points';

  applyButton.addEventListener('click', () => {
    const value = Number(input.value);

    if (!Number.isSafeInteger(value) || value < 0) {
      setMessage('Enter a whole number of points.');
      return;
    }

    if (value > availablePoints) {
      setMessage('You do not have enough loyalty points.');
      return;
    }

    pointsToRedeem = value;
    setMessage('');
    renderPaymentSummary();
  });

  section.append(heading, balance, label, input, help, applyButton);
  summary.append(section);
}

// Render cart items, totals and the loyalty discount.
function renderPaymentSummary() {
  summary.replaceChildren();

  for (const item of cartItems) {
    const row = createSummaryRow(
      `${item.name} × ${item.quantity}`,
      `रु ${item.price * item.quantity}`
    );

    summary.append(row);
  }

  if (cartTotals.subtotal !== undefined) {
    summary.append(
      createSummaryRow('Subtotal', `रु ${cartTotals.subtotal}`)
    );
  }

  if (cartTotals.deliveryFee !== undefined) {
    summary.append(
      createSummaryRow('Delivery fee', `रु ${cartTotals.deliveryFee}`)
    );
  }

  if (cartTotals.tax !== undefined) {
    summary.append(createSummaryRow('Tax', `रु ${cartTotals.tax}`));
  }

  // Show any existing promotion discount.
  if (cartTotals.discount > 0) {
    summary.append(
      createSummaryRow(
        'Promotion discount',
        `− रु ${cartTotals.discount}`
      )
    );
  }

  // This estimate is for display only. The server must recalculate it.
  const estimatedTotal = Math.max(
    0,
    Number(cartTotals.total || 0) - pointsToRedeem
  );

  if (pointsToRedeem > 0) {
    summary.append(
      createSummaryRow(
        `Loyalty discount (${pointsToRedeem} points)`,
        `− रु ${pointsToRedeem}`
      )
    );
  }

  summary.append(
    createSummaryRow(
      'Estimated total',
      `रु ${estimatedTotal}`,
      'summary-line summary-total'
    )
  );

  createLoyaltyControls();

  const balance = document.querySelector('#loyalty-balance');
  if (balance) {
    balance.textContent = `Available balance: ${availablePoints} points`;
  }

  const pointsInput = document.querySelector('#points-to-redeem');

  if (pointsInput) {
    pointsInput.max = String(availablePoints);
    pointsInput.value = String(pointsToRedeem);
  }

  payButton.textContent = `Pay रु ${estimatedTotal}`;
}

// Load the cart and calculate the current checkout estimate.
async function loadPayment() {
  try {
    let response;

    if (promoCode) {
      response = await fetch('/api/cart/promo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ code: promoCode }),
      });
    } else {
      response = await fetch('/api/cart');
    }

    const cart = await response.json();

    if (response.status === 401) {
      window.location.assign('/login.html');
      return;
    }

    if (!response.ok) {
      throw new Error(cart.error || 'Could not load your order.');
    }

    if (!cart.items || cart.items.length === 0) {
      window.location.assign('/cart.html');
      return;
    }

    cartItems = cart.items;
    cartTotals = cart.totals;

    renderPaymentSummary();

    // This endpoint will be added in the backend update.
    await loadLoyaltyPoints();
  } catch (error) {
    console.error('Checkout loading error:', error);
    setMessage('Could not load checkout. Please return to your cart.');
    payButton.disabled = true;
  }
}

// Fetch the authenticated customer's loyalty balance.
async function loadLoyaltyPoints() {
  const balance = document.querySelector('#loyalty-balance');
  const input = document.querySelector('#points-to-redeem');
  const applyButton = document.querySelector('#apply-points');

  try {
    const response = await fetch('/api/orders/loyalty', {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const result = await response.json();

    if (response.status === 401) {
      window.location.assign('/login.html');
      return;
    }

    if (!response.ok) {
      throw new Error(result.error || 'Could not load loyalty points.');
    }

    availablePoints = Number(result.balance) || 0;

    balance.textContent = `Available balance: ${availablePoints} points`;
    input.max = String(availablePoints);
    applyButton.disabled = false;
  } catch (error) {
    // Checkout can still be used if the loyalty endpoint is unavailable.
    console.warn('Loyalty balance unavailable:', error);

    balance.textContent = 'Loyalty points are temporarily unavailable.';
    input.disabled = true;
    applyButton.disabled = true;
  }
}

// Switch between card and digital wallet.
document.querySelectorAll('[data-method]').forEach((button) => {
  button.addEventListener('click', () => {
    paymentMethod = button.dataset.method;

    document.querySelectorAll('[data-method]').forEach((choice) => {
      choice.classList.toggle('active', choice === button);
    });

    document.querySelector('#card-fields').hidden =
      paymentMethod !== 'card';

    setMessage('');
  });
});

// Format card number as groups of four digits.
cardNumber.addEventListener('input', () => {
  const digits = cardNumber.value.replace(/\D/g, '').slice(0, 19);

  cardNumber.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
});

// Format expiry as MM/YY.
expiry.addEventListener('input', () => {
  const digits = expiry.value.replace(/\D/g, '').slice(0, 4);

  expiry.value =
    digits.length > 2
      ? `${digits.slice(0, 2)}/${digits.slice(2)}`
      : digits;
});

// Submit the checkout.
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('');

  const digits = cardNumber.value.replace(/\s/g, '');

  if (paymentMethod === 'card' && !luhnIsValid(digits)) {
    setMessage('Enter a valid card number.');
    return;
  }

  if (
    paymentMethod === 'card' &&
    !document.querySelector('#card-name').value.trim()
  ) {
    setMessage('Enter the name on your card.');
    return;
  }

  if (paymentMethod === 'card' && !expiryIsValid(expiry.value)) {
    setMessage('Enter an expiry date that is not in the past.');
    return;
  }

  if (
    paymentMethod === 'card' &&
    !/^\d{3,4}$/.test(document.querySelector('#card-cvv').value)
  ) {
    setMessage('Enter a valid CVV.');
    return;
  }

  payButton.disabled = true;

  try {
    const response = await fetch('/api/orders/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        payment_method: paymentMethod,
        promoCode,
        pointsToRedeem,
      }),
    });

    const result = await response.json();

    if (response.status === 401) {
      window.location.assign('/login.html');
      return;
    }

    if (!response.ok) {
      throw new Error(result.error || 'Checkout could not be completed.');
    }

    sessionStorage.removeItem('cravelyPromo');

    window.location.assign(
      `/success.html?order=${encodeURIComponent(result.order.id)}`
    );
  } catch (error) {
    console.error('Checkout error:', error);
    setMessage(error.message || 'Checkout failed. Please try again.');
    payButton.disabled = false;
  }
});

loadPayment();
