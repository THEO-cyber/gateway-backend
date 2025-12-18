const express = require("express");
const router = express.Router();
const {
  getTopPapers,
  getTopUsers,
  getTrendingQuestions,
  getEngagementMetrics,
  getUsersChartData,
  getDepartmentChartData,
  getGrowthChartData,
  exportCSV,
  exportPDF,
  exportExcel,
} = require("../controllers/analyticsController");
const { protect } = require("../middleware/auth");
const { isAdmin } = require("../middleware/adminAuth");

// All analytics routes require admin authentication
router.use(protect);
router.use(isAdmin);

router.get("/top-papers", getTopPapers);
router.get("/top-users", getTopUsers);
router.get("/trending-questions", getTrendingQuestions);
router.get("/engagement", getEngagementMetrics);
router.get("/charts/users", getUsersChartData);
router.get("/charts/department", getDepartmentChartData);
router.get("/charts/growth", getGrowthChartData);
router.post("/export/csv", exportCSV);
router.post("/export/pdf", exportPDF);
router.post("/export/excel", exportExcel);

module.exports = router;
