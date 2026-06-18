const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: false, // Not required for Google OAuth users
    select: false,
  },

  // Google OAuth
  googleId: {
    type: String,
    sparse: true,
    index: true,
  },
  authProvider: {
    type: String,
    enum: ["local", "google"],
    default: "local",
  },

  // Email Verification
  emailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: {
    type: String,
    select: false,
  },
  emailVerificationExpire: {
    type: Date,
    select: false,
  },

  // Push Notification Token (Firebase FCM)
  fcmTokens: {
    type: [String],
    default: [],
    select: false,
  },
  firstName: {
    type: String,
    trim: true,
  },
  lastName: {
    type: String,
    trim: true,
  },
  role: {
    type: String,
    enum: ["student", "admin"],
    default: "student",
  },
  department: {
    type: String,
    trim: true,
  },
  yearOfStudy: {
    type: String,
    trim: true,
  },
  bio: {
    type: String,
    trim: true,
  },
  avatar: {
    type: String,
    default: "",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isBanned: {
    type: Boolean,
    default: false,
  },

  // Payment related fields
  paymentStatus: {
    type: String,
    enum: ["pending", "completed", "failed", "exempt"],
    default: "pending",
  },
  paymentDate: {
    type: Date,
  },
  paymentAmount: {
    type: Number,
  },
  paymentTransactionId: {
    type: String,
  },

  // Paper Download Subscription
  paperDownloadSubscriptionExpiryDate: {
    type: Date,
  },

  // AI Token Management
  aiTokens: {
    used: {
      type: Number,
      default: 0,
    },
    limit: {
      type: Number,
      default: 50, // Free limit
    },
    resetDate: {
      type: Date,
      default: Date.now,
    },
    lastUsed: {
      type: Date,
    },
  },

  // Subscription Management
  subscriptions: {
    hasActiveSubscription: {
      type: Boolean,
      default: false,
    },
    lastSubscriptionCheck: {
      type: Date,
      default: Date.now,
    },
    notificationsSent: {
      expiryWarning: {
        type: Boolean,
        default: false,
      },
      expired: {
        type: Boolean,
        default: false,
      },
    },
  },

  // Access Control
  accessLevel: {
    courses: {
      type: Boolean,
      default: false,
    },
    tests: {
      type: Boolean,
      default: false,
    },
    ai: {
      type: Boolean,
      default: true, // Free AI up to 50 tokens
    },
    unlimited: {
      type: Boolean,
      default: false,
    },
  },

  resetPasswordOTP: { type: String, select: false },
  resetPasswordExpire: { type: Date, select: false },
  resetPasswordAttempts: {
    type: Number,
    default: 0,
    select: false,
  },
  resetPasswordCooldown: { type: Date, select: false },

  // Refresh Token
  refreshToken: { type: String, select: false },
  refreshTokenExpire: { type: Date, select: false },
  lastSeen: {
    type: Date,
    default: null,
  },
  isOnline: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Instance methods for AI token management
userSchema.methods.canUseAI = function () {
  // Check if user has unlimited AI access
  if (this.accessLevel.unlimited) {
    return true;
  }

  // Check if user is within free token limit
  return this.aiTokens.used < this.aiTokens.limit;
};

userSchema.methods.useAIToken = async function () {
  if (!this.canUseAI()) {
    throw new Error("AI token limit exceeded. Please upgrade to continue.");
  }

  this.aiTokens.used += 1;
  this.aiTokens.lastUsed = new Date();
  return this.save();
};

userSchema.methods.resetAITokens = async function () {
  this.aiTokens.used = 0;
  this.aiTokens.resetDate = new Date();
  return this.save();
};

// Instance methods for subscription management
userSchema.methods.updateSubscriptionStatus = async function () {
  const Subscription = require("./Subscription");

  const activeSubscriptions = await Subscription.getActiveSubscriptions(
    this._id,
  );

  this.subscriptions.hasActiveSubscription = activeSubscriptions.length > 0;
  this.subscriptions.lastSubscriptionCheck = new Date();

  // Update access levels based on active subscriptions
  this.accessLevel.courses = false;
  this.accessLevel.tests = false;
  this.accessLevel.unlimited = false;

  for (const sub of activeSubscriptions) {
    if (sub.features.courseAccess) {
      this.accessLevel.courses = true;
    }
    if (sub.features.testAccess) {
      this.accessLevel.tests = true;
    }
    if (sub.features.unlimitedAI) {
      this.accessLevel.unlimited = true;
    }
  }

  return this.save();
};

userSchema.methods.hasAccessTo = function (service, courseId = null) {
  switch (service) {
    case "courses":
      return this.accessLevel.courses;
    case "tests":
      return this.accessLevel.tests;
    case "ai":
      return this.accessLevel.unlimited || this.canUseAI();
    default:
      return false;
  }
};

// Static method to expire AI tokens monthly
userSchema.statics.resetMonthlyAITokens = async function () {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const result = await this.updateMany(
    {
      "aiTokens.resetDate": { $lt: oneMonthAgo },
      "accessLevel.unlimited": false,
    },
    {
      "aiTokens.used": 0,
      "aiTokens.resetDate": new Date(),
    },
  );

  return result;
};

// Optimized indexes for scalability
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1, isBanned: 1 });
userSchema.index({ "subscriptions.hasActiveSubscription": 1 });
userSchema.index({ "aiTokens.resetDate": 1, "accessLevel.unlimited": 1 });
userSchema.index({ department: 1, yearOfStudy: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ paymentStatus: 1 });
userSchema.index({ emailVerified: 1 });
userSchema.index({ emailVerificationToken: 1 }, { sparse: true });

// Keep updatedAt current on every save
userSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("User", userSchema);
