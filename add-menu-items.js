
const db = require('./server/db');

const items = [
  ['Samosa', 'Crispy golden samosas served with chutney.', 80, 'Snacks', '/images/Samosa.jpg'],
  ['Roti Masu', 'Roti served with flavorful meat curry.', 350, 'Nepali Favorites', '/images/Roti-masu.jpg'],
  ['Thukpa', 'Warm noodle soup with vegetables and spices.', 220, 'Nepali Favorites', '/images/Thuppa.jpg'],
  ['Onion Pakoda', 'Crispy onion fritters seasoned with spices.', 150, 'Snacks', '/images/Onion-Pakodas.jpg'],
  ['Bread Pakoda', 'Golden, crispy bread fritters.', 120, 'Snacks', '/images/bread%20pakoda.webp'],
  ['Salad', 'Fresh salad with seasonal vegetables.', 180, 'Salads', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80']
];

const insert = db.prepare(`
  INSERT INTO menu_items
    (name, description, price, category, image, is_popular, rating)
  VALUES (?, ?, ?, ?, ?, 0, 4.5)
  ON CONFLICT(name) DO NOTHING
`);

const addItems = db.transaction(() => {
  for (const item of items) {
    const result = insert.run(...item);
    console.log(
      result.changes ? `Added: ${item[0]}` : `Already exists: ${item[0]}`
    );
  }
});

try {
  addItems();
} finally {
  db.close();
}
