const db = require('./server/db');

console.log(
  db.prepare(`
    SELECT id, name, image
    FROM menu_items
    ORDER BY id
  `).all()
);

db.close();
