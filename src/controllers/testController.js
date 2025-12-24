const Test = require("../models/Test");
const Enrollment = require("../models/Enrollment");
const Submission = require("../models/Submission");

// @route   POST /api/tests
// @desc    Create new test
// @access  Private (Admin only)
exports.createTest = async (req, res) => {
  try {
    const {
      title,
      department,
      date,
      time,
      duration,
      passingPercentage,
      description,
      status,
    } = req.body;

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

    res.status(201).json({
      success: true,
      test,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create test",
      error: error.message,
    });
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

    const tests = await Test.find(query)
      .populate("createdBy", "firstName lastName email")
      .sort({ date: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Test.countDocuments(query);

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
    res.status(500).json({
      success: false,
      message: "Failed to fetch tests",
      error: error.message,
    });
  }
};

// @route   GET /api/tests/:id
// @desc    Get single test
// @access  Private
exports.getTestById = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate(
      "createdBy",
      "firstName lastName email"
    );

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    res.json({
      success: true,
      test,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch test",
      error: error.message,
    });
  }
};

// @route   PUT /api/tests/:id
// @desc    Update test
// @access  Private (Admin only)
exports.updateTest = async (req, res) => {
  try {
    const test = await Test.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    // If status changed to completed, set completedAt
    if (req.body.status === "completed" && !test.completedAt) {
      test.completedAt = new Date();
      await test.save();
    }

    res.json({
      success: true,
      test,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update test",
      error: error.message,
    });
  }
};

// @route   DELETE /api/tests/:id
// @desc    Delete test
// @access  Private (Admin only)
exports.deleteTest = async (req, res) => {
  try {
    const test = await Test.findByIdAndDelete(req.params.id);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    // Also delete related enrollments and submissions
    await Enrollment.deleteMany({ testId: req.params.id });
    await Submission.deleteMany({ testId: req.params.id });

    res.json({
      success: true,
      message: "Test and related data deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete test",
      error: error.message,
    });
  }
};

// @route   POST /api/tests/:id/questions
// @desc    Add questions to test
// @access  Private (Admin only)
exports.addQuestions = async (req, res) => {
  try {
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of questions",
      });
    }

    const test = await Test.findById(req.params.id);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    test.questions = questions;
    await test.save();

    res.json({
      success: true,
      questionsCount: test.questions.length,
      message: `${test.questions.length} questions added successfully`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to add questions",
      error: error.message,
    });
  }
};

// @route   GET /api/tests/:id/questions
// @desc    Get test questions (for students during test)
// @access  Private
exports.getTestQuestions = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).select("questions title");

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    // Return questions without correct answers for students
    const questionsForStudent = test.questions.map((q, index) => ({
      index,
      question: q.question,
      options: q.options,
    }));

    res.json({
      success: true,
      testTitle: test.title,
      questions: questionsForStudent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch questions",
      error: error.message,
    });
  }
};

module.exports = exports;
