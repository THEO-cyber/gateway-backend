const Question = require("../models/Question");
const User = require("../models/User");

// @route   GET /api/qa/questions
// @desc    Get all questions with filters
// @access  Private
exports.getQuestions = async (req, res) => {
  try {
    const {
      department,
      subject,
      tag,
      isSolved,
      sortBy = "recent",
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};
    if (department) query.department = department;
    if (subject) query.subject = subject;
    if (tag) query.tags = tag;
    if (isSolved !== undefined) query.isSolved = isSolved === "true";

    let sort = {};
    if (sortBy === "popular") sort = { likesCount: -1 };
    else if (sortBy === "unanswered") {
      query.answersCount = 0;
      sort = { createdAt: -1 };
    } else {
      sort = { createdAt: -1 };
    }

    const questions = await Question.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select("-likedBy -answers.likedBy");

    const total = await Question.countDocuments(query);

    res.json({
      success: true,
      data: {
        questions,
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
      message: "Server error",
      error: error.message,
    });
  }
};

// @route   GET /api/qa/questions/:id
// @desc    Get single question with all answers
// @access  Private
exports.getQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // Check if current user liked the question
    const hasLiked = question.likedBy.some(
      (id) => id.toString() === req.user._id.toString()
    );

    // Check which answers current user liked
    const answersWithLikeStatus = question.answers.map((answer) => ({
      ...answer.toObject(),
      hasLiked: answer.likedBy.some(
        (id) => id.toString() === req.user._id.toString()
      ),
      likedBy: undefined, // Remove likedBy array from response
    }));

    res.json({
      success: true,
      data: {
        ...question.toObject(),
        hasLiked,
        likedBy: undefined, // Remove likedBy array from response
        answers: answersWithLikeStatus,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @route   POST /api/qa/questions
// @desc    Ask a new question
// @access  Private
exports.askQuestion = async (req, res) => {
  try {
    const { question, subject, department, tags } = req.body;

    if (!question || question.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Question must be at least 10 characters long",
      });
    }

    const newQuestion = await Question.create({
      userId: req.user._id,
      userName: req.user.email.split("@")[0],
      question: question.trim(),
      subject: subject?.trim(),
      department: department?.trim(),
      tags: tags || [],
    });

    res.status(201).json({
      success: true,
      message: "Question posted successfully",
      data: newQuestion,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to post question",
      error: error.message,
    });
  }
};

// @route   PUT /api/qa/questions/:id
// @desc    Update a question
// @access  Private (owner only)
exports.updateQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    if (question.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this question",
      });
    }

    const { question: questionText, subject, department, tags } = req.body;

    if (questionText) question.question = questionText.trim();
    if (subject) question.subject = subject.trim();
    if (department) question.department = department.trim();
    if (tags) question.tags = tags;
    question.updatedAt = Date.now();

    await question.save();

    res.json({
      success: true,
      message: "Question updated successfully",
      data: question,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update question",
      error: error.message,
    });
  }
};

// @route   DELETE /api/qa/questions/:id
// @desc    Delete a question
// @access  Private (owner only)
exports.deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    if (question.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this question",
      });
    }

    await question.deleteOne();

    res.json({
      success: true,
      message: "Question deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete question",
      error: error.message,
    });
  }
};

// @route   POST /api/qa/questions/:id/answers
// @desc    Answer a question
// @access  Private
exports.answerQuestion = async (req, res) => {
  try {
    const { answer } = req.body;

    if (!answer || answer.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: "Answer must be at least 5 characters long",
      });
    }

    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const newAnswer = {
      userId: req.user._id,
      userName: req.user.email.split("@")[0],
      answer: answer.trim(),
      createdAt: Date.now(),
    };

    question.answers.push(newAnswer);
    question.answersCount = question.answers.length;
    await question.save();

    res.status(201).json({
      success: true,
      message: "Answer posted successfully",
      data: question.answers[question.answers.length - 1],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to post answer",
      error: error.message,
    });
  }
};

