// This file renders cart items and submits quantity and promo changes.
const itemList = document.querySelector('#cart-items');
const summary = document.querySelector('#summary-lines');
const cartMessage = document.querySelector('#cart-message');
const promoMessage = document.querySelector('#promo-message');
const promoCodeInput = document.querySelector('#promo-code');
promoCodeInput.value = sessionStorage.getItem('cravelyPromo') || '';

function addText(parent, tag, className, value) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value;
  parent.append(element);
  return element;
}

function renderSummary(totals) {
  summary.replaceChildren();
  const lines = [
    ['Subtotal', totals.subtotal],
    ['Delivery fee', totals.deliveryFee],
    ['Tax (8%)', totals.tax],
    ['Discount', -totals.discount],
  ];
  for (const [label, amount] of lines) {
    const row = document.createElement('p');
    row.className = 'summary-line';
    addText(row, 'span', '', label);
    addText(row, 'strong', '', `रु ${amount < 0 ? `-${Math.abs(amount)}` : amount}`);
    summary.append(row);
  }
  const total = document.createElement('p');
  total.className = 'summary-line summary-total';
  addText(total, 'span', '', 'Total');
  addText(total, 'strong', '', `रु ${totals.total}`);
  summary.append(total);
  document.querySelector('#proceed-button').textContent = `Proceed to Payment · रु ${totals.total}`;
}

function createCartRow(item) {
  const row = document.createElement('article');
  row.className = 'cart-row';
  const image = document.createElement('img');
  image.className = 'cart-row-image';
  image.src = item.image;
  image.alt = item.name;
  const details = document.createElement('div');
  addText(details, 'h2', 'cart-row-name', item.name);
  addText(details, 'p', 'cart-row-each', `रु ${item.price} each`);
  const controls = document.createElement('div');
  controls.className = 'cart-row-controls';
  controls.append(makeQuantityButton('−', item, -1), addText(controls, 'span', 'quantity-value', String(item.quantity)), makeQuantityButton('+', item, 1));
  const remove = makeTextButton('×', 'remove-button', `Remove ${item.name}`);
  remove.addEventListener('click', () => removeItem(item.id));
  controls.append(remove);
  details.append(controls);
  const price = addText(row, 'strong', 'cart-row-total', `रु ${item.lineTotal}`);
  row.append(image, details, price);
  return row;
}

function makeTextButton(text, className, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  button.setAttribute('aria-label', label);
  return button;
}

function makeQuantityButton(text, item, adjustment) {
  const button = makeTextButton(text, 'quantity-button', `${adjustment < 0 ? 'Decrease' : 'Increase'} ${item.name} quantity`);
  button.addEventListener('click', () => updateQuantity(item.id, item.quantity + adjustment));
  return button;
}

function renderCart(cart) {
  document.querySelector('#cart-count').textContent = String(cart.itemCount);
  const hasItems = cart.items.length > 0;
  document.querySelector('#cart-content').querySelector('.cart-layout').hidden = !hasItems;
  document.querySelector('#empty-cart').hidden = hasItems;
  itemList.replaceChildren(...cart.items.map(createCartRow));
  renderSummary(cart.totals);
}

async function requestCart(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), 'X-Requested-With': 'XMLHttpRequest' },
  });
  const result = await response.json();
  if (response.status === 401) return window.location.assign('/login.html');
  if (!response.ok) throw new Error(result.error || 'Cart update failed.');
  renderCart(await applySavedPromo(result));
}

async function applySavedPromo(cart) {
  const code = sessionStorage.getItem('cravelyPromo');
  if (!code) return cart;
  const response = await fetch('/api/cart/promo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify({ code }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Promo code could not be applied.');
  return result;
}

async function loadCart() {
  try {
    await requestCart('/api/cart');
    if (sessionStorage.getItem('cravelyPromo')) {
      promoMessage.textContent = 'CRAVE10 applied — 10% off your subtotal.';
    }
  } catch (error) {
    cartMessage.textContent = 'We could not load your cart. Please try again.';
    cartMessage.classList.add('is-error');
  }
}

async function updateQuantity(itemId, quantity) {
  if (quantity < 1 || quantity > 10) return;
  try {
    await requestCart(`/api/cart/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity }),
    });
  } catch (error) {
    cartMessage.textContent = error.message;
    cartMessage.classList.add('is-error');
  }
}

async function removeItem(itemId) {
  try {
    await requestCart(`/api/cart/${itemId}`, { method: 'DELETE' });
  } catch (error) {
    cartMessage.textContent = error.message;
    cartMessage.classList.add('is-error');
  }
}

document.querySelector('#promo-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const response = await fetch('/api/cart/promo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ code: promoCodeInput.value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Promo code is not valid.');
    sessionStorage.setItem('cravelyPromo', 'CRAVE10');
    promoMessage.textContent = 'CRAVE10 applied — 10% off your subtotal.';
    promoMessage.classList.remove('is-error');
    renderCart(result);
  } catch (error) {
    sessionStorage.removeItem('cravelyPromo');
    promoMessage.textContent = 'That promo code is not valid.';
    promoMessage.classList.add('is-error');
  }
});

document.querySelector('#proceed-button').addEventListener('click', (event) => {
  if (!itemList.children.length) event.preventDefault();
});
loadCart();
