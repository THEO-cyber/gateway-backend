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
} = require("../controllers/qaController");
const { protect } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

// Question routes
router.get("/questions", getQuestions);
router.post("/questions", askQuestion);
router.get("/questions/:id", getQuestion);
router.put("/questions/:id", updateQuestion);
router.delete("/questions/:id", deleteQuestion);

// Answer routes
router.post("/questions/:id/answers", answerQuestion);
router.put("/questions/:questionId/answers/:answerId", updateAnswer);
router.delete("/questions/:questionId/answers/:answerId", deleteAnswer);

// Like routes
router.post("/questions/:id/like", toggleQuestionLike);
router.post("/questions/:questionId/answers/:answerId/like", toggleAnswerLike);

// Accept answer
router.post("/questions/:questionId/answers/:answerId/accept", acceptAnswer);

// Search and personal
router.get("/search", searchQuestions);
router.get("/my-questions", getMyQuestions);

module.exports = router;