// @route   PUT /api/qa/questions/:questionId/answers/:answerId
// @desc    Update an answer
// @access  Private (owner only)
exports.updateAnswer = async (req, res) => {
  try {
    const { questionId, answerId } = req.params;
    const { answer } = req.body;

    const question = await Question.findById(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const answerDoc = question.answers.id(answerId);

    if (!answerDoc) {
      return res.status(404).json({
        success: false,
        message: "Answer not found",
      });
    }

    if (answerDoc.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this answer",
      });
    }

    answerDoc.answer = answer.trim();
    await question.save();

    res.json({
      success: true,
      message: "Answer updated successfully",
      data: answerDoc,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update answer",
      error: error.message,
    });
  }
};

// @route   DELETE /api/qa/questions/:questionId/answers/:answerId
// @desc    Delete an answer
// @access  Private (owner only)
exports.deleteAnswer = async (req, res) => {
  try {
    const { questionId, answerId } = req.params;

    const question = await Question.findById(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const answerDoc = question.answers.id(answerId);

    if (!answerDoc) {
      return res.status(404).json({
        success: false,
        message: "Answer not found",
      });
    }

    if (answerDoc.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this answer",
      });
    }

    answerDoc.deleteOne();
    question.answersCount = question.answers.length;
    await question.save();

    res.json({
      success: true,
      message: "Answer deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete answer",
      error: error.message,
    });
  }
};

// @route   POST /api/qa/questions/:id/like
// @desc    Toggle like on a question
// @access  Private
exports.toggleQuestionLike = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const likeIndex = question.likedBy.indexOf(req.user._id);

    if (likeIndex > -1) {
      // Unlike
      question.likedBy.splice(likeIndex, 1);
      question.likesCount -= 1;
    } else {
      // Like
      question.likedBy.push(req.user._id);
      question.likesCount += 1;
    }

    await question.save();

    res.json({
      success: true,
      data: {
        likesCount: question.likesCount,
        hasLiked: likeIndex === -1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @route   POST /api/qa/questions/:questionId/answers/:answerId/like
// @desc    Toggle like on an answer
// @access  Private
exports.toggleAnswerLike = async (req, res) => {
  try {
    const { questionId, answerId } = req.params;

    const question = await Question.findById(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const answer = question.answers.id(answerId);

    if (!answer) {
      return res.status(404).json({
        success: false,
        message: "Answer not found",
      });
    }

    const likeIndex = answer.likedBy.indexOf(req.user._id);

    if (likeIndex > -1) {
      // Unlike
      answer.likedBy.splice(likeIndex, 1);
      answer.likesCount -= 1;
    } else {
      // Like
      answer.likedBy.push(req.user._id);
      answer.likesCount += 1;
    }

    await question.save();

    res.json({
      success: true,
      data: {
        likesCount: answer.likesCount,
        hasLiked: likeIndex === -1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @route   POST /api/qa/questions/:questionId/answers/:answerId/accept
// @desc    Accept an answer (mark as solution)
// @access  Private (question owner only)
exports.acceptAnswer = async (req, res) => {
  try {
    const { questionId, answerId } = req.params;

    const question = await Question.findById(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    if (question.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the question owner can accept answers",
      });
    }

    const answer = question.answers.id(answerId);

    if (!answer) {
      return res.status(404).json({
        success: false,
        message: "Answer not found",
      });
    }

    // Unaccept all other answers
    question.answers.forEach((a) => {
      a.isAccepted = false;
    });

    // Accept this answer
    answer.isAccepted = true;
    question.isSolved = true;
    await question.save();

    res.json({
      success: true,
      message: "Answer accepted as solution",
      data: answer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to accept answer",
      error: error.message,
    });
  }
};

// @route   GET /api/qa/search
// @desc    Search questions
// @access  Private
exports.searchQuestions = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const questions = await Question.find({
      $or: [
        { question: { $regex: q, $options: "i" } },
        { subject: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("-likedBy -answers.likedBy");

    res.json({
      success: true,
      data: questions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @route   GET /api/qa/my-questions
// @desc    Get current user's questions
// @access  Private
exports.getMyQuestions = async (req, res) => {
  try {
    const questions = await Question.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select("-likedBy -answers.likedBy");

    res.json({
      success: true,
      data: questions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
