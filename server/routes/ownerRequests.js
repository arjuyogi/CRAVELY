
const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const csrfHeader = require('../middleware/csrfHeader');

const router = express.Router();

// Customer submits a request for restaurant-owner access.
router.post(
  '/',
  requireAuth,
  csrfHeader,
  [
    body('businessName')
      .isString()
      .withMessage('Invalid business name.')
      .trim()
      .isLength({ min: 2, max: 100 }),
    body('message')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 }),
  ],
  (req, res, next) => {
    try {
      if (!validationResult(req).isEmpty()) {
        return res.status(400).json({
          error: 'Enter a business name between 2 and 100 characters.',
        });
      }

      if (req.user.role !== 'customer') {
        return res.status(403).json({
          error: 'Only customer accounts can request owner access.',
        });
      }

      const businessName = req.body.businessName.trim();
      const message = (req.body.message || '').trim();

      const result = db.prepare(`
        INSERT INTO owner_requests (user_id, business_name, message)
        VALUES (?, ?, ?)
      `).run(req.user.id, businessName, message);

      return res.status(201).json({
        message: 'Owner-access request submitted for review.',
        requestId: result.lastInsertRowid,
        status: 'pending',
      });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({
          error: 'You already have a pending owner-access request.',
        });
      }

      return next(error);
    }
  }
);

// A signed-in user can view only their own requests.
router.get('/mine', requireAuth, (req, res) => {
  const requests = db.prepare(`
    SELECT id, business_name, message, status, created_at, reviewed_at
    FROM owner_requests
    WHERE user_id = ?
    ORDER BY id DESC
  `).all(req.user.id);

  return res.json({ requests });
});

// Only administrators can view pending requests.
router.get('/admin/pending', requireAuth, requireAdmin, (req, res) => {
  const requests = db.prepare(`
    SELECT
      r.id,
      r.user_id,
      u.name AS applicant_name,
      u.email AS applicant_email,
      r.business_name,
      r.message,
      r.created_at
    FROM owner_requests r
    JOIN users u ON u.id = r.user_id
    WHERE r.status = 'pending'
    ORDER BY r.created_at ASC
  `).all();

  return res.json({ requests });
});

// Approve a pending request and promote its applicant atomically.
router.patch(
  '/admin/:id/approve',
  requireAuth,
  requireAdmin,
  csrfHeader,
  (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({ error: 'Invalid request ID.' });
      }

      const approve = db.transaction(() => {
        const request = db.prepare(`
          SELECT id, user_id
          FROM owner_requests
          WHERE id = ? AND status = 'pending'
        `).get(id);

        if (!request) return false;

        const user = db.prepare(
          'SELECT role FROM users WHERE id = ?'
        ).get(request.user_id);

        if (!user || user.role !== 'customer') {
          throw new Error('APPLICANT_ROLE_CHANGED');
        }

        db.prepare(`
          UPDATE users SET role = 'owner'
          WHERE id = ?
        `).run(request.user_id);

        db.prepare(`
          UPDATE owner_requests
          SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'pending'
        `).run(req.user.id, id);

        return true;
      });

      if (!approve()) {
        return res.status(404).json({
          error: 'Pending request not found.',
        });
      }

      return res.json({
        message: 'Request approved. The applicant now has owner access.',
      });
    } catch (error) {
      if (error.message === 'APPLICANT_ROLE_CHANGED') {
        return res.status(409).json({
          error: 'The applicant role changed. Review this request manually.',
        });
      }

      return next(error);
    }
  }
);

// Reject a pending request without changing the user's role.
router.patch(
  '/admin/:id/reject',
  requireAuth,
  requireAdmin,
  csrfHeader,
  (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({ error: 'Invalid request ID.' });
      }

      const result = db.prepare(`
        UPDATE owner_requests
        SET status = 'rejected',
            reviewed_by = ?,
            reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending'
      `).run(req.user.id, id);

      if (result.changes === 0) {
        return res.status(404).json({
          error: 'Pending request not found.',
        });
      }

      return res.json({ message: 'Owner-access request rejected.' });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
