
/*
  Cravely menu and restaurant discovery.
  Renders customer-visible text safely using textContent.
*/

// ---------------- DOM ELEMENTS ----------------

// Menu elements
const grid = document.querySelector('#food-grid');
const categoriesElement = document.querySelector('#category-list');
const searchInput = document.querySelector('#menu-search');
const sortInput = document.querySelector('#sort-menu');
const messageElement = document.querySelector('#menu-message');

// Restaurant discovery elements
const restaurantGrid = document.querySelector('#restaurant-grid');
const restaurantSearch = document.querySelector('#restaurant-search');
const municipalityFilter = document.querySelector('#municipality-filter');
const restaurantRatingFilter = document.querySelector(
  '#restaurant-rating-filter'
);
const restaurantMessage = document.querySelector('#restaurant-message');
const noRestaurants = document.querySelector('#no-restaurants');

// ---------------- STATE ----------------

let allRestaurants = [];

const restaurantReviews = new Map();
const restaurantRatings = new Map();

let activeCategory = '';
let searchTimer;

// ---------------- HELPER ----------------

function makeElement(tagName, className, text) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

// ---------------- MENU CATEGORIES ----------------

function renderCategories(categories) {
  categoriesElement.replaceChildren();

  const names = ['All', ...categories];

  for (const name of names) {
    const category = name === 'All' ? '' : name;

    const button = makeElement(
      'button',
      `category-chip${category === activeCategory ? ' active' : ''}`,
      name
    );

    button.type = 'button';

    button.addEventListener('click', () => {
      activeCategory = category;
      renderCategories(categories);
      loadMenu();
    });

    categoriesElement.append(button);
  }
}

// ---------------- FOOD CARDS ----------------

function createFoodCard(item) {
  const card = makeElement('article', 'food-card');
  const imageWrap = makeElement('div', 'food-image-wrap');
  const image = makeElement('img', 'food-image');

  image.src = item.image;
  image.alt = item.name;
  image.loading = 'lazy';

  imageWrap.append(image);

  if (item.is_popular) {
    imageWrap.append(
      makeElement('span', 'popular-badge', 'Popular')
    );
  }

  const content = makeElement('div', 'food-content');

  content.append(
    makeElement('h3', 'food-name', item.name),
    makeElement('p', 'food-description', item.description)
  );

  const meta = makeElement('div', 'food-meta');

  meta.append(
    makeElement('span', 'food-price', `रु ${item.price}`),
    makeElement(
      'span',
      'food-rating',
      `★ ${Number(item.rating).toFixed(1)}`
    )
  );

  const add = makeElement('button', 'add-button', 'Add');

  add.type = 'button';
  add.setAttribute('aria-label', `Add ${item.name} to cart`);

  add.addEventListener('click', () => {
    addToCart(item.id, add);
  });

  meta.append(add);
  content.append(meta);
  card.append(imageWrap, content);

  return card;
}

function renderMenu(items) {
  grid.replaceChildren(...items.map(createFoodCard));

  document.querySelector('#menu-heading').textContent =
    `Explore the menu (${items.length})`;

  document.querySelector('#no-results').hidden = items.length > 0;
}

