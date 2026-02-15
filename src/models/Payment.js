const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    // Transaction identifiers
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    nkwaTransactionId: {
      type: String,
      index: true,
    },

    // Payment details
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    currency: {
      type: String,
      default: "XAF",
    },

    // Status tracking
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "success",
        "failed",
        "cancelled",
        "refunded",
      ],
      default: "pending",
      index: true,
    },

    // User association
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    userEmail: {
      type: String,
    },

    // Payment purpose
    purpose: {
      type: String,
      enum: ["registration_fee", "test_fee", "subscription", "other"],
      default: "registration_fee",
    },
    description: {
      type: String,
    },

    // Nkwa Pay response data
    nkwaPayResponse: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Webhook data
    webhookReceived: {
      type: Boolean,
      default: false,
    },
    webhookData: {
      type: mongoose.Schema.Types.Mixed,
    },
    webhookAttempts: {
      type: Number,
      default: 0,
    },

    // Timestamps
    initiatedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },

    // Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Error tracking
    errorMessage: {
      type: String,
    },
    errorCode: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for better query performance
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ phoneNumber: 1, status: 1 });
paymentSchema.index({ createdAt: -1 });

// Virtual for formatted amount
paymentSchema.virtual("formattedAmount").get(function () {
  return `${this.amount.toLocaleString()} ${this.currency}`;
});

// Virtual for duration
paymentSchema.virtual("duration").get(function () {
  if (this.completedAt) {
    return this.completedAt - this.initiatedAt;
  }
  return Date.now() - this.initiatedAt;
});

// Method to mark payment as successful
paymentSchema.methods.markAsSuccessful = function (webhookData = null) {
  this.status = "success";
  this.completedAt = new Date();
  this.webhookReceived = true;
  if (webhookData) {
    this.webhookData = webhookData;
  }
  return this.save();
};

// Method to mark payment as failed
paymentSchema.methods.markAsFailed = function (
  errorMessage = null,
  errorCode = null,
) {
  this.status = "failed";
  this.completedAt = new Date();
  if (errorMessage) {
    this.errorMessage = errorMessage;
  }
  if (errorCode) {
    this.errorCode = errorCode;
  }
  return this.save();
};

// Static method to find pending payments
paymentSchema.statics.findPending = function () {
  return this.find({ status: { $in: ["pending", "processing"] } });
};

// Static method to find by transaction ID
paymentSchema.statics.findByTransactionId = function (transactionId) {
  return this.findOne({ transactionId });
};

module.exports = mongoose.model("Payment", paymentSchema);
