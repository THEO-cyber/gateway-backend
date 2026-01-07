// @route   GET /api/tests/:id/result-detail
// @desc    Get detailed question results for a test and user
// @access  Public
exports.getResultDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.query;
    if (!id || id === "" || id === "result-detail") {
      return res.status(400).json({
        success: false,
        message: `A valid testId must be provided in the URL (e.g. /api/tests/{testId}/result-detail). Received id: '${id}'`,
        debug: { id, email },
      });
    }
    if (!email) {
      return res.status(400).json({
        success: false,
        message:
          "Student email is required in the query string (e.g. ?email=your_email)",
        debug: { id, email },
      });
    }
    // Find the submission
    const submission = await Submission.findOne({
      testId: id,
      studentEmail: email,
    });
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: `Submission not found for testId '${id}' and email '${email}'.`,
        debug: { id, email },
      });
    }
    // Find the test to get questions
    const test = await Test.findById(id);
    if (!test) {
      return res.status(404).json({
        success: false,
        message: `Test not found for testId '${id}'.`,
        debug: { id, email },
      });
    }
    // Build detailed results for each question
    const details = test.questions.map((question, index) => {
      const questionId = `q${index}`;
      // Match user's answer by questionId, fallback to index
      let userAnswer = submission.answers.find(
        (ans) => ans.questionId && ans.questionId.trim() === questionId
      );
      if (!userAnswer && submission.answers[index]) {
        userAnswer = submission.answers[index];
      }
      return {
        questionIndex: index,
        question: question.question,
        options: question.options,
        correctAnswer: question.correctAnswer,
        selectedAnswer: userAnswer ? userAnswer.selectedAnswer : null,
        isCorrect:
          userAnswer && userAnswer.selectedAnswer === question.correctAnswer,
      };
    });

    // Professional response, no debug info
    return res.status(200).json({
      success: true,
      testId: id,
      studentEmail: email,
      questionCount: test.questions.length,
      answerCount: submission.answers.length,
      details,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message.includes("Cast to ObjectId")
        ? "Invalid testId format. Please provide a valid testId in the URL."
        : "Failed to fetch result detail",
      error: error.message,
    });
  }
};
const Test = require("../models/Test");
const Enrollment = require("../models/Enrollment");
const Submission = require("../models/Submission");

// @route   POST /api/tests/:id/enroll
// @desc    Student enrolls in test
// @access  Public
exports.enrollInTest = async (req, res) => {
  try {
    const { studentEmail, studentName } = req.body;

    if (!studentEmail || !studentName) {
      return res.status(400).json({
        success: false,
        message: "Student email and name are required",
      });
    }

    const test = await Test.findById(req.params.id);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      testId: req.params.id,
      studentEmail,
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: "Already enrolled in this test",
      });
    }

    const enrollment = await Enrollment.create({
      testId: req.params.id,
      studentEmail,
      studentName,
    });

    res.status(201).json({
      success: true,
      enrollment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to enroll in test",
      error: error.message,
    });
  }
};

// @route   GET /api/tests/:id/enrollments
// @desc    Get all enrollments for a test (Admin)
// @access  Private (Admin only)
exports.getTestEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ testId: req.params.id }).sort({
      enrolledAt: -1,
    });

    res.json({
      success: true,
      enrollments,
      total: enrollments.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch enrollments",
      error: error.message,
    });
  }
};

// @route   POST /api/tests/:id/submit
// @desc    Student submits test
// @access  Public
exports.submitTest = async (req, res) => {
  try {
    const { studentEmail, studentName, answers } = req.body;

    if (!studentEmail || !studentName || !answers) {
      return res.status(400).json({
        success: false,
        message: "Student email, name, and answers are required",
      });
    }

    const test = await Test.findById(req.params.id);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    // Check if already submitted
    const existingSubmission = await Submission.findOne({
      testId: req.params.id,
      studentEmail,
    });

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: "Test already submitted",
      });
    }

    // Store answers exactly as sent by frontend, no remapping
    const answersToSave = Array.isArray(answers) ? answers : [];

    // Calculate score: match by questionId if present, else by index
    let score = 0;
    const totalQuestions = test.questions.length;
    for (let i = 0; i < totalQuestions; i++) {
      let answer = answersToSave[i];
      let question = test.questions[i];
      // If questionId is present, try to match
      if (answer && answer.questionId) {
        const idx = test.questions.findIndex(
          (q, qIdx) => `q${qIdx}` === answer.questionId
        );
        if (idx !== -1) {
          question = test.questions[idx];
        }
      }
      if (
        answer &&
        question &&
        question.correctAnswer === answer.selectedAnswer
      ) {
        score++;
      }
    }

    const percentage = (score / totalQuestions) * 100;

    // Calculate grade
    let grade = "F";
    if (percentage >= 90) grade = "A";
    else if (percentage >= 80) grade = "B";
    else if (percentage >= 70) grade = "C";
    else if (percentage >= 60) grade = "D";
    else if (percentage >= 50) grade = "E";

    // Create submission
    const submission = await Submission.create({
      testId: req.params.id,
      studentEmail,
      studentName,
      answers: answersToSave,
      score,
      totalQuestions,
      percentage,
      grade,
    });

    // Update enrollment status
    await Enrollment.findOneAndUpdate(
      { testId: req.params.id, studentEmail },
      { submitted: true }
    );

    res.status(201).json({
      success: true,
      score,
      totalQuestions,
      percentage,
      grade,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to submit test",
      error: error.message,
    });
  }
};

