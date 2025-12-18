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

// Original routes
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

// Aliases for admin panel compatibility
router.get("/popular/courses", getTopPapers); // Same as top-papers
router.get("/active/users", getTopUsers); // Same as top-users
router.get("/qa/activity", getTrendingQuestions); // Same as trending-questions
router.get("/downloads/stats", getEngagementMetrics); // Same as engagement
router.get("/users/growth", getGrowthChartData); // Same as charts/growth
router.get("/papers/trends", getTopPapers); // Same as top-papers
router.get("/departments/comparison", getDepartmentChartData); // Same as charts/department
router.get("/search/terms", (req, res) => {
  // Placeholder - search terms not tracked yet
  res.json({
    success: true,
    data: [],
    message: "Search term tracking not implemented yet",
  });
});

module.exports = router;
