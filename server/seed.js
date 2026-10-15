// This file adds the 20 sample meals shown in the Cravely menu.
const db = require('./db');

const items = [
  ['Buff Momo', 'Juicy buff dumplings served with house tomato achar.', 220, 'Momo', '/images/buff-momo.jpg', 1, 4.9],
  ['Chicken Momo', 'Steamed chicken dumplings with a warm sesame dip.', 260, 'Momo', '/images/chicken-momo.jpg', 1, 4.8],
  ['Veg Momo', 'Fresh garden vegetables wrapped and steamed to order.', 200, 'Momo', '/images/Veg%20Momo.jpg', 0, 4.7],
  ['Jhol Momo', 'Buff momos in a rich, tangy sesame broth.', 280, 'Momo', '/images/jhol-momo.jpg', 1, 4.9],
  ['Kothey Momo', 'Pan-fried dumplings, crisp outside and tender inside.', 280, 'Momo', '/images/kothey-momo.jpg', 0, 4.6],
  ['Chilli Momo', 'Crispy momos tossed with peppers and spicy sauce.', 320, 'Momo', '/images/chilli-momo.jpg', 0, 4.7],
  ['Dal Bhat Set', 'A comforting Nepali meal with rice, lentils and sides.', 450, 'Nepali Favorites', '/images/Dal%20bhaat.jpg', 1, 4.9],
  ['Chicken Sekuwa', 'Char-grilled chicken with Nepali herbs and spices.', 520, 'Nepali Favorites', '/images/chicken-sekuwa.jpg', 1, 4.8],
  ['Thakali Khana', 'Traditional Thakali platter with seasonal vegetables.', 580, 'Nepali Favorites', '/images/Thakali%20khana.jpg', 0, 4.8],
  ['Chicken tikka Masala', 'Smoky chicken pieces in a rich, creamy sauce.', 420, 'Nepali Favorites', '/images/chicken%20tikka Masala.jpg', 0, 4.6],
  ['Margherita Perfetta', 'Tomato, fresh mozzarella, basil and olive oil.', 650, 'Pizza', '/images/margherita-perfetta.jpg', 1, 4.8],
  ['Pepperoni Fire', 'Pepperoni, mozzarella and a fiery tomato base.', 720, 'Pizza', '/images/pepperoni-fire.jpg', 1, 4.9],
  ['Garden Pesto Pizza', 'Pesto, roasted vegetables and creamy mozzarella.', 690, 'Pizza', '/images/garden-pesto-pizza.jpg', 0, 4.6],
  ['BBQ Chicken Pizza', 'Smoky barbecue chicken with red onion.', 750, 'Pizza', '/images/bbq-chicken-pizza.jpg', 0, 4.7],
  ['Classic Beef Burger', 'Grilled beef patty, cheddar and house sauce.', 480, 'Burgers', '/images/classic-beef-burger.jpg', 1, 4.8],
  ['Crispy Chicken Burger', 'Golden chicken, slaw and creamy pepper mayo.', 460, 'Burgers', '/images/crispy-chicken-burger.jpg', 0, 4.7],
  ['Veggie Crunch Burger', 'A hearty veggie patty with fresh crunchy greens.', 390, 'Burgers', '/images/veggie-crunch-burger.jpg', 0, 4.5],
  ['Iced Lemon Tea', 'Freshly brewed black tea with lemon and ice.', 150, 'Drinks', '/images/iced-lemon-tea.jpg', 0, 4.6],
  ['Mango Lassi', 'Chilled yogurt blended with sweet, ripe mango.', 220, 'Drinks', '/images/mango-lassi.jpg', 1, 4.8],
  ['Cold Brew Coffee', 'Smooth slow-steeped coffee served over ice.', 200, 'Drinks', '/images/cold-brew-coffee.jpg', 0, 4.5],
];

const insert = db.prepare(`
  INSERT INTO menu_items
    (name, description, price, category, image, is_popular, rating)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(name) DO UPDATE SET
    description = excluded.description,
    price = excluded.price,
    category = excluded.category,
    image = excluded.image,
    is_popular = excluded.is_popular,
    rating = excluded.rating
`);
const addItems = db.transaction((menuItems) => {
  for (const [name, description, price, category, image, popular, rating] of menuItems) {
    const imageUrl = image.startsWith('/images/')
      ? image
      : `https://images.unsplash.com/${image}?auto=format&fit=crop&w=900&q=80`;
    insert.run(name, description, price, category, imageUrl, popular, rating);
  }
});

addItems(items);
console.log(`Seeded ${items.length} menu items.`);
db.close();
