
const db = require('./server/db');

// Update existing dishes and add Chicken Tikka Masala.
// This does not reset or delete any database records.

const updateImage = db.prepare(`
  UPDATE menu_items
  SET image = ?
  WHERE lower(name) = lower(?)
`);

const addChickenTikka = db.prepare(`
  INSERT INTO menu_items
    (name, description, price, category, image, is_popular, rating)
  VALUES (?, ?, ?, ?, ?, 0, 4.5)
  ON CONFLICT(name) DO NOTHING
`);

try {
  // Fix the photos for existing menu items.
  updateImage.run('/images/Kothey%20momo.jpg', 'Kothey Momo');
  updateImage.run('/images/Chilii%20Momo.jpg', 'Chilli Momo');

  // Add Chicken Tikka Masala only if it doesn't already exist.
  const result = addChickenTikka.run(
    'Chicken Tikka Masala',
    'Tender chicken in a rich, creamy tomato masala sauce.',
    350,
    'Non-Veg',
    '/images/Chicken%20tikka%20Masala.jpg'
  );

  console.log('Kothey Momo image updated.');
  console.log('Chilli Momo image updated.');
  console.log(
    result.changes
      ? 'Chicken Tikka Masala added.'
      : 'Chicken Tikka Masala already exists.'
  );
} finally {
  db.close();
}
