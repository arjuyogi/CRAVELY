// This file fetches and displays the signed-in customer's confirmed order.
const panel = document.querySelector('#success-panel');
const errorMessage = document.querySelector('#success-error');
const orderId = new URLSearchParams(window.location.search).get('order');

function addLine(parent, text, isStrong = false) {
  const element = document.createElement(isStrong ? 'strong' : 'p');
  element.className = 'summary-line';
  element.textContent = text;
  parent.append(element);
}

async function loadOrder() {
  if (!/^\d+$/.test(orderId || '')) {
    panel.hidden = true;
    errorMessage.textContent = 'We could not find that order.';
    return;
  }
  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
    const result = await response.json();
    if (response.status === 401) return window.location.assign('/login.html');
    if (!response.ok) throw new Error('Order not found.');
    document.querySelector('#success-message').textContent = `Order #${result.order.id} · रु ${result.order.total}`;
    const list = document.querySelector('#success-items');
    for (const item of result.items) addLine(list, `${item.name} × ${item.quantity}`);
    addLine(list, `Total · रु ${result.order.total}`, true);
  } catch (error) {
    panel.hidden = true;
    errorMessage.textContent = 'We could not load that order. Please check your order history.';
  }
}

loadOrder();
