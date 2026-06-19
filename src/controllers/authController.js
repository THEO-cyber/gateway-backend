const logger = require("../utils/logger");
const User = require("../models/User");
const PastPaper = require("../models/PastPaper");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const sendEmail = require("../services/emailService");
const {
  buildOTPEmail,
  buildVerificationEmail,
  buildWelcomeEmail,
  buildOTPLockoutEmail,
} = require("../services/emailService");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "1h",
  });

const generateRefreshToken = async (userId) => {
  const raw = crypto.randomBytes(40).toString("hex");
  const hashed = crypto.createHash("sha256").update(raw).digest("hex");
  await User.findByIdAndUpdate(userId, {
    refreshToken: hashed,
    refreshTokenExpire: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });
  return raw;
};

const sanitizeUser = (user) => ({
  id: user._id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  department: user.department || null,
  yearOfStudy: user.yearOfStudy || null,
  emailVerified: user.emailVerified,
  authProvider: user.authProvider,
  needsProfileCompletion: !user.department,
});

// ── Register ──────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, department, yearOfStudy } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: "Please provide email, password, first name, and last name",
      });
    }

    if (department) {
      const hasPapers = await PastPaper.findOne({ department, status: "approved" });
      if (!hasPapers) {
        return res.status(400).json({
          success: false,
          message: "No papers available for this department yet. Please contact admin or choose another department.",
          code: "NO_PAPERS_FOR_DEPARTMENT",
        });
      }
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: "User already exists with this email" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    const user = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      department: department || null,
      yearOfStudy: yearOfStudy || null,
      authProvider: "local",
      emailVerified: false,
      emailVerificationToken: hashedToken,
      emailVerificationExpire: Date.now() + 24 * 60 * 60 * 1000,
    });

    const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    const verifyUrl = `${baseUrl}/api/auth/verify-email/${rawToken}`;
    const emailContent = buildVerificationEmail(firstName, verifyUrl);
    sendEmail({ to: email, ...emailContent }).catch((err) =>
      logger.error("[Auth] Verification email failed:", err.message)
    );

    const accessToken = generateAccessToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    res.status(201).json({
      success: true,
      message: "Registration successful. Please check your email to verify your account.",
      data: { user: sanitizeUser(user), accessToken, refreshToken },
    });
  } catch (error) {
    logger.error("[Auth] Register error:", error.message);
    res.status(500).json({ success: false, message: "Registration failed", ...(process.env.NODE_ENV !== "production" && { error: error.message }) });
  }
};

// ── Verify Email ──────────────────────────────────────────────────────────────
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpire: { $gt: Date.now() },
    }).select("+emailVerificationToken +emailVerificationExpire");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification link. Please request a new one.",
      });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save();

    const welcome = buildWelcomeEmail(user.firstName);
    sendEmail({ to: user.email, ...welcome }).catch(() => {});

    res.json({ success: true, message: "Email verified successfully. You can now access all features." });
  } catch (error) {
    logger.error("[Auth] Email verification error:", error.message);
    res.status(500).json({ success: false, message: "Email verification failed" });
  }
};

