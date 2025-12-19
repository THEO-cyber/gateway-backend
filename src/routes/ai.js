const express = require("express");
const router = express.Router();
const { chat, explain } = require("../controllers/aiController");
const { protect } = require("../middleware/auth");
const { isActiveUser } = require("../middleware/adminAuth");

router.post("/chat", protect, isActiveUser, chat);
router.post("/explain", protect, isActiveUser, explain);

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
