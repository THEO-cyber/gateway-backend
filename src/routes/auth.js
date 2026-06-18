const express = require("express");
const router = express.Router();
const {
  register,
  login,
  loginAdmin,
  loginStudent,
  googleAuth,
  forgotPassword,
  verifyOTP,
  resetPassword,
  verifyEmail,
  resendVerification,
  getMe,
  verifyToken,
  logout,
  refreshToken,
  completeProfile,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const {
  validateUserRegistration,
  validateUserLogin,
  validateEmail,
  validatePasswordField,
  handleValidationErrors,
  sanitizeInput,
} = require("../middleware/validation");

// Standard auth
router.post("/register", sanitizeInput, validateUserRegistration, register);
router.post("/register/student", sanitizeInput, validateUserRegistration, register);
router.post("/login", sanitizeInput, validateUserLogin, login);
router.post("/login/admin", sanitizeInput, validateUserLogin, loginAdmin);
router.post("/login/student", sanitizeInput, validateUserLogin, loginStudent);

// Google OAuth (single endpoint for both signup and login)
router.post("/google", sanitizeInput, googleAuth);

// Email verification
router.get("/verify-email/:token", verifyEmail);
router.post("/resend-verification", protect, resendVerification);

// Profile completion for Google/OAuth users who skip department selection
router.post("/complete-profile", protect, sanitizeInput, completeProfile);

// Token management
router.get("/verify", protect, verifyToken);
router.post("/verify", protect, verifyToken);
router.post("/logout", protect, logout);
router.post("/refresh", refreshToken);
router.get("/me", protect, getMe);

// Password reset (OTP-based)
router.post("/forgot-password", sanitizeInput, validateEmail(), forgotPassword);
router.post("/verify-otp", verifyOTP);
router.post("/reset-password", sanitizeInput, validatePasswordField("newPassword"), handleValidationErrors, resetPassword);

module.exports = router;
