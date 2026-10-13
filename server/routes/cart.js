// This file manages each signed-in customer's own cart and promo calculation.
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const csrfHeader = require('../middleware/csrfHeader');
const requireAuth = require('../middleware/requireAuth');
const { calculateTotals, PROMO_CODE } = require('../pricing');

const router = express.Router();
router.use(requireAuth);

function readCart(userId) {
  const items = db.prepare(`
    SELECT cart_items.id, menu_items.id AS menuItemId, menu_items.name,
      menu_items.description, menu_items.price, menu_items.image,
      cart_items.quantity
    FROM cart_items JOIN menu_items ON menu_items.id = cart_items.menu_item_id
    WHERE cart_items.user_id = ?
    ORDER BY cart_items.id
  `).all(userId).map((item) => ({ ...item, lineTotal: item.price * item.quantity }));
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  return { items, itemCount };
}

function sendCart(res, userId, promoCode = '') {
  const cart = readCart(userId);
  return res.json({ ...cart, totals: calculateTotals(cart.items, promoCode) });
}

function validInput(req, res, next) {
  if (validationResult(req).isEmpty()) return next();
  return res.status(400).json({ error: 'Please check the cart information.' });
}

router.get('/', (req, res) => sendCart(res, req.user.id));

router.post('/', csrfHeader, [
  body('menuItemId').isInt({ min: 1 }).toInt(),
  body('quantity').optional().isInt({ min: 1, max: 10 }).toInt(),
], validInput, (req, res) => {
  const menuItem = db.prepare('SELECT id FROM menu_items WHERE id = ?').get(req.body.menuItemId);
  if (!menuItem) return res.status(404).json({ error: 'Menu item not found.' });
  const quantity = req.body.quantity || 1;
  const addItem = db.prepare(`
    INSERT INTO cart_items (user_id, menu_item_id, quantity) VALUES (?, ?, ?)
    ON CONFLICT(user_id, menu_item_id) DO UPDATE
    SET quantity = cart_items.quantity + excluded.quantity
    WHERE cart_items.quantity + excluded.quantity <= 10
  `);
  const result = addItem.run(req.user.id, menuItem.id, quantity);
  if (result.changes === 0) return res.status(400).json({ error: 'Maximum quantity per item is 10.' });
  return sendCart(res, req.user.id);
});

router.put('/:itemId', csrfHeader, [
  param('itemId').isInt({ min: 1 }).toInt(),
  body('quantity').isInt({ min: 1, max: 10 }).toInt(),
], validInput, (req, res) => {
  const result = db.prepare(
    'UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?',
  ).run(req.body.quantity, req.params.itemId, req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Cart item not found.' });
  return sendCart(res, req.user.id);
});

router.delete('/:itemId', csrfHeader, [
  param('itemId').isInt({ min: 1 }).toInt(),
], validInput, (req, res) => {
  const result = db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?')
    .run(req.params.itemId, req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Cart item not found.' });
  return sendCart(res, req.user.id);
});

router.post('/promo', csrfHeader, [
  body('code').trim().toUpperCase().isIn([PROMO_CODE]),
], validInput, (req, res) => sendCart(res, req.user.id, PROMO_CODE));

module.exports = router;
