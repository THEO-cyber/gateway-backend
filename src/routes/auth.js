const express = require("express");
const router = express.Router();
const {
  register,
  login,
  forgotPassword,
  verifyOTP,
  resetPassword,
  getMe,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOTP);
router.post("/reset-password", resetPassword);
router.get("/me", protect, getMe);

module.exports = router;
