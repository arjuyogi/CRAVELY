// This file adds the 20 sample meals shown in the Cravely menu.
const db = require('./db');

const items = [
  ['Buff Momo', 'Juicy buff dumplings served with house tomato achar.', 220, 'Momo', '/images/buff-momo.jpg', 1, 4.9],
  ['Chicken Momo', 'Steamed chicken dumplings with a warm sesame dip.', 260, 'Momo', '/images/chicken-momo.jpg', 1, 4.8],
  ['Veg Momo', 'Fresh garden vegetables wrapped and steamed to order.', 200, 'Momo', '/images/veg-momo.jpg', 0, 4.7],
  ['Jhol Momo', 'Buff momos in a rich, tangy sesame broth.', 280, 'Momo', '/images/jhol-momo.jpg', 1, 4.9],
  ['Kothey Momo', 'Pan-fried dumplings, crisp outside and tender inside.', 280, 'Momo', '/images/buff-momo.jpg', 0, 4.6],
  ['Chilli Momo', 'Crispy momos tossed with peppers and spicy sauce.', 320, 'Momo', '/images/jhol-momo.jpg', 0, 4.7],
  ['Dal Bhat Set', 'A comforting Nepali meal with rice, lentils and sides.', 450, 'Nepali Favorites', '/images/dal-bhat.jpg', 1, 4.9],
  ['Chicken Sekuwa', 'Char-grilled chicken with Nepali herbs and spices.', 520, 'Nepali Favorites', 'photo-1604908176997-125f25cc6f3d', 1, 4.8],
  ['Thakali Khana', 'Traditional Thakali platter with seasonal vegetables.', 580, 'Nepali Favorites', '/images/dal-bhat.jpg', 0, 4.8],
  ['Paneer Tikka', 'Smoky paneer cubes with peppers and mint chutney.', 420, 'Nepali Favorites', 'photo-1512621776951-a57141f2eefd', 0, 4.6],
  ['Margherita Perfetta', 'Tomato, fresh mozzarella, basil and olive oil.', 650, 'Pizza', 'photo-1574071318508-1cdbab80d002', 1, 4.8],
  ['Pepperoni Fire', 'Pepperoni, mozzarella and a fiery tomato base.', 720, 'Pizza', 'photo-1628840042765-356cda07504e', 1, 4.9],
  ['Garden Pesto Pizza', 'Pesto, roasted vegetables and creamy mozzarella.', 690, 'Pizza', 'photo-1574071318508-1cdbab80d002', 0, 4.6],
  ['BBQ Chicken Pizza', 'Smoky barbecue chicken with red onion.', 750, 'Pizza', 'photo-1628840042765-356cda07504e', 0, 4.7],
  ['Classic Beef Burger', 'Grilled beef patty, cheddar and house sauce.', 480, 'Burgers', 'photo-1568901346375-23c9450c58cd', 1, 4.8],
  ['Crispy Chicken Burger', 'Golden chicken, slaw and creamy pepper mayo.', 460, 'Burgers', 'photo-1568901346375-23c9450c58cd', 0, 4.7],
  ['Veggie Crunch Burger', 'A hearty veggie patty with fresh crunchy greens.', 390, 'Burgers', 'photo-1520072959219-c595dc870360', 0, 4.5],
  ['Iced Lemon Tea', 'Freshly brewed black tea with lemon and ice.', 150, 'Drinks', 'photo-1556679343-c7306c1976bc', 0, 4.6],
  ['Mango Lassi', 'Chilled yogurt blended with sweet, ripe mango.', 220, 'Drinks', 'photo-1553530666-ba11a7da3888', 1, 4.8],
  ['Cold Brew Coffee', 'Smooth slow-steeped coffee served over ice.', 200, 'Drinks', 'photo-1517701550927-30cf4ba1dba5', 0, 4.5],
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
