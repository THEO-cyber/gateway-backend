const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  getUserDetails,
  updateUser,
  deleteUser,
  bulkDeleteUsers,
  exportUsers,
  getUserStats,
} = require("../controllers/adminController");
const { protect } = require("../middleware/auth");
const { isAdmin } = require("../middleware/adminAuth");

// Allow authenticated users to get their own profile
router.get("/profile", protect, (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch profile",
        error: error.message,
      });
  }
});

// All user management routes require admin authentication
router.use(protect);
router.use(isAdmin);

router.get("/", getAllUsers);
router.post("/", (req, res) =>
  res.status(501).json({
    success: false,
    error: "Create user via /auth/register",
    code: "NOT_IMPLEMENTED",
  })
);
router.get("/stats", getUserStats);
router.post("/bulk-delete", bulkDeleteUsers);
router.post("/export", exportUsers);
router.get("/:id", getUserDetails);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

module.exports = router;
