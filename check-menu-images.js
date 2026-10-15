const db = require('./server/db');

const rows = db.prepare(`
  SELECT id, name, image
  FROM menu_items
  WHERE name LIKE '%Dal Bhat%'
     OR name LIKE '%Momo%'
`).all();

console.log(rows);