// @route   GET /api/tests/:id/submissions
// @desc    Get all submissions for a test (Admin)
// @access  Private (Admin only)
exports.getTestSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({ testId: req.params.id })
      .select("-answers") // Don't include answers in list view
      .sort({ submittedAt: -1 });

    res.json({
      success: true,
      submissions,
      total: submissions.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch submissions",
      error: error.message,
    });
  }
};

// @route   GET /api/tests/:id/submissions/:email
// @desc    Get specific student's submission details (Admin)
// @access  Private (Admin only)
exports.getStudentSubmission = async (req, res) => {
  try {
    const submission = await Submission.findOne({
      testId: req.params.id,
      studentEmail: req.params.email,
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    res.json({
      success: true,
      submission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch submission",
      error: error.message,
    });
  }
};

// @route   POST /api/tests/:id/results/release
// @desc    Release results to selected students (7-day rule)
// @access  Private (Admin only)
exports.releaseResults = async (req, res) => {
  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of student emails",
      });
    }

    const test = await Test.findById(req.params.id);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    // Check 15-minute rule
    const completedAt = test.completedAt || test.createdAt;
    const minutesSinceCompletion =
      (new Date() - new Date(completedAt)) / (1000 * 60);

    if (minutesSinceCompletion < 15) {
      return res.status(400).json({
        success: false,
        message: `Results can only be released 15 minutes after test completion. ${Math.ceil(
          15 - minutesSinceCompletion
        )} minute(s) remaining.`,
      });
    }

    // Release results for specified emails
    const result = await Submission.updateMany(
      {
        testId: req.params.id,
        studentEmail: { $in: emails },
        resultsReleased: false,
      },
      {
        resultsReleased: true,
        releasedAt: new Date(),
      }
    );

    res.json({
      success: true,
      releasedCount: result.modifiedCount,
      message: `Results released to ${result.modifiedCount} student(s)`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to release results",
      error: error.message,
    });
  }
};

// @route   GET /api/tests/enrolled
// @desc    Get tests student is enrolled in
// @access  Public
exports.getEnrolledTests = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Student email is required",
      });
    }

    const enrollments = await Enrollment.find({ studentEmail: email })
      .populate("testId")
      .sort({ enrolledAt: -1 });

    const enrolledTests = enrollments.map((e) => ({
      _id: e.testId._id,
      title: e.testId.title,
      department: e.testId.department,
      date: e.testId.date,
      time: e.testId.time,
      duration: e.testId.duration,
      status: e.testId.status,
      enrolledAt: e.enrolledAt,
      submitted: e.submitted,
    }));

    res.json({
      success: true,
      data: enrolledTests,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch enrolled tests",
      error: error.message,
    });
  }
};

// @route   GET /api/tests/results
// @desc    Get student results (if released)
// @access  Public
exports.getStudentResults = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Student email is required",
      });
    }

    // Debug logging
    console.log("[getStudentResults] Query:", {
      studentEmail: email,
    });
    const results = await Submission.find({
      studentEmail: email,
    })
      .populate("testId", "title department")
      .sort({ submittedAt: -1 });

    console.log(
      `[getStudentResults] Found ${results.length} result(s) for email: ${email}`
    );

    const formattedResults = results.map((r) => ({
      testId: r.testId._id,
      testTitle: r.testId.title,
      score: r.score,
      totalQuestions: r.totalQuestions,
      percentage: r.percentage,
      grade: r.grade,
      submittedAt: r.submittedAt,
      releasedAt: r.releasedAt,
    }));

    res.json({
      success: true,
      results: formattedResults,
      debug: {
        query: { studentEmail: email, resultsReleased: true },
        found: results.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch results",
      error: error.message,
    });
  }
};

module.exports = exports;