async function loadMenu() {
  const parameters = new URLSearchParams({
    sort: sortInput.value,
  });

  if (activeCategory) {
    parameters.set('category', activeCategory);
  }

  if (searchInput.value.trim()) {
    parameters.set('search', searchInput.value.trim());
  }

  try {
    const response = await fetch(`/api/menu?${parameters}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Could not load the menu.');
    }

    renderMenu(result.items);
    renderCategories(result.categories);

    messageElement.textContent = '';
    messageElement.classList.remove('is-error');
  } catch (error) {
    console.error('Could not load menu:', error);

    messageElement.textContent =
      'We could not load the menu. Please refresh to try again.';

    messageElement.classList.add('is-error');
  }
}

// ---------------- ADD TO CART ----------------

async function addToCart(menuItemId, button) {
  button.disabled = true;

  try {
    const response = await fetch('/api/cart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        menuItemId,
        quantity: 1,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Could not add this item.');
    }

    document.querySelector('#cart-count').textContent =
      String(result.itemCount);

    messageElement.textContent = 'Added to your cart.';
    messageElement.classList.remove('is-error');
  } catch (error) {
    if (error.message === 'Please sign in to continue.') {
      window.location.assign('/login.html');
      return;
    }

    messageElement.textContent =
      'Could not add this item. Please try again.';

    messageElement.classList.add('is-error');
  } finally {
    button.disabled = false;
  }
}

// ---------------- RESTAURANT DISCOVERY ----------------

async function loadRestaurants() {
  restaurantMessage.textContent = 'Loading restaurants...';
  restaurantMessage.classList.remove('is-error');

  try {
    const response = await fetch('/api/restaurants');

  if (!response.ok) {
  throw new Error('Could not load restaurants.');
  }

const result = await response.json();

allRestaurants = Array.isArray(result)
  ? result
  : Array.isArray(result.restaurants)
    ? result.restaurants
    : [];

  if (allRestaurants.length === 0) {
  console.warn('No restaurants were returned by the API:', result);
  }

    // Load reviews and ratings once for each restaurant.
    await Promise.all(
      allRestaurants.map(async (restaurant) => {
        try {
          const ratingResponse = await fetch(
            `/api/restaurants/${restaurant.id}/reviews`
          );

        
        if (!ratingResponse.ok) {
         const errorText = await ratingResponse.text();

         console.error(
           `Reviews request failed for restaurant ${restaurant.id}:`,
          ratingResponse.status,
            errorText
          );

  restaurantReviews.set(restaurant.id, []);
  restaurantRatings.set(restaurant.id, {
    averageRating: 0,
    reviewCount: 0,
  });

  return;
}

          const data = await ratingResponse.json();

          // Store written reviews for restaurant cards.
          restaurantReviews.set(
            restaurant.id,
            data.reviews || []
          );

          // Store the average rating and review count.
          restaurantRatings.set(restaurant.id, {
            averageRating: Number(data.averageRating) || 0,
            reviewCount: Number(data.reviewCount) || 0,
          });
        } catch (error) {
          console.error(
            `Could not load reviews for restaurant ${restaurant.id}:`,
            error
          );

          restaurantReviews.set(restaurant.id, []);
          restaurantRatings.set(restaurant.id, {
            averageRating: 0,
            reviewCount: 0,
          });
        }
      })
    );

    // Build municipality dropdown options.
    const municipalities = [
      ...new Set(
        allRestaurants
          .map((restaurant) => restaurant.municipality)
          .filter(Boolean)
      ),
    ].sort();

    municipalityFilter.replaceChildren();

    const allOption = makeElement(
      'option',
      '',
      'All municipalities'
    );

    allOption.value = '';
    municipalityFilter.append(allOption);

    for (const municipality of municipalities) {
      const option = makeElement('option', '', municipality);

      option.value = municipality;
      municipalityFilter.append(option);
    }

    renderRestaurants();

    restaurantMessage.textContent = '';
  } catch (error) {
    console.error('Could not load restaurants:', error);

    restaurantMessage.textContent =
      'Could not load restaurants. Please refresh to try again.';

    restaurantMessage.classList.add('is-error');
  }
}

// ---------------- FILTER AND RENDER RESTAURANTS ----------------

function renderRestaurants() {
  const search = restaurantSearch.value.trim().toLowerCase();
  const municipality = municipalityFilter.value;

  const minimumRating = Number(restaurantRatingFilter.value);

  const filteredRestaurants = allRestaurants.filter((restaurant) => {
    const searchableText = [
      restaurant.name,
      restaurant.description,
      restaurant.address,
      restaurant.municipality,
      restaurant.district,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    // Match restaurant name, description, or location.
    const matchesSearch = searchableText.includes(search);

    // Match selected municipality.
    const matchesMunicipality =
      !municipality ||
      restaurant.municipality === municipality;

    // Match minimum average star rating.
    const ratingInfo = restaurantRatings.get(restaurant.id);
    const averageRating = ratingInfo?.averageRating || 0;

    const matchesRating = averageRating >= minimumRating;

    return (
      matchesSearch &&
      matchesMunicipality &&
      matchesRating
    );
  });

  restaurantGrid.replaceChildren();

  for (const restaurant of filteredRestaurants) {
    const card = makeElement('article', 'restaurant-card');

    const name = makeElement('h3', '', restaurant.name);

    const description = makeElement(
      'p',
      '',
      restaurant.description || 'Discover delicious food here.'
    );

    const location = makeElement(
      'p',
      'restaurant-location',
      [
        restaurant.address,
        restaurant.municipality,
        restaurant.district,
      ]
        .filter(Boolean)
        .join(', ')
    );

    const rating = restaurantRatings.get(restaurant.id) || {
      averageRating: 0,
      reviewCount: 0,
    };

    const ratingText = makeElement(
      'p',
      'restaurant-rating',
      rating.reviewCount > 0
        ? `★ ${rating.averageRating.toFixed(1)} · ${
            rating.reviewCount
          } ${
            rating.reviewCount === 1 ? 'review' : 'reviews'
          }`
        : '☆ No reviews yet'
    );

    card.append(
      name,
      description,
      ratingText,
      location
    );

    // ---------------- CUSTOMER REVIEWS ----------------

    const reviewsContainer = makeElement(
      'div',
      'restaurant-reviews'
    );

    const reviewsHeading = makeElement(
      'h4',
      '',
      'Customer Reviews'
    );

    reviewsContainer.append(reviewsHeading);

    const reviews = restaurantReviews.get(restaurant.id) || [];

    if (reviews.length === 0) {
      reviewsContainer.append(
        makeElement(
          'p',
          'no-reviews',
          'No written reviews yet.'
        )
      );
    } else {
      for (const review of reviews) {
        const reviewItem = makeElement(
          'article',
          'restaurant-review'
        );

        const stars = makeElement(
          'p',
          'review-stars',
          `${'★'.repeat(review.rating)}${'☆'.repeat(
            5 - review.rating
          )}`
        );

        const reviewer = makeElement(
          'p',
          'reviewer-name',
          review.reviewerName || 'Customer'
        );

        const comment = makeElement(
          'p',
          'review-comment',
          review.comment || 'No comment provided.'
        );

        reviewItem.append(stars, reviewer, comment);
        reviewsContainer.append(reviewItem);
      }
    }

    card.append(reviewsContainer);

    // ---------------- REVIEW FORM ----------------

    const reviewForm = document.createElement('form');
    reviewForm.className = 'restaurant-review-form';

    const reviewHeading = makeElement(
      'h4',
      '',
      'Write a Review'
    );

    const orderLabel = makeElement(
      'label',
      '',
      'Completed Order ID'
    );

    const orderInput = document.createElement('input');

    orderInput.type = 'number';
    orderInput.name = 'order_id';
    orderInput.min = '1';
    orderInput.placeholder = 'Enter your order ID';
    orderInput.required = true;

    const ratingLabel = makeElement(
      'label',
      '',
      'Your Rating'
    );

    const ratingSelect = document.createElement('select');

    ratingSelect.name = 'rating';
    ratingSelect.required = true;

    for (let stars = 5; stars >= 1; stars--) {
      const option = document.createElement('option');

      option.value = String(stars);
      option.textContent = `${'★'.repeat(stars)} (${stars}/5)`;

      ratingSelect.append(option);
    }

    const commentLabel = makeElement(
      'label',
      '',
      'Your Comment'
    );

    const commentInput = document.createElement('textarea');

    commentInput.name = 'comment';
    commentInput.placeholder = 'How was your food and service?';
    commentInput.maxLength = 1000;
    commentInput.rows = 3;
    commentInput.required = true;

    const submitButton = makeElement(
      'button',
      '',
      'Submit Review'
    );

    submitButton.type = 'submit';

    const reviewMessage = makeElement(
      'p',
      'review-message',
      ''
    );

    reviewForm.append(
      reviewHeading,
      orderLabel,
      orderInput,
      ratingLabel,
      ratingSelect,
      commentLabel,
      commentInput,
      submitButton,
      reviewMessage
    );

    reviewForm.addEventListener(
      'submit',
      async (event) => {
        event.preventDefault();

        submitButton.disabled = true;
        reviewMessage.textContent = 'Submitting your review...';

        try {
          const response = await fetch(
            `/api/restaurants/${restaurant.id}/reviews`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
              },
              body: JSON.stringify({
                order_id: Number(orderInput.value),
                rating: Number(ratingSelect.value),
                comment: commentInput.value.trim(),
              }),
            }
          );

          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              data.error || 'Could not submit your review.'
            );
          }

          // Refresh reviews and ratings after submission.
          const ratingResponse = await fetch(
            `/api/restaurants/${restaurant.id}/reviews`
          );

          if (!ratingResponse.ok) {
            throw new Error(
              'Your review was submitted, but refreshing reviews failed. Please refresh the page.'
            );
          }

          const ratingData = await ratingResponse.json();

          restaurantReviews.set(
            restaurant.id,
            ratingData.reviews || []
          );

          restaurantRatings.set(restaurant.id, {
            averageRating: Number(ratingData.averageRating) || 0,
            reviewCount: Number(ratingData.reviewCount) || 0,
          });

          // Clear the form and refresh the restaurant cards.
          reviewForm.reset();

          renderRestaurants();

          // Show a confirmation after rendering the cards.
          const updatedCard = [
            ...restaurantGrid.querySelectorAll('.restaurant-card'),
          ].find((element) => {
            return element.querySelector('h3')?.textContent ===
              restaurant.name;
          });

          const updatedMessage = updatedCard?.querySelector(
            '.review-message'
          );

          if (updatedMessage) {
            updatedMessage.textContent =
              'Thank you! Your review was submitted.';
          }
        } catch (error) {
          reviewMessage.textContent = error.message;
        } finally {
          submitButton.disabled = false;
        }
      }
    );

    card.append(reviewForm);

    restaurantGrid.append(card);
  }

  // Display the empty state if no restaurants match.
  noRestaurants.hidden = filteredRestaurants.length > 0;
}

// ---------------- RESTAURANT FILTER LISTENERS ----------------

restaurantSearch.addEventListener(
  'input',
  renderRestaurants
);

municipalityFilter.addEventListener(
  'change',
  renderRestaurants
);

restaurantRatingFilter.addEventListener(
  'change',
  renderRestaurants
);

// ---------------- CUSTOMER LOGIN ----------------

async function startMenu() {
  try {
    const response = await fetch('/api/auth/me');

    if (!response.ok) {
      window.location.assign('/login.html');
      return;
    }

    const { user } = await response.json();

    document.querySelector('#avatar-button').textContent =
      user.name.slice(0, 1).toUpperCase();

    document.querySelector('#avatar-button').addEventListener(
      'click',
      async () => {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
          },
        });

        window.location.assign('/login.html');
      }
    );

    await loadMenu();
  } catch (error) {
    console.error('Could not verify session:', error);

    messageElement.textContent =
      'Unable to verify your session. Please refresh the page.';

    messageElement.classList.add('is-error');
  }
}

// ---------------- MENU EVENT LISTENERS ----------------

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadMenu, 300);
});

sortInput.addEventListener('change', loadMenu);

// ---------------- START APPLICATION ----------------

startMenu();
loadRestaurants();
