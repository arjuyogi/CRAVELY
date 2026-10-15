// Opens the SQLite database and creates the tables Cravely needs.

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

// Create the data folder if it does not exist.
const dataFolder = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataFolder, { recursive: true });

// Open the database.
const db = new Database(path.join(dataFolder, 'cravely.db'));

// Enable foreign key constraints.
db.pragma('foreign_keys = ON');

// Create the tables.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    phone TEXT,
    email TEXT,
    address TEXT NOT NULL,
    municipality TEXT NOT NULL,
    ward TEXT,
    district TEXT NOT NULL DEFAULT 'Banke',
    source TEXT NOT NULL CHECK (source IN ('admin', 'owner')),
    owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    category TEXT NOT NULL,
    image TEXT NOT NULL,
    is_popular INTEGER NOT NULL DEFAULT 0,
    rating REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
    quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
    UNIQUE(user_id, menu_item_id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    subtotal INTEGER NOT NULL,
    delivery_fee INTEGER NOT NULL,
    tax INTEGER NOT NULL,
    discount INTEGER NOT NULL,
    total INTEGER NOT NULL,
    status TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10)
  );
`);


/* Add order completion tracking safely to existing databases. */
const orderColumns = db.pragma('table_info(orders)');

if (!orderColumns.some((column) => column.name === 'completed_at')) {
  db.exec(`
    ALTER TABLE orders
    ADD COLUMN completed_at TEXT;
  `);
}


/* Add delivery tracking safely to existing orders. */
const deliveryColumns = db.pragma('table_info(orders)');

if (!deliveryColumns.some((column) => column.name === 'delivery_status')) {
  db.exec(`
    ALTER TABLE orders
    ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'placed'
    CHECK (
      delivery_status IN (
        'placed',
        'preparing',
        'ready',
        'out_for_delivery',
        'delivered'
      )
    );
  `);
}

/* Add restaurant reviews safely without deleting existing data. */
db.exec(`
  CREATE TABLE IF NOT EXISTS restaurant_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL
      REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL
      REFERENCES users(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL
      REFERENCES orders(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (restaurant_id, user_id, order_id)
  );

  CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_restaurant
    ON restaurant_reviews(restaurant_id, created_at);
`);


/* Add user roles safely to existing databases. */
const userColumns = db.pragma('table_info(users)');

if (!userColumns.some((column) => column.name === 'role')) {
  db.exec(`
    ALTER TABLE users
    ADD COLUMN role TEXT NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'owner', 'admin'));
  `);
}

// Add restaurant_id to existing databases without deleting menu data.
const menuItemColumns = db.pragma('table_info(menu_items)');

if (!menuItemColumns.some((column) => column.name === 'restaurant_id')) {
  db.exec(`
    ALTER TABLE menu_items
    ADD COLUMN restaurant_id INTEGER
    REFERENCES restaurants(id) ON DELETE SET NULL;
  `);
}


/* Store restaurant-owner access requests safely. */
db.exec(`
  CREATE TABLE IF NOT EXISTS owner_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_owner_requests_one_pending
  ON owner_requests(user_id)
  WHERE status = 'pending';
`);

// Add indexes to speed up restaurant and menu lookups.
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_restaurants_district_status
  ON restaurants(district, status);

  CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant
  ON menu_items(restaurant_id);
`);


/* ================= LOYALTY POINTS ================= */

// Each transaction records points earned or redeemed.
// A unique order/type pair prevents duplicate rewards.
db.exec(`
  CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL
      REFERENCES users(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL
      REFERENCES orders(id) ON DELETE CASCADE,
    type TEXT NOT NULL
      CHECK (type IN ('earn', 'redeem')),
    points INTEGER NOT NULL CHECK (points > 0),
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (order_id, type)
  );

  CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_user
    ON loyalty_transactions(user_id, id DESC);
`);

/* Store how many points were redeemed on each order. */
const currentOrderColumns = db.pragma('table_info(orders)');

if (!currentOrderColumns.some((column) =>
  column.name === 'points_redeemed'
)) {
  db.exec(`
    ALTER TABLE orders
    ADD COLUMN points_redeemed INTEGER NOT NULL DEFAULT 0
    CHECK (points_redeemed >= 0);
  `);
}

/* ================= DELIVERY HISTORY ================= */

// Record every delivery-status change with its timestamp.
db.exec(`
  CREATE TABLE IF NOT EXISTS delivery_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL
      REFERENCES orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL
      CHECK (status IN (
        'placed',
        'preparing',
        'ready',
        'out_for_delivery',
        'delivered'
      )),
    changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (order_id, status)
  );

  CREATE INDEX IF NOT EXISTS idx_delivery_history_order
    ON delivery_history(order_id, id);
`);

/* Add an initial tracking event for existing orders. */
db.exec(`
  INSERT OR IGNORE INTO delivery_history (order_id, status)
  SELECT id, delivery_status
  FROM orders;
`);

/* Export the fully initialized database. */
module.exports = db;