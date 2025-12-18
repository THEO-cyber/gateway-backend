const express = require("express");
const router = express.Router();
const {
  getQuestions,
  getQuestion,
  askQuestion,
  updateQuestion,
  deleteQuestion,
  answerQuestion,
  updateAnswer,
  deleteAnswer,
  toggleQuestionLike,
  toggleAnswerLike,
  acceptAnswer,
  searchQuestions,
  getMyQuestions,
  featureQuestion,
} = require("../controllers/qaController");
const { protect } = require("../middleware/auth");
const { isActiveUser, isAdmin } = require("../middleware/adminAuth");

// All routes require authentication
router.use(protect);
router.use(isActiveUser);

// Question routes
router.get("/questions", getQuestions);
router.post("/questions", askQuestion);
router.get("/questions/:id", getQuestion);
router.put("/questions/:id", updateQuestion);
router.delete("/questions/:id", deleteQuestion);

// Admin: Feature question
router.put("/questions/:id/feature", isAdmin, featureQuestion);

// Answer routes
router.post("/questions/:id/answers", answerQuestion);
router.put("/questions/:questionId/answers/:answerId", updateAnswer);
router.delete("/questions/:questionId/answers/:answerId", deleteAnswer);

// Admin: Get answers for a question
router.get("/questions/:id/answers", getQuestion); // Reuses getQuestion which includes answers

// Like routes
router.post("/questions/:id/like", toggleQuestionLike);
router.post("/questions/:questionId/answers/:answerId/like", toggleAnswerLike);

// Accept answer
router.post("/questions/:questionId/answers/:answerId/accept", acceptAnswer);

// Search and personal
router.get("/search", searchQuestions);
router.get("/my-questions", getMyQuestions);

module.exports = router;
