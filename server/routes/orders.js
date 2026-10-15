
/* Handles checkout, customer orders, loyalty points and delivery tracking. */

const express = require('express');
const { body, param, validationResult } = require('express-validator');

const db = require('../db');
const csrfHeader = require('../middleware/csrfHeader');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const { calculateTotals, PROMO_CODE } = require('../pricing');

const router = express.Router();

router.use(requireAuth);

const DELIVERY_STAGES = [
  'placed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
];

/* ===================== HELPERS ===================== */

function validInput(req, res, next) {
  if (validationResult(req).isEmpty()) {
    return next();
  }

  return res.status(400).json({
    error: 'Invalid order request.',
  });
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function readOrderItems(orderId) {
  return db.prepare(`
    SELECT
      menu_item_id AS menuItemId,
      name,
      price,
      quantity
    FROM order_items
    WHERE order_id = ?
    ORDER BY id
  `).all(orderId);
}

function readDeliveryHistory(orderId) {
  return db.prepare(`
    SELECT
      status,
      changed_at AS changedAt
    FROM delivery_history
    WHERE order_id = ?
    ORDER BY id ASC
  `).all(orderId);
}

function getLoyaltyBalance(userId) {
  const result = db.prepare(`
    SELECT COALESCE(
      SUM(
        CASE
          WHEN type = 'earn' THEN points
          WHEN type = 'redeem' THEN -points
          ELSE 0
        END
      ),
      0
    ) AS balance
    FROM loyalty_transactions
    WHERE user_id = ?
  `).get(userId);

  return Number(result.balance);
}

/* ===================== CREATE ORDER ===================== */

function createOrder(
  userId,
  paymentMethod,
  promoCode,
  requestedPoints
) {
  const pointsToRedeem = Number(requestedPoints ?? 0);

  if (
    !Number.isSafeInteger(pointsToRedeem) ||
    pointsToRedeem < 0
  ) {
    throw createHttpError(
      400,
      'The requested loyalty points are invalid.'
    );
  }

  const items = db.prepare(`
    SELECT
      menu_items.id AS menuItemId,
      menu_items.name,
      menu_items.price,
      cart_items.quantity
    FROM cart_items
    JOIN menu_items
      ON menu_items.id = cart_items.menu_item_id
    WHERE cart_items.user_id = ?
  `).all(userId);

  if (items.length === 0) {
    return null;
  }

  const balance = getLoyaltyBalance(userId);

  if (pointsToRedeem > balance) {
    throw createHttpError(
      400,
      'You do not have enough loyalty points.'
    );
  }

  const totals = calculateTotals(
    items,
    promoCode,
    pointsToRedeem
  );

  if (totals.pointsRedeemed !== pointsToRedeem) {
    throw createHttpError(
      400,
      'The requested points exceed the permitted discount.'
    );
  }

  const orderResult = db.prepare(`
    INSERT INTO orders (
      user_id,
      subtotal,
      delivery_fee,
      tax,
      discount,
      total,
      status,
      payment_method,
      points_redeemed
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    totals.subtotal,
    totals.deliveryFee,
    totals.tax,
    totals.discount,
    totals.total,
    'paid (demo)',
    paymentMethod,
    totals.pointsRedeemed
  );

  const orderId = Number(orderResult.lastInsertRowid);

  const insertItem = db.prepare(`
    INSERT INTO order_items (
      order_id,
      menu_item_id,
      name,
      price,
      quantity
    )
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const item of items) {
    insertItem.run(
      orderId,
      item.menuItemId,
      item.name,
      item.price,
      item.quantity
    );
  }

  if (totals.pointsRedeemed > 0) {
    db.prepare(`
      INSERT INTO loyalty_transactions (
        user_id,
        order_id,
        type,
        points,
        description
      )
      VALUES (?, ?, 'redeem', ?, ?)
    `).run(
      userId,
      orderId,
      totals.pointsRedeemed,
      'Points redeemed at checkout'
    );
  }

  db.prepare(`
    INSERT OR IGNORE INTO delivery_history (
      order_id,
      status
    )
    VALUES (?, 'placed')
  `).run(orderId);

  db.prepare(`
    DELETE FROM cart_items
    WHERE user_id = ?
  `).run(userId);

  return {
    id: orderId,
    ...totals,
    status: 'paid (demo)',
    paymentMethod,
    deliveryStatus: 'placed',
    items,
  };
}

/* ===================== CHECKOUT ===================== */

router.post(
  '/checkout',
  csrfHeader,
  [
    body('payment_method')
      .isIn(['card', 'wallet']),

    body('promoCode')
      .optional({ values: 'falsy' })
      .trim()
      .toUpperCase()
      .isIn([PROMO_CODE]),

    body('pointsToRedeem')
      .optional()
      .isInt({ min: 0, max: 2147483647 })
      .toInt(),
  ],
  validInput,
  (req, res, next) => {
    try {
      const checkout = db.transaction(() => {
        return createOrder(
          req.user.id,
          req.body.payment_method,
          req.body.promoCode || '',
          req.body.pointsToRedeem ?? 0
        );
      }).immediate();

      if (!checkout) {
        return res.status(400).json({
          error: 'Your cart is empty.',
        });
      }

      return res.status(201).json({
        order: checkout,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          error: error.message,
        });
      }

      return next(error);
    }
  }
);

