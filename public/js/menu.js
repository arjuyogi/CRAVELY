// This file loads the menu and safely renders customer-visible menu text.
const grid = document.querySelector('#food-grid');
const categoriesElement = document.querySelector('#category-list');
const searchInput = document.querySelector('#menu-search');
const sortInput = document.querySelector('#sort-menu');
const messageElement = document.querySelector('#menu-message');
let activeCategory = '';
let searchTimer;

function makeElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderCategories(categories) {
  categoriesElement.replaceChildren();
  const names = ['All', ...categories];
  for (const name of names) {
    const category = name === 'All' ? '' : name;
    const button = makeElement('button', `category-chip${category === activeCategory ? ' active' : ''}`, name);
    button.type = 'button';
    button.addEventListener('click', () => {
      activeCategory = category;
      renderCategories(categories);
      loadMenu();
    });
    categoriesElement.append(button);
  }
}

function createFoodCard(item) {
  const card = makeElement('article', 'food-card');
  const imageWrap = makeElement('div', 'food-image-wrap');
  const image = makeElement('img', 'food-image');
  image.src = item.image;
  image.alt = item.name;
  image.loading = 'lazy';
  imageWrap.append(image);
  if (item.is_popular) imageWrap.append(makeElement('span', 'popular-badge', 'Popular'));
  const content = makeElement('div', 'food-content');
  content.append(makeElement('h3', 'food-name', item.name));
  content.append(makeElement('p', 'food-description', item.description));
  const meta = makeElement('div', 'food-meta');
  meta.append(makeElement('span', 'food-price', `रु ${item.price}`));
  meta.append(makeElement('span', 'food-rating', `★ ${Number(item.rating).toFixed(1)}`));
  const add = makeElement('button', 'add-button', 'Add');
  add.type = 'button';
  add.setAttribute('aria-label', `Add ${item.name} to cart`);
  add.addEventListener('click', () => addToCart(item.id, add));
  meta.append(add);
  content.append(meta);
  card.append(imageWrap, content);
  return card;
}

function renderMenu(items) {
  grid.replaceChildren(...items.map(createFoodCard));
  document.querySelector('#menu-heading').textContent = `Explore the menu (${items.length})`;
  document.querySelector('#no-results').hidden = items.length > 0;
}

async function loadMenu() {
  const parameters = new URLSearchParams({ sort: sortInput.value });
  if (activeCategory) parameters.set('category', activeCategory);
  if (searchInput.value.trim()) parameters.set('search', searchInput.value.trim());
  try {
    const response = await fetch(`/api/menu?${parameters}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not load the menu.');
    renderMenu(result.items);
    renderCategories(result.categories);
    messageElement.textContent = '';
  } catch (error) {
    messageElement.textContent = 'We could not load the menu. Please refresh to try again.';
    messageElement.classList.add('is-error');
  }
}

async function addToCart(menuItemId, button) {
  button.disabled = true;
  try {
    const response = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ menuItemId, quantity: 1 }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not add this item.');
    document.querySelector('#cart-count').textContent = String(result.itemCount);
    messageElement.textContent = 'Added to your cart.';
    messageElement.classList.remove('is-error');
  } catch (error) {
    if (error.message === 'Please sign in to continue.') return window.location.assign('/login.html');
    messageElement.textContent = 'Could not add this item. Please try again.';
    messageElement.classList.add('is-error');
  } finally {
    button.disabled = false;
  }
}

async function startMenu() {
  const response = await fetch('/api/auth/me');
  if (!response.ok) return window.location.assign('/login.html');
  const { user } = await response.json();
  document.querySelector('#avatar-button').textContent = user.name.slice(0, 1).toUpperCase();
  document.querySelector('#avatar-button').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    window.location.assign('/login.html');
  });
  await loadMenu();
}

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadMenu, 300);
});
sortInput.addEventListener('change', loadMenu);
startMenu();
