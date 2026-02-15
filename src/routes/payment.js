const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { protect } = require("../middleware/auth");
const { isAdmin } = require("../middleware/adminAuth");

// Public routes
// POST /api/payment/webhook - Nkwa Pay webhook endpoint (no auth required)
router.post("/webhook", paymentController.handleWebhook);

// GET /api/payment/fee - Get current payment fee
router.get("/fee", paymentController.getFee);

// User routes (require authentication)
// POST /api/payment/initiate - Initiate payment
router.post("/initiate", protect, paymentController.initiatePayment);

// GET /api/payment/status/:transactionId - Check payment status
router.get("/status/:transactionId", protect, paymentController.checkStatus);

// GET /api/payment/history - Get user's payment history
router.get("/history", protect, paymentController.getHistory);

// Admin routes (require authentication and admin privileges)
// GET /api/payment/admin/all - Get all payments
router.get("/admin/all", protect, isAdmin, paymentController.getAllPayments);

// GET /api/payment/admin/stats - Get payment statistics
router.get("/admin/stats", protect, isAdmin, paymentController.getStats);

// POST /api/payment/admin/retry/:transactionId - Retry failed payment webhook
router.post("/admin/retry/:transactionId", protect, isAdmin, paymentController.retryWebhook);

module.exports = router;
