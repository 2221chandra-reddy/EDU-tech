import express from 'express';
import { authRequired } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  getPlanSettings,
  presentUser,
  presentUserById,
  createCheckoutOrder,
  verifyRazorpayPayment,
  completeDemoPayment,
  listPayments,
} from '../services/billing.js';

const router = express.Router();

router.get(
  '/catalog',
  asyncHandler(async (_req, res) => {
    const settings = await getPlanSettings();
    res.json({
      free: {
        name: 'Free trial',
        days: settings.free_trial_days,
        includes: ['Diagnostic + practice', `${settings.free_trial_days} days of AI Coach (20 chats/day)`, '1 live mock per week'],
      },
      premium: {
        name: 'Premium',
        price_inr: settings.premium_price_inr,
        days: settings.premium_duration_days,
        currency: settings.currency,
        includes: ['Unlimited AI Coach', 'Unlimited live CBTs', 'Full readiness + recovery loop'],
      },
      razorpay_configured: settings.razorpay_configured,
      demo_pay_allowed: settings.demo_pay_allowed,
    });
  })
);

router.get(
  '/me',
  authRequired,
  asyncHandler(async (req, res) => {
    const user = await presentUserById(req.user.id);
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    const history = await listPayments({ userId: req.user.id, limit: 10 });
    res.json({ user, history });
  })
);

router.post(
  '/order',
  authRequired,
  asyncHandler(async (req, res) => {
    if (req.user.role === 'admin') {
      throw new AppError('Admin accounts are already premium', 400, 'ADMIN_PLAN');
    }
    try {
      const result = await createCheckoutOrder(req.user.id);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(err.message || 'Could not start checkout', 400, 'CHECKOUT_FAILED');
    }
  })
);

router.post(
  '/verify',
  authRequired,
  asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new AppError('Missing Razorpay payment fields', 400, 'INVALID_PAYMENT');
    }
    try {
      const result = await verifyRazorpayPayment({
        userId: req.user.id,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      });
      const user = await presentUser(result.user);
      res.json({ ok: true, user });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(err.message || 'Payment verification failed', 400, 'PAYMENT_FAILED');
    }
  })
);

router.post(
  '/demo-pay',
  authRequired,
  asyncHandler(async (req, res) => {
    if (req.user.role === 'admin') {
      throw new AppError('Admin accounts are already premium', 400, 'ADMIN_PLAN');
    }
    try {
      const result = await completeDemoPayment(req.user.id);
      const user = await presentUser(result.user);
      res.json({ ok: true, user, mode: 'demo' });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(err.message || 'Demo payment failed', 400, 'DEMO_PAY_FAILED');
    }
  })
);

export default router;
