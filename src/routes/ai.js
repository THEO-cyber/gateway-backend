const express = require("express");
const router = express.Router();
const { chat, explain } = require("../controllers/aiController");
const { protect } = require("../middleware/auth");

router.post("/chat", protect, chat);
router.post("/explain", protect, explain);

module.exports = router;
