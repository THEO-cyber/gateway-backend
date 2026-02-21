const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    planType: {
      type: String,
      enum: [
        "daily",
        "weekly",
        "monthly",
        "four_month",
        "ai_monthly",
        "per_course",
      ], // Added per_course for backward compatibility
      required: true,
    },
    courserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: function () {
        return this.planType === "per_course"; // Only per_course requires specific course
      },
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "XAF",
    },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled", "pending"],
      default: "pending",
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    transactionId: {
      type: String,
      required: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    features: {
      courseAccess: {
        type: Boolean,
        default: false,
      },
      testAccess: {
        type: Boolean,
        default: false,
      },
      aiAccess: {
        type: Boolean,
        default: false,
      },
      aiTokenLimit: {
        type: Number,
        default: 0,
      },
      unlimitedAI: {
        type: Boolean,
        default: false,
      },
    },
    metadata: {
      courseName: String,
      planDetails: String,
      renewalNotified: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  },
);

// Optimized indexes for scalability
subscriptionSchema.index({ userId: 1, status: 1, endDate: 1 }); // Compound index for active subscription queries
subscriptionSchema.index({ userId: 1, planType: 1, courserId: 1 }); // For specific plan checks
subscriptionSchema.index({ endDate: 1, status: 1 }); // For expiration queries
subscriptionSchema.index({ transactionId: 1 }); // For payment tracking
subscriptionSchema.index({ createdAt: -1 }); // For recent subscriptions
subscriptionSchema.index({ "features.unlimitedAI": 1, status: 1 }); // For AI access checks

// Virtual for checking if subscription is active
subscriptionSchema.virtual("isActive").get(function () {
  return this.status === "active" && this.endDate > new Date();
});

// Static method to get user's active subscriptions
subscriptionSchema.statics.getActiveSubscriptions = function (userId) {
  return this.find({
    userId,
    status: "active",
    endDate: { $gt: new Date() },
  }).populate("courserId", "name");
};

// Static method to check specific plan access
subscriptionSchema.statics.hasActivePlan = async function (
  userId,
  planType,
  courseId = null,
) {
  const query = {
    userId,
    planType,
    status: "active",
    endDate: { $gt: new Date() },
  };

  if (courseId) {
    query.courserId = courseId;
  }

  const subscription = await this.findOne(query);
  return !!subscription;
};

// Instance method to renew subscription
subscriptionSchema.methods.renew = function (months = 1) {
  const currentEnd = this.endDate > new Date() ? this.endDate : new Date();
  this.endDate = new Date(
    currentEnd.getTime() + months * 30 * 24 * 60 * 60 * 1000,
  );
  this.status = "active";
  this.metadata.renewalNotified = false;
  return this.save();
};

// Pre-save middleware to set end date based on plan type
subscriptionSchema.pre("save", function (next) {
  console.log("[Subscription Model] Pre-save middleware triggered", {
    isNew: this.isNew,
    hasEndDate: !!this.endDate,
    planType: this.planType,
  });

  if (this.isNew && !this.endDate) {
    const startDate = this.startDate || new Date();

    // Initialize features object if not exists
    if (!this.features) {
      this.features = {};
    }

    switch (this.planType) {
      case "daily":
      case "per_course": // Backward compatibility
        // Course access for 1 day
        this.endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
        this.features.courseAccess = true;
        this.features.testAccess = true;
        break;
      case "weekly":
        // 1 week
        this.endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        this.features.courseAccess = true;
        this.features.testAccess = true;
        break;
      case "monthly":
        // 1 month
        this.endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        this.features.courseAccess = true;
        this.features.testAccess = true;
        break;
      case "four_month":
        // 4 months
        this.endDate = new Date(
          startDate.getTime() + 4 * 30 * 24 * 60 * 60 * 1000,
        );
        this.features.courseAccess = true;
        this.features.testAccess = true;
        break;
      case "ai_monthly":
        // 1 month AI access
        this.endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        this.features.aiAccess = true;
        this.features.unlimitedAI = true;
        break;
    }

    console.log("[Subscription Model] EndDate set to:", this.endDate);
  }
  next();
});

// Static method to expire old subscriptions
subscriptionSchema.statics.expireOldSubscriptions = async function () {
  const result = await this.updateMany(
    {
      status: "active",
      endDate: { $lt: new Date() },
    },
    {
      status: "expired",
    },
  );
  return result;
};

module.exports = mongoose.model("Subscription", subscriptionSchema);
