const db = require("./server/db");

console.log("USERS TABLE:");
console.log(db.prepare("PRAGMA table_info(users)").all());

console.log("\nOWNER-RELATED TABLES:");
console.log(
  db.prepare(`
    SELECT name, sql
    FROM sqlite_master
    WHERE type = 'table'
      AND (name LIKE '%owner%' OR name LIKE '%request%')
  `).all()
);
