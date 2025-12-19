const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { isAdmin } = require("../middleware/adminAuth");
const upload = require("../middleware/upload");
const {
  createStudyMaterial,
  getAllStudyMaterials,
  deleteStudyMaterial,
  toggleVisibility,
  trackDownload,
} = require("../controllers/studyMaterialController");

// Create study material (Admin only)
// For PDF upload: multipart/form-data with "material" field
// For video/link: JSON body with url field
router.post(
  "/",
  protect,
  isAdmin,
  upload.single("material"),
  createStudyMaterial
);

// Get all study materials (with optional filters)
router.get("/", getAllStudyMaterials);

// Toggle visibility (Admin only)
router.patch("/:id/toggle-visibility", protect, isAdmin, toggleVisibility);

// Track download
router.post("/:id/download", trackDownload);

// Delete study material (Admin only)
router.delete("/:id", protect, isAdmin, deleteStudyMaterial);

module.exports = router;
