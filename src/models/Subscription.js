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
      enum: ["paper_download", "daily", "weekly", "monthly", "four_month", "ai_monthly", "per_course"],
      required: true,
    },
    courserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: function () {
        return this.planType === "per_course";
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
      courseAccess: { type: Boolean, default: false },
      testAccess:   { type: Boolean, default: false },
      aiAccess:     { type: Boolean, default: false },
      aiTokenLimit: { type: Number, default: 0 },
      unlimitedAI:  { type: Boolean, default: false },
    },
    metadata: {
      courseName:       String,
      planDetails:      String,
      renewalNotified:  { type: Boolean, default: false },
    },

    // Admin-managed fields
    adminNote:           { type: String },
    lastModifiedBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lastModifiedAt:      { type: Date },
    cancelledBy:         { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancelledAt:         { type: Date },
    cancellationReason:  { type: String },
  },
  {
    timestamps: true,
  },
);

// Indexes
subscriptionSchema.index({ userId: 1, status: 1, endDate: 1 });
subscriptionSchema.index({ userId: 1, planType: 1, courserId: 1 });
subscriptionSchema.index({ endDate: 1, status: 1 });
subscriptionSchema.index({ transactionId: 1 });
subscriptionSchema.index({ createdAt: -1 });
subscriptionSchema.index({ "features.unlimitedAI": 1, status: 1 });

// Virtual: true only when status=active AND endDate is in the future
subscriptionSchema.virtual("isActive").get(function () {
  return this.status === "active" && this.endDate > new Date();
});

subscriptionSchema.virtual("nextBillingDate").get(function () {
  if (this.autoRenew && this.status === "active" && this.endDate) {
    return this.endDate;
  }
  return null;
});

subscriptionSchema.virtual("nextBillingInfo").get(function () {
  if (this.status === "pending") {
    return { date: null, formatted: "Pending activation", type: "pending" };
  } else if (this.autoRenew && this.status === "active" && this.endDate) {
    return { date: this.endDate, formatted: new Date(this.endDate).toLocaleDateString(), type: "renewal" };
  } else if (this.status === "active" && this.endDate) {
    return { date: this.endDate, formatted: `Expires ${new Date(this.endDate).toLocaleDateString()}`, type: "expiry" };
  } else if (this.status === "expired") {
    return { date: null, formatted: "Expired", type: "expired" };
  } else if (this.status === "cancelled") {
    return { date: null, formatted: "Cancelled", type: "cancelled" };
  }
  return { date: null, formatted: "N/A", type: "none" };
});

subscriptionSchema.statics.getActiveSubscriptions = function (userId) {
  return this.find({
    userId,
    status: "active",
    endDate: { $gt: new Date() },
  }).populate("courserId", "name");
};

subscriptionSchema.statics.hasActivePlan = async function (userId, planType, courseId = null) {
  const query = { userId, planType, status: "active", endDate: { $gt: new Date() } };
  if (courseId) query.courserId = courseId;
  return !!(await this.findOne(query));
};

subscriptionSchema.methods.renew = function (months = 1) {
  const currentEnd = this.endDate > new Date() ? this.endDate : new Date();
  this.endDate = new Date(currentEnd.getTime() + months * 30 * 24 * 60 * 60 * 1000);
  this.status = "active";
  this.metadata.renewalNotified = false;
  return this.save();
};

// Pre-save: calculate endDate and features based on planType
subscriptionSchema.pre("save", function (next) {
  if (this.isNew && !this.endDate) {
    const startDate = this.startDate || new Date();

    if (!this.features) this.features = {};

    switch (this.planType) {
      case "daily":
      case "per_course":
        this.endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
        this.features.courseAccess = true;
        this.features.testAccess = true;
        break;
      case "weekly":
        this.endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        this.features.courseAccess = true;
        this.features.testAccess = true;
        break;
      case "monthly":
        this.endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        this.features.courseAccess = true;
        this.features.testAccess = true;
        break;
      case "four_month":
        this.endDate = new Date(startDate.getTime() + 4 * 30 * 24 * 60 * 60 * 1000);
        this.features.courseAccess = true;
        this.features.testAccess = true;
        break;
      case "ai_monthly":
        this.endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        this.features.aiAccess = true;
        this.features.unlimitedAI = true;
        break;
      case "paper_download": {
        const months = parseInt(process.env.PAPER_DOWNLOAD_SUBSCRIPTION_MONTHS, 10) || 9;
        this.endDate = new Date(startDate.getTime() + months * 30 * 24 * 60 * 60 * 1000);
        break;
      }
    }
  }
  next();
});

subscriptionSchema.statics.expireOldSubscriptions = async function () {
  return this.updateMany(
    { status: "active", endDate: { $lt: new Date() } },
    { status: "expired" },
  );
};

module.exports = mongoose.model("Subscription", subscriptionSchema);
