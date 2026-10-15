const db = require('./server/db');

const update = db.prepare(
  'UPDATE menu_items SET image = ? WHERE name = ?'
);

const fixImages = db.transaction(() => {
  console.log('Veg Momo:', update.run('/images/Veg%20Momo.jpg', 'Veg Momo').changes);
  console.log('Dal Bhat Set:', update.run('/images/Dal%20bhaat.jpg', 'Dal Bhat Set').changes);
  console.log('Thakali Khana:', update.run('/images/Thakali%20khana.jpg', 'Thakali Khana').changes);
});

fixImages();

console.log(db.prepare(`
  SELECT name, image FROM menu_items
  WHERE name IN ('Veg Momo', 'Dal Bhat Set', 'Thakali Khana')
`).all());

db.close();
