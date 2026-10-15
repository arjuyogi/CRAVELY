const db = require('./server/db');

const updateImage = db.prepare(`
  UPDATE menu_items
  SET image = ?
  WHERE id = ? AND image = ?
`);

const update = db.transaction(() => {
  const vegMomo = updateImage.run(
    '/images/Fried-momo.jpg',
    3,
    '/images/veg-momo.jpg'
  );

  const dalBhat = updateImage.run(
    '/images/Dal%20bhaat.jpg',
    7,
    '/images/dal-bhat.jpg'
  );

  console.log('Veg Momo updated:', vegMomo.changes);
  console.log('Dal Bhat updated:', dalBhat.changes);
});

update();

console.log(
  db.prepare(`
    SELECT id, name, image
    FROM menu_items
    WHERE id IN (3, 7)
    ORDER BY id
  `).all()
);
