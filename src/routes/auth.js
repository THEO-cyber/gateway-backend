const express = require("express");
const router = express.Router();
const {
  register,
  login,
  loginAdmin,
  loginStudent,
  forgotPassword,
  verifyOTP,
  resetPassword,
  getMe,
  verifyToken,
  logout,
  refreshToken,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");

router.post("/register", register);
router.post("/login", login); // Generic login (returns role)
router.post("/login/admin", loginAdmin); // Admin panel only
router.post("/login/student", loginStudent); // Student app only
router.get("/verify", protect, verifyToken); // GET for token verification
router.post("/verify", protect, verifyToken); // POST for backward compatibility
router.post("/logout", protect, logout);
router.post("/refresh", protect, refreshToken);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOTP);
router.post("/reset-password", resetPassword);
router.get("/me", protect, getMe);

module.exports = router;
