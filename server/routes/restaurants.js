const express = require('express');
const { body, validationResult } = require('express-validator');

const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const csrfHeader = require('../middleware/csrfHeader');

const router = express.Router();

const REVIEW_ERROR =
  'You can review this restaurant only after your own order containing its food is completed.';

// ------------------------------------------------------
// Validate request input
// ------------------------------------------------------
function sendValidationErrors(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Please check your input.',
      details: errors.array(),
    });
  }

  next();
}

// ------------------------------------------------------
// GET /api/restaurants
// List approved restaurants in Banke.
// ------------------------------------------------------
router.get('/', (req, res) => {
  try {
    const restaurants = db.prepare(`
      SELECT *
      FROM restaurants
      WHERE status = 'approved'
        AND district = 'Banke'
      ORDER BY id DESC
    `).all();

    return res.json({ restaurants });
  } catch (error) {
    console.error('List restaurants error:', error);

    return res.status(500).json({
      error: 'Failed to load restaurants.',
    });
  }
});

// ------------------------------------------------------
// GET /api/restaurants/:id/reviews
// Load a restaurant's public reviews and rating summary.
// ------------------------------------------------------
router.get('/:id/reviews', (req, res) => {
  try {
    const restaurantId = Number(req.params.id);

    if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
      return res.status(400).json({
        error: 'Invalid restaurant ID.',
      });
    }

    const restaurant = db.prepare(`
      SELECT id, name
      FROM restaurants
      WHERE id = ?
        AND status = 'approved'
        AND district = 'Banke'
    `).get(restaurantId);

    if (!restaurant) {
      return res.status(404).json({
        error: 'Restaurant not found.',
      });
    }

    const summary = db.prepare(`
      SELECT
        COALESCE(AVG(rating), 0) AS averageRating,
        COUNT(*) AS reviewCount
      FROM restaurant_reviews
      WHERE restaurant_id = ?
    `).get(restaurantId);

    const reviews = db.prepare(`
      SELECT *
      FROM restaurant_reviews
      WHERE restaurant_id = ?
      ORDER BY id DESC
      LIMIT 50
    `).all(restaurantId);

    return res.json({
      restaurant,
      averageRating: Number(summary.averageRating || 0),
      reviewCount: Number(summary.reviewCount || 0),
      reviews,
    });
  } catch (error) {
    console.error('Get restaurant reviews error:', error);

    return res.status(500).json({
      error: 'Failed to load reviews.',
    });
  }
});

// ------------------------------------------------------
// POST /api/restaurants/:id/reviews
//
// Requirements:
// 1. User must be authenticated.
// 2. CSRF protection must pass.
// 3. Rating and order ID must be valid.
// 4. Order must belong to the authenticated user.
// 5. Order must be completed.
// 6. Order must contain food from this restaurant.
//
// Existing reviews are updated instead of duplicated.
// ------------------------------------------------------
router.post(
  '/:id/reviews',

  requireAuth,
  csrfHeader,

  [
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5.'),

    body('comment')
      .optional({ nullable: true })
      .isString()
      .withMessage('Comment must be text.')
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Comment cannot exceed 2000 characters.'),

    body('order_id')
      .isInt({ min: 1 })
      .withMessage('A valid completed order ID is required.'),
  ],

  sendValidationErrors,

  (req, res) => {
    try {
      const restaurantId = Number(req.params.id);
      const userId = Number(req.user?.id);
      const orderId = Number(req.body.order_id);
      const rating = Number(req.body.rating);

      const comment =
        typeof req.body.comment === 'string'
          ? req.body.comment.trim()
          : '';

      // Validate IDs.
      if (
        !Number.isInteger(restaurantId) ||
        restaurantId <= 0 ||
        !Number.isInteger(userId) ||
        userId <= 0 ||
        !Number.isInteger(orderId) ||
        orderId <= 0
      ) {
        return res.status(400).json({
          error: 'Invalid restaurant, user, or order ID.',
        });
      }

      // Validate the restaurant.
      const restaurant = db.prepare(`
        SELECT id, name
        FROM restaurants
        WHERE id = ?
          AND status = 'approved'
          AND district = 'Banke'
      `).get(restaurantId);

      if (!restaurant) {
        return res.status(404).json({
          error: 'Restaurant not found.',
        });
      }

      // Diagnostic query: inspect the order independently
      // before deciding whether the user can review.
      const orderDetails = db.prepare(`
        SELECT
          o.id,
          o.user_id,
          o.delivery_status,
          o.completed_at,
          EXISTS (
            SELECT 1
            FROM order_items oi
            JOIN menu_items mi ON mi.id = oi.menu_item_id
            WHERE oi.order_id = o.id
              AND mi.restaurant_id = ?
          ) AS containsRestaurantFood
        FROM orders o
        WHERE o.id = ?
      `).get(restaurantId, orderId);

      console.log('[Review debug]', {
        restaurantId,
        orderId,
        authenticatedUserId: userId,
        orderFound: Boolean(orderDetails),
        orderUserId: orderDetails?.user_id ?? null,
        deliveryStatus: orderDetails?.delivery_status ?? null,
        completedAt: orderDetails?.completed_at ?? null,
        containsRestaurantFood:
          orderDetails?.containsRestaurantFood ?? null,
      });

      // Verify ownership, completion, and restaurant food.
      const eligibleOrder = db.prepare(`
        SELECT o.id
        FROM orders o
        WHERE o.id = ?
          AND o.user_id = ?
          AND o.completed_at IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM order_items oi
            JOIN menu_items mi ON mi.id = oi.menu_item_id
            WHERE oi.order_id = o.id
              AND mi.restaurant_id = ?
          )
        LIMIT 1
      `).get(orderId, userId, restaurantId);

      if (!eligibleOrder) {
        return res.status(403).json({
          error: REVIEW_ERROR,
        });
      }

      // Find the user's existing review for this restaurant.
      const existingReview = db.prepare(`
        SELECT id
        FROM restaurant_reviews
        WHERE restaurant_id = ?
          AND user_id = ?
        LIMIT 1
      `).get(restaurantId, userId);

      // Update the existing review.
      if (existingReview) {
        db.prepare(`
          UPDATE restaurant_reviews
          SET rating = ?, comment = ?
          WHERE id = ?
        `).run(
          rating,
          comment,
          existingReview.id
        );

        const review = db.prepare(`
          SELECT *
          FROM restaurant_reviews
          WHERE id = ?
        `).get(existingReview.id);

        return res.json({
          message: 'Review updated successfully.',
          review,
        });
      }

      // Insert a new review.
      const result = db.prepare(`
        INSERT INTO restaurant_reviews (
          restaurant_id,
          user_id,
          rating,
          comment
        )
        VALUES (?, ?, ?, ?)
      `).run(
        restaurantId,
        userId,
        rating,
        comment
      );

      const review = db.prepare(`
        SELECT *
        FROM restaurant_reviews
        WHERE id = ?
      `).get(result.lastInsertRowid);

      return res.status(201).json({
        message: 'Review submitted successfully.',
        review,
      });
    } catch (error) {
      console.error('Submit restaurant review error:', error);

      if (
        String(error.message).includes('UNIQUE constraint failed')
      ) {
        return res.status(409).json({
          error: 'A review already exists for this restaurant.',
        });
      }

      return res.status(500).json({
        error: 'Failed to submit review.',
      });
    }
  }
);

// ------------------------------------------------------
// Keep any existing owner-submission and admin-review
// routes here if your project uses them.
// ------------------------------------------------------

module.exports = router;
