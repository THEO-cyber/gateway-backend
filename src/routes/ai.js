const express = require("express");
const router = express.Router();
const { chat, explain } = require("../controllers/aiController");
const { protect } = require("../middleware/auth");
const { isActiveUser } = require("../middleware/adminAuth");

router.post("/chat", protect, isActiveUser, chat);
router.post("/explain", protect, isActiveUser, explain);

module.exports = router;
