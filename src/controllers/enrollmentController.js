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
      // Match user's answer by questionId (which can be MongoDB ObjectId or numeric index)
      let userAnswer = null;

      // Strategy 1: Match by MongoDB ObjectId if question has _id
      if (question._id) {
        userAnswer = submission.answers.find(
          (ans) =>
            ans.questionId &&
            ans.questionId.toString() === question._id.toString(),
        );
      }

      // Strategy 2: Match by numeric index
      if (!userAnswer) {
        userAnswer = submission.answers.find(
          (ans) =>
            ans.questionId !== undefined && parseInt(ans.questionId) === index,
        );
      }

      // Strategy 3: Fallback to old format for backward compatibility
      if (!userAnswer) {
        const questionId = `q${index}`;
        userAnswer = submission.answers.find(
          (ans) => ans.questionId && ans.questionId.trim() === questionId,
        );
      }

      // Strategy 4: Final fallback using array index
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

    // Get the user's question mapping for proper scoring (optional for backward compatibility)
    const shuffleUtils = require("../utils/shuffleUtils");
    let questionMap = null;
    try {
      questionMap = await shuffleUtils.getQuestionMap(
        req.user.id,
        req.params.id,
      );
    } catch (error) {
      console.warn("[SubmitTest] Could not get question map:", error.message);
    }

    // Store answers exactly as sent by frontend
    const answersToSave = Array.isArray(answers) ? answers : [];

    // More flexible validation - allow different answer formats
    const validAnswers = [];
    for (let i = 0; i < answersToSave.length; i++) {
      const answer = answersToSave[i];
      if (!answer) continue;

      // Support multiple answer formats for backward compatibility
      let questionId = null;
      let selectedAnswer = null;
      let questionIndex = null;

      // Format 1: {questionId: MongoDB ObjectId string, selectedAnswer: string}
      if (answer.questionId !== undefined && answer.selectedAnswer) {
        // If questionId is a MongoDB ObjectId string, find matching question by _id
        if (
          typeof answer.questionId === "string" &&
          answer.questionId.length === 24
        ) {
          questionIndex = test.questions.findIndex(
            (q) => q._id && q._id.toString() === answer.questionId,
          );
          if (questionIndex >= 0) {
            questionId = questionIndex; // Use found index
            selectedAnswer = answer.selectedAnswer;
          }
        }
        // If questionId is numeric (including 0), use directly
        else if (
          typeof answer.questionId === "number" ||
          !isNaN(parseInt(answer.questionId))
        ) {
          questionId = parseInt(answer.questionId);
          selectedAnswer = answer.selectedAnswer;
        }
      }
      // Format 2: {question: number, answer: string} (old format)
      else if (answer.question !== undefined && answer.answer) {
        questionId = parseInt(answer.question);
        selectedAnswer = answer.answer;
      }
      // Format 3: Direct array with index-based answers
      else if (typeof answer === "string") {
        questionId = i;
        selectedAnswer = answer;
      }

      if (questionId !== null && selectedAnswer) {
        validAnswers.push({
          questionId: questionId,
          selectedAnswer: selectedAnswer.trim(),
          originalIndex: i,
          originalQuestionObjectId: answer.questionId, // Keep original for debugging
        });
      }
    }

    console.log(
      `[SubmitTest] Processing ${validAnswers.length} valid answers out of ${answersToSave.length} submitted`,
    );

    // Calculate score with multiple scoring strategies for accuracy
    let score = 0;
    const totalQuestions = test.questions.length;

    for (const answer of validAnswers) {
      let questionIndex = answer.questionId;

      // Validate question index is within bounds
      if (questionIndex >= 0 && questionIndex < totalQuestions) {
        const question = test.questions[questionIndex];
        if (question && question.correctAnswer === answer.selectedAnswer) {
          score++;
          console.log(
            `[SubmitTest] Correct answer for question ${questionIndex}: ${answer.selectedAnswer} (ObjectId: ${answer.originalQuestionObjectId})`,
          );
        } else if (question) {
          console.log(
            `[SubmitTest] Incorrect answer for question ${questionIndex}: ${answer.selectedAnswer} (correct: ${question.correctAnswer}) (ObjectId: ${answer.originalQuestionObjectId})`,
          );
        }
      } else {
        console.warn(
          `[SubmitTest] Invalid question index: ${questionIndex} for ObjectId: ${answer.originalQuestionObjectId}`,
        );
      }
    }

    console.log(`[SubmitTest] Final score: ${score}/${totalQuestions}`);

    // Clean up question mapping after submission
    if (questionMap) {
      try {
        await shuffleUtils.cleanupQuestionMap(req.user.id, req.params.id);
      } catch (error) {
        console.warn(
          "[SubmitTest] Could not cleanup question map:",
          error.message,
        );
      }
    }

    const percentage =
      totalQuestions > 0
        ? Math.round((score / totalQuestions) * 100 * 100) / 100
        : 0;

    console.log(`[SubmitTest] Calculated percentage: ${percentage}%`);

    // Calculate grade based on percentage
    let grade = "F";
    if (percentage >= 90) grade = "A";
    else if (percentage >= 80) grade = "B";
    else if (percentage >= 70) grade = "C";
    else if (percentage >= 60) grade = "D";
    else if (percentage >= 50) grade = "E";

    console.log(`[SubmitTest] Assigned grade: ${grade}`);

    // Create submission with original answers format for compatibility
    const submission = await Submission.create({
      testId: req.params.id,
      studentEmail,
      studentName,
      answers: answersToSave, // Store original format for detailed results
      score,
      totalQuestions,
      percentage,
      grade,
    });

    console.log(`[SubmitTest] Submission created with ID: ${submission._id}`);

    // Update enrollment status
    await Enrollment.findOneAndUpdate(
      { testId: req.params.id, studentEmail },
      { submitted: true },
    );

    res.status(201).json({
      success: true,
      score,
      totalQuestions,
      percentage,
      grade,
      submissionId: submission._id,
      message: `Test submitted successfully. Score: ${score}/${totalQuestions} (${percentage}%)`,
    });
  } catch (error) {
    console.error("[SubmitTest] Error:", error);
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
          15 - minutesSinceCompletion,
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
      },
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
      `[getStudentResults] Found ${results.length} result(s) for email: ${email}`,
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
