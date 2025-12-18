const express = require("express");
const router = express.Router();
const {
  getAllAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementStatus,
  getAnnouncementAnalytics,
} = require("../controllers/announcementController");
const { protect } = require("../middleware/auth");
const { isAdmin } = require("../middleware/adminAuth");

// Public routes
router.get("/", getAllAnnouncements);
router.get("/:id", getAnnouncementById);

// Admin only routes
router.use(protect);
router.use(isAdmin);

router.post("/", createAnnouncement);
router.put("/:id", updateAnnouncement);
router.delete("/:id", deleteAnnouncement);
router.put("/:id/toggle", toggleAnnouncementStatus);
router.get("/:id/analytics", getAnnouncementAnalytics);

module.exports = router;
