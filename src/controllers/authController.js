const User = require("../models/User");
const PastPaper = require("../models/PastPaper");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const sendEmail = require("../services/emailService");

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, department, yearOfStudy } =
      req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: "Please provide email, password, first name, and last name",
      });
    }

    // Check if department is provided and has papers
    if (department) {
      const departmentHasPapers = await PastPaper.findOne({
        department,
        status: "approved",
      });

      if (!departmentHasPapers) {
        return res.status(400).json({
          success: false,
          message:
            "No papers available for this department yet. Please contact admin or choose another department.",
          code: "NO_PAPERS_FOR_DEPARTMENT",
        });
      }
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user (defaults to student role)
    const user = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      department: department || null,
      yearOfStudy: yearOfStudy || null,
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          department: user.department,
          yearOfStudy: user.yearOfStudy,
        },
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
};

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if user is banned or inactive
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: "Your account has been banned. Please contact support.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          department: user.department,
          yearOfStudy: user.yearOfStudy,
        },
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
};

// @route   POST /api/auth/login/admin
// @desc    Login for admin panel only
// @access  Public
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if user is admin
    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. This login is for administrators only. Please use the student app.",
      });
    }

    // Check if user is banned or inactive
    if (user.isBanned || !user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Please contact support.",
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: "Admin login successful",
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
};

// @route   POST /api/auth/login/student
// @desc    Login for student app only
// @access  Public
exports.loginStudent = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if user is student
    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Administrator accounts cannot use the student app. Please use the admin panel.",
      });
    }

    // Check if user is banned or inactive
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: "Your account has been banned. Please contact support.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          department: user.department,
          yearOfStudy: user.yearOfStudy,
        },
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
};

// @route   POST /api/auth/forgot-password
// @desc    Send password reset OTP
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with this email",
      });
    }

    // Check for cooldown
    if (user.resetPasswordCooldown && user.resetPasswordCooldown > Date.now()) {
      const waitMins = Math.ceil(
        (user.resetPasswordCooldown - Date.now()) / 60000,
      );
      return res.status(429).json({
        success: false,
        message: `Too many attempts. Please try again in ${waitMins} minute(s).`,
      });
    }

    // Reset attempts on new request
    user.resetPasswordAttempts = 0;

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP and save
    user.resetPasswordOTP = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");
    user.resetPasswordExpire = Date.now() + 1 * 60 * 1000; // 1 minute
    await user.save();

    // Send email
    const message = `Your password reset OTP is: ${otp}\n\nThis OTP is valid for 1 minute.\n\nIf you didn't request this, please ignore this email.`;

    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset OTP - HND Gateway",
        text: message,
      });

      res.json({
        success: true,
        message: "OTP sent to email",
      });
    } catch (error) {
      user.resetPasswordOTP = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      // Log error securely without exposing details
      if (process.env.NODE_ENV === "development") {
        console.error("Forgot password email error:", error);
      }
      res.status(500).json({
        success: false,
        message: "Email could not be sent",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  } catch (error) {
    // Log error securely without exposing details
    if (process.env.NODE_ENV === "development") {
      console.error("Forgot password server error:", error);
    }
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP
// @access  Public
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Hash OTP
    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    const user = await User.findOne({ email });
    if (!user || !user.resetPasswordOTP || !user.resetPasswordExpire) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Check if OTP expired
    if (user.resetPasswordExpire < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired. Please request a new one.",
      });
    }

    // Check attempts
    if (user.resetPasswordAttempts >= 3) {
      user.resetPasswordCooldown = Date.now() + 30 * 60 * 1000; // 30 min cooldown
      await user.save();
      // Send lockout email
      try {
        await sendEmail({
          to: user.email,
          subject: "Password Reset Locked - HND Gateway",
          text: `You have entered an incorrect OTP 3 times. You can request another OTP after 30 minutes. If this wasn't you, please contact support.`,
        });
      } catch (e) {
        // Log error securely without exposing details
        if (process.env.NODE_ENV === "development") {
          console.error("Failed to send lockout email:", e);
        }
      }
      return res.status(429).json({
        success: false,
        message: "Too many invalid attempts. Please try again in 30 minutes.",
      });
    }

    // Check OTP
    if (user.resetPasswordOTP !== hashedOTP) {
      user.resetPasswordAttempts = (user.resetPasswordAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "Invalid OTP.",
        attempts: user.resetPasswordAttempts,
      });
    }

    // Success: reset attempts and cooldown
    user.resetPasswordAttempts = 0;
    user.resetPasswordCooldown = undefined;
    await user.save();

    res.json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @route   POST /api/auth/reset-password
// @desc    Reset password with OTP
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Hash OTP
    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    const user = await User.findOne({
      email,
      resetPasswordOTP: hashedOTP,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: "Password reset successful",
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Password reset failed",
      error: error.message,
    });
  }
};

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @route   POST /api/auth/verify
// @desc    Verify token validity
// @access  Private
exports.verifyToken = async (req, res) => {
  try {
    // If protect middleware passed, token is valid
    res.json({
      success: true,
      message: "Token is valid",
      data: {
        user: {
          id: req.user._id,
          email: req.user.email,
          role: req.user.role,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Verification failed",
      error: error.message,
    });
  }
};

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
exports.logout = async (req, res) => {
  try {
    // In JWT, logout is handled client-side by removing the token
    // This endpoint exists for consistency and can be used for logging
    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Logout failed",
      error: error.message,
    });
  }
};

// @route   POST /api/auth/refresh
// @desc    Refresh JWT token
// @access  Private
exports.refreshToken = async (req, res) => {
  try {
    // Generate new token
    const token = generateToken(req.user._id);

    res.json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        token,
        user: {
          id: req.user._id,
          email: req.user.email,
          role: req.user.role,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Token refresh failed",
      error: error.message,
    });
  }
};