/* ===================== LOYALTY ===================== */

router.get('/loyalty', (req, res, next) => {
  try {
    const balance = getLoyaltyBalance(req.user.id);

    const transactions = db.prepare(`
      SELECT
        id,
        order_id AS orderId,
        type,
        points,
        description,
        created_at AS createdAt
      FROM loyalty_transactions
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 50
    `).all(req.user.id);

    return res.json({
      balance,
      transactions,
      rules: {
        pointsPerRs100: 1,
        valuePerPoint: 1,
        awardWhen: 'delivered',
      },
    });
  } catch (error) {
    return next(error);
  }
});

/* ===================== ADMIN DELIVERY LIST ===================== */

router.get(
  '/admin/deliveries',
  requireAdmin,
  (req, res, next) => {
    try {
      const orders = db.prepare(`
        SELECT
          o.id,
          o.user_id AS userId,
          u.name AS customerName,
          u.email AS customerEmail,
          o.subtotal,
          o.delivery_fee AS deliveryFee,
          o.tax,
          o.discount,
          o.total,
          o.status,
          o.payment_method AS paymentMethod,
          o.created_at AS createdAt,
          o.delivery_status AS deliveryStatus,
          o.completed_at AS completedAt,
          o.points_redeemed AS pointsRedeemed,
          (
            SELECT GROUP_CONCAT(
              oi.name || ' x' || oi.quantity,
              ', '
            )
            FROM order_items oi
            WHERE oi.order_id = o.id
          ) AS itemsSummary
        FROM orders o
        JOIN users u ON u.id = o.user_id
        ORDER BY o.id DESC
        LIMIT 100
      `).all();

      return res.json({ orders });
    } catch (error) {
      return next(error);
    }
  }
);

/* ===================== CUSTOMER ORDER LIST ===================== */

router.get('/', (req, res, next) => {
  try {
    const orders = db.prepare(`
      SELECT
        id,
        subtotal,
        delivery_fee AS deliveryFee,
        tax,
        discount,
        total,
        status,
        payment_method AS paymentMethod,
        created_at AS createdAt,
        delivery_status AS deliveryStatus,
        completed_at AS completedAt,
        points_redeemed AS pointsRedeemed
      FROM orders
      WHERE user_id = ?
      ORDER BY id DESC
    `).all(req.user.id);

    return res.json({ orders });
  } catch (error) {
    return next(error);
  }
});

/* ===================== ORDER TRACKING ===================== */

router.get(
  '/:id/tracking',
  [param('id').isInt({ min: 1 }).toInt()],
  validInput,
  (req, res, next) => {
    try {
      const order = db.prepare(`
        SELECT
          id,
          delivery_status AS deliveryStatus,
          created_at AS createdAt,
          completed_at AS completedAt
        FROM orders
        WHERE id = ? AND user_id = ?
      `).get(req.params.id, req.user.id);

      if (!order) {
        return res.status(404).json({
          error: 'Order not found.',
        });
      }

      return res.json({
        order,
        stages: DELIVERY_STAGES,
        history: readDeliveryHistory(order.id),
      });
    } catch (error) {
      return next(error);
    }
  }
);

