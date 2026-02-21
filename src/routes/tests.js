const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { isAdmin } = require("../middleware/adminAuth");
const {
  requireTestAccess,
  updateSubscriptionStatus,
} = require("../middleware/subscriptionAuth");
const {
  createTest,
  getAllTests,
  getTestById,
  updateTest,
  deleteTest,
  addQuestions,
  getTestQuestions,
} = require("../controllers/testController");

const {
  enrollInTest,
  getTestEnrollments,
  submitTest,
  getTestSubmissions,
  getStudentSubmission,
  releaseResults,
  getStudentResults,
  getEnrolledTests,
} = require("../controllers/enrollmentController");

// Test management routes (Admin)
router.post("/", protect, isAdmin, createTest);
router.get("/", getAllTests);
router.get("/enrolled", getEnrolledTests); // Student's enrolled tests
router.get("/results", getStudentResults); // Must come before /:id
router.get(
  "/:id/result-detail",
  require("../controllers/enrollmentController").getResultDetail,
);
router.get("/:id", getTestById);
router.put("/:id", protect, isAdmin, updateTest);
router.delete("/:id", protect, isAdmin, deleteTest);

// Questions management (Admin)
router.post("/:id/questions", protect, isAdmin, addQuestions);
router.get("/:id/questions", getTestQuestions);

// Enrollment routes (require test access subscription)
router.post(
  "/:id/enroll",
  protect,
  updateSubscriptionStatus,
  requireTestAccess,
  enrollInTest,
);
router.get("/:id/enrollments", protect, isAdmin, getTestEnrollments);

// Submission routes (require test access subscription)
router.post(
  "/:id/submit",
  protect,
  updateSubscriptionStatus,
  requireTestAccess,
  submitTest,
);
router.get("/:id/submissions", protect, isAdmin, getTestSubmissions);
router.get("/:id/submissions/:email", protect, isAdmin, getStudentSubmission);

// Results management (Admin)
router.post("/:id/results/release", protect, isAdmin, releaseResults);

module.exports = router;
