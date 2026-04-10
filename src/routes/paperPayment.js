const express = require("express");
const router = express.Router();
const {
  getPaperDownloadFee,
  initiatePaperDownloadPayment,
  checkPaperDownloadPaymentStatus,
} = require("../controllers/paymentController");
const { protect } = require("../middleware/auth");
const { isActiveUser } = require("../middleware/adminAuth");

// All routes require authentication
router.use(protect);
router.use(isActiveUser);

// Paper download subscription payment routes
router.get("/fee", getPaperDownloadFee);
router.post("/initiate", initiatePaperDownloadPayment);
router.get("/status/:transactionId", checkPaperDownloadPaymentStatus);

module.exports = router;
