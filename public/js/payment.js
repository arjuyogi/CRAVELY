// This file validates demo card fields locally and sends only payment method.
const form = document.querySelector('#payment-form');
const message = document.querySelector('#payment-message');
const cardNumber = document.querySelector('#card-number');
const expiry = document.querySelector('#card-expiry');
let paymentMethod = 'card';
let promoCode = sessionStorage.getItem('cravelyPromo') || '';

function setMessage(text) {
  message.textContent = text;
}

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

function expiryIsValid(value) {
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(value)) return false;
  const [month, shortYear] = value.split('/').map(Number);
  const now = new Date();
  const year = 2000 + shortYear;
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}

function renderPaymentSummary(totals, items) {
  const summary = document.querySelector('#payment-summary');
  summary.replaceChildren();
  for (const item of items) {
    const row = document.createElement('p');
    row.className = 'summary-line';
    const name = document.createElement('span');
    name.textContent = `${item.name} × ${item.quantity}`;
    const amount = document.createElement('strong');
    amount.textContent = `रु ${item.price * item.quantity}`;
    row.append(name, amount);
    summary.append(row);
  }
  const total = document.createElement('p');
  total.className = 'summary-line summary-total';
  total.textContent = `Total · रु ${totals.total}`;
  summary.append(total);
  document.querySelector('#pay-button').textContent = `Pay रु ${totals.total}`;
}

async function loadPayment() {
  try {
    let response;
    if (promoCode) {
      response = await fetch('/api/cart/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ code: promoCode }),
      });
    } else {
      response = await fetch('/api/cart');
    }
    const cart = await response.json();
    if (response.status === 401) return window.location.assign('/login.html');
    if (!response.ok) throw new Error(cart.error || 'Could not load your order.');
    if (!cart.items.length) return window.location.assign('/cart.html');
    renderPaymentSummary(cart.totals, cart.items);
  } catch (error) {
    setMessage('Could not load your checkout. Please return to your cart.');
    document.querySelector('#pay-button').disabled = true;
  }
}

document.querySelectorAll('[data-method]').forEach((button) => {
  button.addEventListener('click', () => {
    paymentMethod = button.dataset.method;
    document.querySelectorAll('[data-method]').forEach((choice) => choice.classList.toggle('active', choice === button));
    document.querySelector('#card-fields').hidden = paymentMethod !== 'card';
    setMessage('');
  });
});

cardNumber.addEventListener('input', () => {
  const digits = cardNumber.value.replace(/\D/g, '').slice(0, 19);
  cardNumber.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
});
expiry.addEventListener('input', () => {
  const digits = expiry.value.replace(/\D/g, '').slice(0, 4);
  expiry.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const digits = cardNumber.value.replace(/\s/g, '');
  if (paymentMethod === 'card' && !luhnIsValid(digits)) return setMessage('Enter a valid card number.');
  if (paymentMethod === 'card' && !document.querySelector('#card-name').value.trim()) return setMessage('Enter the name on your card.');
  if (paymentMethod === 'card' && !expiryIsValid(expiry.value)) return setMessage('Enter an expiry date that is not in the past.');
  if (paymentMethod === 'card' && !/^\d{3,4}$/.test(document.querySelector('#card-cvv').value)) return setMessage('Enter a valid CVV.');
  const button = document.querySelector('#pay-button');
  button.disabled = true;
  try {
    const response = await fetch('/api/orders/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ payment_method: paymentMethod, promoCode }),
    });
    const result = await response.json();
    if (response.status === 401) return window.location.assign('/login.html');
    if (!response.ok) throw new Error(result.error || 'Payment could not be completed.');
    sessionStorage.removeItem('cravelyPromo');
    window.location.assign(`/success.html?order=${encodeURIComponent(result.order.id)}`);
  } catch (error) {
    setMessage('Checkout could not be completed. Please try again.');
    button.disabled = false;
  }
});

loadPayment();
