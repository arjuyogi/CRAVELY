// This file displays only the orders returned for the current signed-in user.
const orderList = document.querySelector('#order-list');
const noOrders = document.querySelector('#no-orders');
const errorMessage = document.querySelector('#orders-error');

function makeOrderCard(order) {
  const card = document.createElement('article');
  card.className = 'order-card';
  const details = document.createElement('div');
  const heading = document.createElement('h2');
  heading.className = 'food-name';
  heading.textContent = `Order #${order.id}`;
  const date = document.createElement('p');
  date.textContent = new Date(`${order.createdAt}Z`).toLocaleString();
  const status = document.createElement('p');
  status.textContent = order.status;
  const link = document.createElement('a');
  link.className = 'order-link';
  link.href = `/success.html?order=${encodeURIComponent(order.id)}`;
  link.textContent = 'View order';
  details.append(heading, date, status, link);
  const total = document.createElement('strong');
  total.className = 'order-total';
  total.textContent = `रु ${order.total}`;
  card.append(details, total);
  return card;
}

async function loadOrders() {
  try {
    const response = await fetch('/api/orders');
    const result = await response.json();
    if (response.status === 401) return window.location.assign('/login.html');
    if (!response.ok) throw new Error('Could not load your orders.');
    orderList.replaceChildren(...result.orders.map(makeOrderCard));
    noOrders.hidden = result.orders.length > 0;
  } catch (error) {
    errorMessage.textContent = 'We could not load your orders. Please try again.';
  }
}

loadOrders();
