const db = require("./server/db");

const result = db.prepare(`
  INSERT INTO restaurants (
    name,
    description,
    address,
    municipality,
    district,
    source,
    status
  )
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(
  "Cravely Demo Restaurant",
  "A demo restaurant for testing the Cravely API.",
  "Demo Address",
  "Nepalgunj",
  "Banke",
  "admin",
  "approved"
);

console.log("Test restaurant created with ID:", result.lastInsertRowid);
