const { body, param, query, validationResult } = require("express-validator");
const mongoose = require("mongoose");

// Generic validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  next();
};

// MongoDB ObjectId validation
const validateObjectId = (fieldName) => {
  return param(fieldName)
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error(`Invalid ${fieldName} format`);
      }
      return true;
    })
    .escape();
};

// Email validation
const validateEmail = () => {
  return body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address")
    .escape();
};

// Password validation
const validatePassword = () => {
  return body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, and one number",
    );
};

// User registration validation
const validateUserRegistration = [
  validateEmail(),
  validatePassword(),
  body("firstName")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters")
    .isAlpha()
    .withMessage("First name must contain only letters")
    .escape(),
  body("lastName")
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters")
    .isAlpha()
    .withMessage("Last name must contain only letters")
    .escape(),
  body("department")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Department name cannot exceed 100 characters")
    .escape(),
  body("yearOfStudy")
    .optional()
    .isIn(["1st Year", "2nd Year", "3rd Year", "4th Year", "Graduate"])
    .withMessage("Invalid year of study")
    .escape(),
  handleValidationErrors,
];

// User login validation
const validateUserLogin = [
  validateEmail(),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

// Course validation
const validateCourse = [
  body("name")
    .isLength({ min: 2, max: 100 })
    .withMessage("Course name must be between 2 and 100 characters")
    .escape(),
  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters")
    .escape(),
  body("departmentId")
    .optional()
    .custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid department ID");
      }
      return true;
    })
    .escape(),
  handleValidationErrors,
];

// Payment amount validation
const validatePaymentAmount = [
  body("amount")
    .isNumeric()
    .withMessage("Amount must be a number")
    .isFloat({ min: 1, max: 10000 })
    .withMessage("Amount must be between 1 and 10000"),
  body("currency")
    .optional()
    .isIn(["XAF", "USD", "EUR"])
    .withMessage("Invalid currency")
    .escape(),
  handleValidationErrors,
];

// Search query validation
const validateSearchQuery = [
  query("q")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search query must be between 1 and 100 characters")
    .escape(),
  query("page")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("Page must be a positive integer not greater than 1000")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),
  handleValidationErrors,
];

// Subscription validation
const validateSubscription = [
  body("planType")
    .isIn([
      "daily",
      "weekly",
      "monthly",
      "four_month",
      "ai_monthly",
      "per_course",
    ])
    .withMessage("Invalid subscription plan type")
    .escape(),
  body("courseId")
    .optional()
    .custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid course ID");
      }
      return true;
    })
    .escape(),
  handleValidationErrors,
];

// File upload validation
const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded",
    });
  }

  // Additional file validation
  const allowedTypes = ["application/pdf"];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: "Only PDF files are allowed",
    });
  }

  // Validate file size (10MB max)
  const maxSize = 10 * 1024 * 1024;
  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      message: "File size cannot exceed 10MB",
    });
  }

  next();
};

// Sanitize input to prevent injection attacks
const sanitizeInput = (req, res, next) => {
  // Remove any potential MongoDB operators from request body
  const sanitizeObject = (obj) => {
    if (obj && typeof obj === "object") {
      for (let key in obj) {
        if (key.startsWith("$") || key.includes(".")) {
          delete obj[key];
        } else if (typeof obj[key] === "object") {
          sanitizeObject(obj[key]);
        }
      }
    }
  };

  sanitizeObject(req.body);
  sanitizeObject(req.query);
  sanitizeObject(req.params);

  next();
};

module.exports = {
  validateObjectId,
  validateEmail,
  validatePassword,
  validateUserRegistration,
  validateUserLogin,
  validateCourse,
  validatePaymentAmount,
  validateSearchQuery,
  validateSubscription,
  validateFileUpload,
  sanitizeInput,
  handleValidationErrors,
};