// ── Resend Verification ───────────────────────────────────────────────────────
exports.resendVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("+emailVerificationToken +emailVerificationExpire");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.emailVerified) {
      return res.status(400).json({ success: false, message: "Email is already verified" });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    const verifyUrl = `${baseUrl}/api/auth/verify-email/${rawToken}`;
    const emailContent = buildVerificationEmail(user.firstName, verifyUrl);
    await sendEmail({ to: user.email, ...emailContent });

    res.json({ success: true, message: "Verification email sent. Please check your inbox." });
  } catch (error) {
    logger.error("[Auth] Resend verification error:", error.message);
    res.status(500).json({ success: false, message: "Failed to send verification email" });
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(401).json({ success: false, message: "Invalid email or password" });

    if (user.authProvider === "google" && !user.password) {
      return res.status(401).json({ success: false, message: "This account uses Google Sign-In. Please login with Google." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Invalid email or password" });

    if (user.isBanned) return res.status(403).json({ success: false, message: "Your account has been banned. Please contact support." });
    if (!user.isActive) return res.status(403).json({ success: false, message: "Your account has been deactivated. Please contact support." });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);
    res.json({ success: true, message: "Login successful", data: { user: sanitizeUser(user), accessToken, refreshToken } });
  } catch (error) {
    logger.error("[Auth] Login error:", error.message);
    res.status(500).json({ success: false, message: "Login failed", ...(process.env.NODE_ENV !== "production" && { error: error.message }) });
  }
};

// ── Admin Login ───────────────────────────────────────────────────────────────
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(401).json({ success: false, message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Invalid email or password" });

    if (user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied. This login is for administrators only. Please use the student app." });
    }

    if (user.isBanned || !user.isActive) {
      return res.status(403).json({ success: false, message: "Your account has been suspended. Please contact support." });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);
    res.json({ success: true, message: "Admin login successful", data: { user: sanitizeUser(user), accessToken, refreshToken } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Login failed", ...(process.env.NODE_ENV !== "production" && { error: error.message }) });
  }
};

// ── Student Login ─────────────────────────────────────────────────────────────
exports.loginStudent = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(401).json({ success: false, message: "Invalid email or password" });

    if (user.authProvider === "google" && !user.password) {
      return res.status(401).json({ success: false, message: "This account uses Google Sign-In. Please login with Google." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Invalid email or password" });

    if (user.role === "admin") {
      return res.status(403).json({ success: false, message: "Administrator accounts cannot use the student app. Please use the admin panel." });
    }

    if (user.isBanned) return res.status(403).json({ success: false, message: "Your account has been banned." });
    if (!user.isActive) return res.status(403).json({ success: false, message: "Your account has been deactivated." });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);
    res.json({ success: true, message: "Login successful", data: { user: sanitizeUser(user), accessToken, refreshToken } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Login failed", ...(process.env.NODE_ENV !== "production" && { error: error.message }) });
  }
};

// ── Google OAuth ──────────────────────────────────────────────────────────────
exports.googleAuth = async (req, res) => {
  try {
    const { idToken, credential } = req.body;
    const token = idToken || credential;

    if (!token) return res.status(400).json({ success: false, message: "Google ID token is required" });

    if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === "your-google-client-id-here") {
      return res.status(503).json({ success: false, message: "Google OAuth is not configured on this server. Please contact admin." });
    }

    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
    } catch {
      return res.status(401).json({ success: false, message: "Invalid or expired Google token" });
    }

    const payload = ticket.getPayload();
    const { sub: googleId, email, given_name: firstName, family_name: lastName, picture: avatar, email_verified } = payload;

    if (!email) return res.status(400).json({ success: false, message: "Could not retrieve email from Google account" });

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = "google";
        if (!user.avatar && avatar) user.avatar = avatar;
        if (!user.emailVerified && email_verified) user.emailVerified = true;
        await user.save();
      }

      if (user.isBanned) return res.status(403).json({ success: false, message: "Your account has been banned." });
      if (!user.isActive) return res.status(403).json({ success: false, message: "Your account has been deactivated." });

      const accessToken = generateAccessToken(user._id);
      const refreshToken = await generateRefreshToken(user._id);
      return res.json({ success: true, message: "Login successful", isNewUser: false, data: { user: sanitizeUser(user), accessToken, refreshToken } });
    }

    user = await User.create({
      email,
      firstName: firstName || email.split("@")[0],
      lastName: lastName || "",
      googleId,
      authProvider: "google",
      avatar: avatar || "",
      emailVerified: !!email_verified,
      role: "student",
    });

    const welcome = buildWelcomeEmail(user.firstName);
    sendEmail({ to: user.email, ...welcome }).catch(() => {});

    const accessToken = generateAccessToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);
    res.status(201).json({ success: true, message: "Account created successfully via Google", isNewUser: true, data: { user: sanitizeUser(user), accessToken, refreshToken } });
  } catch (error) {
    logger.error("[Auth] Google auth error:", error.message);
    res.status(500).json({ success: false, message: "Google authentication failed", ...(process.env.NODE_ENV !== "production" && { error: error.message }) });
  }
};

// ── Forgot Password ───────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email }).select(
      "+resetPasswordOTP +resetPasswordExpire +resetPasswordAttempts +resetPasswordCooldown"
    );
    if (!user) {
      return res.json({ success: true, message: "If that email exists, an OTP has been sent." });
    }

    if (user.resetPasswordCooldown && user.resetPasswordCooldown > Date.now()) {
      const waitMins = Math.ceil((user.resetPasswordCooldown - Date.now()) / 60000);
      return res.status(429).json({ success: false, message: `Too many attempts. Please try again in ${waitMins} minute(s).` });
    }

    if (user.resetPasswordOTP && user.resetPasswordExpire && user.resetPasswordExpire > Date.now()) {
      const secsLeft = Math.ceil((user.resetPasswordExpire - Date.now()) / 1000);
      return res.status(429).json({ success: false, message: `An OTP was already sent. Please wait ${secsLeft} second(s) before requesting a new one.` });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOTP = crypto.createHash("sha256").update(otp).digest("hex");
    user.resetPasswordExpire = Date.now() + 60 * 1000;
    user.resetPasswordAttempts = 0;
    user.resetPasswordCooldown = undefined;
    await user.save();

    try {
      const emailContent = buildOTPEmail(user.firstName, otp);
      await sendEmail({ to: user.email, ...emailContent });
      res.json({ success: true, message: "OTP sent to your email. It expires in 60 seconds." });
    } catch (emailError) {
      user.resetPasswordOTP = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      logger.error("[Auth] OTP email failed:", emailError.message);
      res.status(500).json({ success: false, message: "Failed to send OTP email. Please try again." });
    }
  } catch (error) {
    logger.error("[Auth] Forgot password error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Verify OTP ────────────────────────────────────────────────────────────────
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: "Email and OTP are required" });

    const hashedOTP = crypto.createHash("sha256").update(String(otp)).digest("hex");

    const user = await User.findOne({ email }).select(
      "+resetPasswordOTP +resetPasswordExpire +resetPasswordAttempts +resetPasswordCooldown"
    );

    if (!user || !user.resetPasswordOTP) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    if (user.resetPasswordExpire < Date.now()) {
      return res.status(400).json({ success: false, message: "OTP expired. Please request a new one." });
    }

    if (user.resetPasswordAttempts >= 3) {
      user.resetPasswordCooldown = Date.now() + 30 * 60 * 1000;
      await user.save();
      const lockout = buildOTPLockoutEmail(user.firstName);
      sendEmail({ to: user.email, ...lockout }).catch(() => {});
      return res.status(429).json({ success: false, message: "Too many invalid attempts. Please try again in 30 minutes." });
    }

    if (user.resetPasswordOTP !== hashedOTP) {
      user.resetPasswordAttempts = (user.resetPasswordAttempts || 0) + 1;
      await user.save();
      const remaining = 3 - user.resetPasswordAttempts;
      return res.status(400).json({ success: false, message: `Invalid OTP. ${remaining} attempt(s) remaining.`, attempts: user.resetPasswordAttempts });
    }

    // Extend expiry to 10 minutes so user has time to enter new password
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    user.resetPasswordAttempts = 0;
    user.resetPasswordCooldown = undefined;
    await user.save();

    res.json({ success: true, message: "OTP verified successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", ...(process.env.NODE_ENV !== "production" && { error: error.message }) });
  }
};

