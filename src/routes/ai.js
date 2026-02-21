const express = require("express");
const router = express.Router();
const { chat, explain } = require("../controllers/aiController");
const { protect } = require("../middleware/auth");
const { isActiveUser } = require("../middleware/adminAuth");
const {
  requireAIAccess,
  updateSubscriptionStatus,
} = require("../middleware/subscriptionAuth");

// Apply subscription status update
router.use(protect);
router.use(updateSubscriptionStatus);

// AI routes with token limits
router.post("/chat", isActiveUser, requireAIAccess, async (req, res) => {
  try {
    // Add AI usage info to response
    const result = await chat(req, res);

    // Add token info to response if not already sent
    if (!res.headersSent && req.aiTokensRemaining !== undefined) {
      const originalJson = res.json;
      res.json = function (data) {
        if (data && typeof data === "object") {
          data.aiUsage = {
            tokensUsed: req.aiTokensUsed,
            tokensRemaining: req.aiTokensRemaining,
            unlimited: req.user.accessLevel?.unlimited || false,
          };
        }
        return originalJson.call(this, data);
      };
    }

    return result;
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "AI chat failed",
        error: error.message,
      });
    }
  }
});

router.post("/explain", isActiveUser, requireAIAccess, async (req, res) => {
  try {
    const result = await explain(req, res);

    // Add token info to response if not already sent
    if (!res.headersSent && req.aiTokensRemaining !== undefined) {
      const originalJson = res.json;
      res.json = function (data) {
        if (data && typeof data === "object") {
          data.aiUsage = {
            tokensUsed: req.aiTokensUsed,
            tokensRemaining: req.aiTokensRemaining,
            unlimited: req.user.accessLevel?.unlimited || false,
          };
        }
        return originalJson.call(this, data);
      };
    }

    return result;
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "AI explain failed",
        error: error.message,
      });
    }
  }
});

// @route   GET /api/ai/history
// @desc    Get AI chat history for student
// @access  Private
router.get("/history", protect, isActiveUser, async (req, res) => {
  try {
    const { email, limit = 50 } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Note: This assumes chat history is stored. If not implemented yet,
    // return empty array for now
    res.json({
      success: true,
      data: [],
      message: "Chat history feature coming soon",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch chat history",
      error: error.message,
    });
  }
});

module.exports = router;
