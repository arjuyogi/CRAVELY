// This file checks out carts and serves each customer's own order history.
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const csrfHeader = require('../middleware/csrfHeader');
const requireAuth = require('../middleware/requireAuth');
const { calculateTotals, PROMO_CODE } = require('../pricing');

const router = express.Router();
router.use(requireAuth);

function validInput(req, res, next) {
  if (validationResult(req).isEmpty()) return next();
  return res.status(400).json({ error: 'Invalid order request.' });
}

function readOrderItems(orderId) {
  return db.prepare(`
    SELECT menu_item_id AS menuItemId, name, price, quantity
    FROM order_items WHERE order_id = ? ORDER BY id
  `).all(orderId);
}

function createOrder(userId, paymentMethod, promoCode) {
  const items = db.prepare(`
    SELECT menu_items.id AS menuItemId, menu_items.name, menu_items.price, cart_items.quantity
    FROM cart_items JOIN menu_items ON menu_items.id = cart_items.menu_item_id
    WHERE cart_items.user_id = ?
  `).all(userId);
  if (!items.length) return null;
  const totals = calculateTotals(items, promoCode);
  const insertOrder = db.prepare(`
    INSERT INTO orders
      (user_id, subtotal, delivery_fee, tax, discount, total, status, payment_method)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const orderId = insertOrder.run(
    userId, totals.subtotal, totals.deliveryFee, totals.tax,
    totals.discount, totals.total, 'paid (demo)', paymentMethod,
  ).lastInsertRowid;
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, menu_item_id, name, price, quantity)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const item of items) {
    insertItem.run(orderId, item.menuItemId, item.name, item.price, item.quantity);
  }
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
  return { id: orderId, ...totals, status: 'paid (demo)', paymentMethod, items };
}

router.post('/checkout', csrfHeader, [
  body('payment_method').isIn(['card', 'wallet']),
  body('promoCode').optional({ values: 'falsy' }).trim().toUpperCase().isIn([PROMO_CODE]),
], validInput, (req, res, next) => {
  try {
    const checkout = db.transaction(() => createOrder(
      req.user.id, req.body.payment_method, req.body.promoCode || '',
    ))();
    if (!checkout) return res.status(400).json({ error: 'Your cart is empty.' });
    return res.status(201).json({ order: checkout });
  } catch (error) {
    return next(error);
  }
});

router.get('/', (req, res) => {
  const orders = db.prepare(`
    SELECT id, subtotal, delivery_fee AS deliveryFee, tax, discount, total,
      status, payment_method AS paymentMethod, created_at AS createdAt
    FROM orders WHERE user_id = ? ORDER BY id DESC
  `).all(req.user.id);
  return res.json({ orders });
});

router.get('/:id', [
  param('id').isInt({ min: 1 }).toInt(),
], validInput, (req, res) => {
  const order = db.prepare(`
    SELECT id, subtotal, delivery_fee AS deliveryFee, tax, discount, total,
      status, payment_method AS paymentMethod, created_at AS createdAt
    FROM orders WHERE id = ? AND user_id = ?
  `).get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  return res.json({ order, items: readOrderItems(order.id) });
});

module.exports = router;