// ── Reset Password ────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: "Email, OTP, and new password are required" });
    }

    const hashedOTP = crypto.createHash("sha256").update(String(otp)).digest("hex");

    const user = await User.findOne({
      email,
      resetPasswordOTP: hashedOTP,
      resetPasswordExpire: { $gt: Date.now() },
    }).select("+resetPasswordOTP +resetPasswordExpire +resetPasswordAttempts");

    if (!user) {
      return res.status(400).json({ success: false, message: "Reset session expired. Please request a new OTP." });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpire = undefined;
    user.resetPasswordAttempts = 0;
    await user.save();

    const accessToken = generateAccessToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);
    res.json({ success: true, message: "Password reset successful", data: { user: sanitizeUser(user), accessToken, refreshToken } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Password reset failed", ...(process.env.NODE_ENV !== "production" && { error: error.message }) });
  }
};

// ── Get Me ────────────────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Verify Token ──────────────────────────────────────────────────────────────
exports.verifyToken = async (req, res) => {
  try {
    res.json({ success: true, message: "Token is valid", data: { user: { id: req.user._id, email: req.user.email, role: req.user.role } } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Verification failed", ...(process.env.NODE_ENV !== "production" && { error: error.message }) });
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────
exports.logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: undefined, refreshTokenExpire: undefined });
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Logout failed" });
  }
};

// ── Refresh Token ─────────────────────────────────────────────────────────────
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) return res.status(401).json({ success: false, message: "Refresh token required" });

    const hashed = crypto.createHash("sha256").update(refreshToken).digest("hex");

    const user = await User.findOne({
      refreshToken: hashed,
      refreshTokenExpire: { $gt: Date.now() },
    }).select("+refreshToken +refreshTokenExpire");

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid or expired refresh token. Please log in again.", code: "REFRESH_TOKEN_EXPIRED" });
    }

    if (user.isBanned || !user.isActive) {
      return res.status(403).json({ success: false, message: "Account is inactive or banned." });
    }

    const newRefreshToken = await generateRefreshToken(user._id);
    const accessToken = generateAccessToken(user._id);

    res.json({ success: true, message: "Token refreshed successfully", data: { accessToken, refreshToken: newRefreshToken, user: { id: user._id, email: user.email, role: user.role } } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Token refresh failed", ...(process.env.NODE_ENV !== "production" && { error: error.message }) });
  }
};

// ── Complete Profile ──────────────────────────────────────────────────────────
exports.completeProfile = async (req, res) => {
  try {
    const { department, yearOfStudy } = req.body;

    if (!department) {
      return res.status(400).json({ success: false, message: "Department is required to complete your profile." });
    }

    const hasPapers = await PastPaper.findOne({ department, status: "approved" });
    if (!hasPapers) {
      return res.status(400).json({ success: false, message: "No papers available for this department yet. Please choose another department.", code: "NO_PAPERS_FOR_DEPARTMENT" });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { department, yearOfStudy: yearOfStudy || null },
      { new: true, runValidators: true }
    );

    res.json({ success: true, message: "Profile completed successfully.", data: { user: sanitizeUser(user) } });
  } catch (error) {
    logger.error("[Auth] Complete profile error:", error.message);
    res.status(500).json({ success: false, message: "Failed to complete profile.", ...(process.env.NODE_ENV !== "production" && { error: error.message }) });
  }
};
