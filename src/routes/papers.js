const express = require("express");
const router = express.Router();
const {
  getPapers,
  uploadPaper,
  getAvailableYears,
  downloadPaper,
  deletePaper,
  searchPapers,
  approvePaper,
  rejectPaper,
  getPaperStats,
  bulkUploadPapers,
  getDepartments,
  getYearsByDepartment,
  getTitlesByDepartmentAndYear,
} = require("../controllers/paperController");
const { protect } = require("../middleware/auth");
const { isActiveUser, isAdmin } = require("../middleware/adminAuth");
const upload = require("../middleware/upload");

// All routes require authentication
router.use(protect);
router.use(isActiveUser);

router.get("/", getPapers);
router.post("/upload", upload.single("file"), uploadPaper);
router.get("/search", searchPapers);
router.get("/departments", getDepartments); // Get all departments
router.get("/years/:department", getYearsByDepartment); // Get years by department
router.get("/titles/:department/:year", getTitlesByDepartmentAndYear); // Get papers by dept & year
router.get("/years/:course", getAvailableYears);
router.get("/:id/download", downloadPaper);
router.delete("/:id", deletePaper);

// Admin only routes
router.put("/:id/approve", isAdmin, approvePaper);
router.put("/:id/reject", isAdmin, rejectPaper);
router.get("/stats", isAdmin, getPaperStats);
router.post("/bulk-upload", isAdmin, upload.array("files"), bulkUploadPapers);

module.exports = router;
