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
const {
  validateUserRegistration,
  validateUserLogin,
  validateEmail,
  sanitizeInput,
} = require("../middleware/validation");

router.post("/register", sanitizeInput, validateUserRegistration, register);
router.post(
  "/register/student",
  sanitizeInput,
  validateUserRegistration,
  register,
); // Student app alias
router.post("/login", sanitizeInput, validateUserLogin, login); // Generic login (returns role)
router.post("/login/admin", sanitizeInput, validateUserLogin, loginAdmin); // Admin panel only
router.post("/login/student", sanitizeInput, validateUserLogin, loginStudent); // Student app only
router.get("/verify", protect, verifyToken); // GET for token verification
router.post("/verify", protect, verifyToken); // POST for backward compatibility
router.post("/logout", protect, logout);
router.post("/refresh", protect, refreshToken);
router.post("/forgot-password", sanitizeInput, validateEmail, forgotPassword);
router.post("/verify-otp", verifyOTP);
router.post("/reset-password", resetPassword);
router.get("/me", protect, getMe);

module.exports = router;
