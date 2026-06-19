const logger = require("../utils/logger");
const Test = require("../models/Test");
const Enrollment = require("../models/Enrollment");
const Submission = require("../models/Submission");
const User = require("../models/User");
const { notifyUsers, notifications } = require("../services/notificationService");

// @route   POST /api/tests
// @desc    Create new test
// @access  Private (Admin only)
exports.createTest = async (req, res) => {
  try {
    const { title, department, date, time, duration, passingPercentage, description, status } = req.body;

    const test = await Test.create({
      title,
      department,
      date,
      time,
      duration,
      passingPercentage: passingPercentage || 50,
      description,
      status: status || "draft",
      createdBy: req.user._id,
    });

    // If created directly as scheduled, send publish notifications
    if (test.status === "scheduled") {
      notifyDepartmentOnPublish(test).catch((err) =>
        logger.error(`[TestNotify] Publish notification failed: ${err.message}`)
      );
    }

    res.status(201).json({ success: true, test });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create test", ...(process.env.NODE_ENV !== "production" && { error: error.message }) });
  }
};

// @route   GET /api/tests
// @desc    Get all tests with filters
// @access  Private
exports.getAllTests = async (req, res) => {
  try {
    const { department, status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (department) query.department = department;
    if (status) query.status = status;

    const [tests, total] = await Promise.all([
      Test.find(query)
        .populate("createdBy", "firstName lastName email")
        .sort({ date: -1, createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .lean(),
      Test.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        tests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch tests", ...(process.env.NODE_ENV !== "production" && { error: error.message }) });
  }
};

// @route   GET /api/tests/:id
// @desc    Get single test
// @access  Private
exports.getTestById = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
      .populate("createdBy", "firstName lastName email")
      .lean();

    if (!test) return res.status(404).json({ success: false, message: "Test not found" });

    res.json({ success: true, test });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch test", ...(process.env.NODE_ENV !== "production" && { error: error.message }) });
  }
};

// @route   PUT /api/tests/:id
// @desc    Update test
// @access  Private (Admin only)
exports.updateTest = async (req, res) => {
  try {
    const previous = await Test.findById(req.params.id);
    if (!previous) return res.status(404).json({ success: false, message: "Test not found" });

    const wasScheduled = previous.status === "scheduled";
    const becomingScheduled = req.body.status === "scheduled" && previous.status !== "scheduled";

    // If date/time changed on an already-scheduled test, reset all notification flags
    // so users get re-notified with the new schedule
    const dateChanged = req.body.date && req.body.date !== previous.date?.toISOString().split("T")[0];
    const timeChanged = req.body.time && req.body.time !== previous.time;
    const rescheduled = wasScheduled && (dateChanged || timeChanged);

    let notificationReset = {};
    if (rescheduled) {
      notificationReset = {
        "notificationsSent.published": false,
        "notificationsSent.thirtyMinWarning": false,
        "notificationsSent.testStarted": false,
      };
    }

    const test = await Test.findByIdAndUpdate(
      req.params.id,
      { ...req.body, ...notificationReset },
      { new: true, runValidators: true }
    );

    if (req.body.status === "completed" && !test.completedAt) {
      test.completedAt = new Date();
      await test.save();
    }

    // Send publish notification when status first becomes "scheduled"
    // OR when an already-scheduled test is rescheduled (new date/time)
    if (becomingScheduled || rescheduled) {
      notifyDepartmentOnPublish(test).catch((err) =>
        logger.error(`[TestNotify] Publish notification failed: ${err.message}`)
      );
    }

    res.json({ success: true, test });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update test", ...(process.env.NODE_ENV !== "production" && { error: error.message }) });
  }
};

// @route   DELETE /api/tests/:id
// @desc    Delete test
// @access  Private (Admin only)
exports.deleteTest = async (req, res) => {
  try {
    const test = await Test.findByIdAndDelete(req.params.id);
    if (!test) return res.status(404).json({ success: false, message: "Test not found" });

    await Promise.all([
      Enrollment.deleteMany({ testId: req.params.id }),
      Submission.deleteMany({ testId: req.params.id }),
    ]);

    res.json({ success: true, message: "Test and related data deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete test", ...(process.env.NODE_ENV !== "production" && { error: error.message }) });
  }
};

// @route   POST /api/tests/:id/questions
// @desc    Add questions to test
// @access  Private (Admin only)
exports.addQuestions = async (req, res) => {
  try {
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: "Please provide an array of questions" });
    }

    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ success: false, message: "Test not found" });

    test.questions = questions;
    await test.save();

    res.json({ success: true, questionsCount: test.questions.length, message: `${test.questions.length} questions added successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to add questions", ...(process.env.NODE_ENV !== "production" && { error: error.message }) });
  }
};

// @route   GET /api/tests/:id/questions
// @desc    Get test questions (for students during test) - Server-side shuffled
// @access  Private
exports.getTestQuestions = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).select("questions title").lean();

    if (!test) return res.status(404).json({ success: false, message: "Test not found" });

    const userId = req.user.id;
    const testId = req.params.id;

    let questionsForStudent;
    let isShuffled = false;

    try {
      const shuffleUtils = require("../utils/shuffleUtils");
      const { shuffledQuestions, questionMap } = shuffleUtils.shuffleQuestions(test.questions, userId, testId);
      await shuffleUtils.storeQuestionMap(userId, testId, questionMap);

      questionsForStudent = shuffledQuestions.map((q, displayIndex) => ({
        questionId: q.originalIndex,
        displayIndex,
        question: q.question,
        options: q.options,
      }));
      isShuffled = true;
      logger.info(`[GetQuestions] Served ${questionsForStudent.length} shuffled questions to user ${userId}`);
    } catch (shuffleError) {
      logger.warn("[GetQuestions] Shuffling failed, using original order:", shuffleError.message);
      questionsForStudent = test.questions.map((q, index) => ({
        questionId: index,
        index,
        question: q.question,
        options: q.options,
      }));
    }

    res.json({
      success: true,
      testTitle: test.title,
      questions: questionsForStudent,
      isShuffled,
      questionCount: questionsForStudent.length,
    });
  } catch (error) {
    logger.error("[GetQuestions] Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch questions", ...(process.env.NODE_ENV !== "production" && { error: error.message }) });
  }
};

// ── Internal: send publish notification to all users in the test's department ─
const notifyDepartmentOnPublish = async (test) => {
  const users = await User.find({
    department: test.department,
    isActive: true,
    isBanned: false,
  }).select("_id").lean();

  if (!users.length) return;

  const userIds = users.map((u) => u._id.toString());

  const dateStr = test.date
    ? new Date(test.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "TBD";

  await notifyUsers(userIds, notifications.testPublished(test.title, test.department, dateStr, test.time));
  await Test.findByIdAndUpdate(test._id, { "notificationsSent.published": true });

  logger.info(`[TestNotify] Published notification sent to ${userIds.length} users for "${test.title}"`);
};

module.exports = exports;
