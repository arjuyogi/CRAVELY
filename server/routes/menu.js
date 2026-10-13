// This file returns filtered menu items from the seeded SQLite menu.
const express = require('express');
const { query, validationResult } = require('express-validator');
const db = require('../db');

const router = express.Router();
const categories = ['Momo', 'Nepali Favorites', 'Drinks', 'Pizza', 'Burgers'];
const sortOptions = {
  recommended: 'is_popular DESC, rating DESC, name ASC',
  'price-low': 'price ASC, name ASC',
  'price-high': 'price DESC, name ASC',
  rating: 'rating DESC, is_popular DESC, name ASC',
};

router.get('/', [
  query('category').optional().isIn(categories),
  query('search').optional().trim().isLength({ max: 100 }),
  query('sort').optional().isIn(Object.keys(sortOptions)),
], (req, res) => {
  if (!validationResult(req).isEmpty()) {
    return res.status(400).json({ error: 'Invalid menu filter.' });
  }
  const conditions = [];
  const values = [];
  if (req.query.category) {
    conditions.push('category = ?');
    values.push(req.query.category);
  }
  if (req.query.search) {
    conditions.push('(name LIKE ? OR description LIKE ?)');
    values.push(`%${req.query.search}%`, `%${req.query.search}%`);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = sortOptions[req.query.sort] || sortOptions.recommended;
  const items = db.prepare(
    `SELECT id, name, description, price, category, image, is_popular, rating
     FROM menu_items ${whereClause} ORDER BY ${orderBy}`,
  ).all(...values);
  return res.json({ items, categories, total: items.length });
});

module.exports = router;