/* ===================== SINGLE CUSTOMER ORDER ===================== */

router.get(
  '/:id',
  [param('id').isInt({ min: 1 }).toInt()],
  validInput,
  (req, res, next) => {
    try {
      const order = db.prepare(`
        SELECT
          id,
          subtotal,
          delivery_fee AS deliveryFee,
          tax,
          discount,
          total,
          status,
          payment_method AS paymentMethod,
          created_at AS createdAt,
          delivery_status AS deliveryStatus,
          completed_at AS completedAt,
          points_redeemed AS pointsRedeemed
        FROM orders
        WHERE id = ? AND user_id = ?
      `).get(req.params.id, req.user.id);

      if (!order) {
        return res.status(404).json({
          error: 'Order not found.',
        });
      }

      return res.json({
        order,
        items: readOrderItems(order.id),
        deliveryHistory: readDeliveryHistory(order.id),
      });
    } catch (error) {
      return next(error);
    }
  }
);

/* ===================== UPDATE DELIVERY STATUS ===================== */

router.patch(
  '/:id/delivery-status',
  requireAdmin,
  csrfHeader,
  [
    param('id').isInt({ min: 1 }).toInt(),

    body('delivery_status')
      .isIn(DELIVERY_STAGES),
  ],
  validInput,
  (req, res, next) => {
    try {
      const nextStatus = req.body.delivery_status;

      const updatedOrder = db.transaction(() => {
        const order = db.prepare(`
          SELECT
            id,
            user_id AS userId,
            subtotal,
            delivery_status AS deliveryStatus,
            completed_at AS completedAt
          FROM orders
          WHERE id = ?
        `).get(req.params.id);

        if (!order) {
          throw createHttpError(404, 'Order not found.');
        }

        const currentIndex = DELIVERY_STAGES.indexOf(
          order.deliveryStatus
        );

        const nextIndex = DELIVERY_STAGES.indexOf(nextStatus);

        if (currentIndex === -1) {
          throw createHttpError(
            409,
            'The current delivery status is invalid.'
          );
        }

        if (nextIndex < currentIndex) {
          throw createHttpError(
            409,
            'Delivery status cannot move backwards.'
          );
        }

        if (nextIndex > currentIndex + 1) {
          throw createHttpError(
            409,
            'Please complete the delivery stages in order.'
          );
        }

        if (nextStatus !== order.deliveryStatus) {
          db.prepare(`
            UPDATE orders
            SET delivery_status = ?
            WHERE id = ?
          `).run(nextStatus, order.id);

          db.prepare(`
            INSERT OR IGNORE INTO delivery_history (
              order_id,
              status
            )
            VALUES (?, ?)
          `).run(order.id, nextStatus);
        }

        if (nextStatus === 'delivered') {
          db.prepare(`
            UPDATE orders
            SET completed_at = COALESCE(
              completed_at,
              CURRENT_TIMESTAMP
            )
            WHERE id = ?
          `).run(order.id);

          const earnedPoints = Math.floor(
            Number(order.subtotal) / 100
          );

          if (earnedPoints > 0) {
            // Check first so an existing reward is not inserted again.
            // The immediate transaction serializes concurrent writers.
            const existingReward = db.prepare(`
              SELECT id
              FROM loyalty_transactions
              WHERE order_id = ?
                AND type = 'earn'
              LIMIT 1
            `).get(order.id);

            if (!existingReward) {
              db.prepare(`
                INSERT OR IGNORE INTO loyalty_transactions (
                  user_id,
                  order_id,
                  type,
                  points,
                  description
                )
                VALUES (?, ?, 'earn', ?, ?)
              `).run(
                order.userId,
                order.id,
                earnedPoints,
                'Reward for delivered order'
              );
            }
          }
        }

        return db.prepare(`
          SELECT
            id,
            status,
            delivery_status AS deliveryStatus,
            completed_at AS completedAt,
            points_redeemed AS pointsRedeemed
          FROM orders
          WHERE id = ?
        `).get(order.id);
      }).immediate();

      return res.json({
        message: 'Delivery status updated.',
        order: updatedOrder,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          error: error.message,
        });
      }

      return next(error);
    }
  }
);

module.exports = router;
