
const db = require('./server/db');

try {
  const result = db.prepare(`
    UPDATE menu_items
    SET image = ?
    WHERE name = ?
  `).run('/images/Panner%20Tikka.webp', 'Paneer Tikka');

  if (result.changes > 0) {
    console.log('Paneer Tikka image updated successfully!');
  } else {
    console.log('Paneer Tikka menu item was not found.');
  }
} finally {
  db.close();
}
