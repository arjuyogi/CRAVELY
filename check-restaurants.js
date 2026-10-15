const db = require("./server/db");

const columns = db
  .prepare("PRAGMA table_info(restaurants)")
  .all();

console.log(columns);
