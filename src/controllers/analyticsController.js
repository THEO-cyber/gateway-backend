const User = require("../models/User");
const PastPaper = require("../models/PastPaper");
const Question = require("../models/Question");

// @route   GET /api/analytics/top-papers
// @desc    Get top downloaded papers
// @access  Private (Admin only)
exports.getTopPapers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const papers = await PastPaper.find()
      .select("fileName course department year downloads createdAt")
      .populate("uploadedBy", "email firstName lastName")
      .sort({ downloads: -1 })
      .limit(limit);

    res.json({ success: true, data: papers });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch top papers",
        code: "FETCH_ERROR",
      });
  }
};

// @route   GET /api/analytics/top-users
// @desc    Get most active users
// @access  Private (Admin only)
exports.getTopUsers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const users = await User.aggregate([
      {
        $lookup: {
          from: "pastpapers",
          localField: "_id",
          foreignField: "uploadedBy",
          as: "papers",
        },
      },
      {
        $lookup: {
          from: "questions",
          localField: "_id",
          foreignField: "userId",
          as: "questions",
        },
      },
      {
        $project: {
          email: 1,
          firstName: 1,
          lastName: 1,
          role: 1,
          papersCount: { $size: "$papers" },
          questionsCount: { $size: "$questions" },
          totalActivity: {
            $add: [{ $size: "$papers" }, { $size: "$questions" }],
          },
        },
      },
      { $sort: { totalActivity: -1 } },
      { $limit: limit },
    ]);

    res.json({ success: true, data: users });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch top users",
        code: "FETCH_ERROR",
      });
  }
};

// @route   GET /api/analytics/trending-questions
// @desc    Get trending questions
// @access  Private (Admin only)
exports.getTrendingQuestions = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const days = parseInt(req.query.days) || 7;

    const questions = await Question.find({
      createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
    })
      .select(
        "question subject department tags likesCount answersCount createdAt"
      )
      .populate("userId", "email firstName lastName")
      .sort({ likesCount: -1, answersCount: -1 })
      .limit(limit);

    res.json({ success: true, data: questions });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch trending questions",
        code: "FETCH_ERROR",
      });
  }
};

// @route   GET /api/analytics/engagement
// @desc    Get engagement metrics
// @access  Private (Admin only)
exports.getEngagementMetrics = async (req, res) => {
  try {
    const totalQuestions = await Question.countDocuments();
    const solvedQuestions = await Question.countDocuments({ isSolved: true });
    const avgAnswersPerQuestion = await Question.aggregate([
      { $group: { _id: null, avg: { $avg: "$answersCount" } } },
    ]);

    const totalLikes = await Question.aggregate([
      { $group: { _id: null, total: { $sum: "$likesCount" } } },
    ]);

    const mostActiveSubjects = await Question.aggregate([
      {
        $group: {
          _id: "$subject",
          count: { $sum: 1 },
          totalLikes: { $sum: "$likesCount" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      success: true,
      data: {
        totalQuestions,
        solvedQuestions,
        solvedRate:
          totalQuestions > 0
            ? ((solvedQuestions / totalQuestions) * 100).toFixed(2)
            : 0,
        avgAnswersPerQuestion: avgAnswersPerQuestion[0]?.avg?.toFixed(2) || 0,
        totalLikes: totalLikes[0]?.total || 0,
        mostActiveSubjects,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch engagement metrics",
        code: "FETCH_ERROR",
      });
  }
};

// @route   GET /api/analytics/charts/users
// @desc    Get user growth chart data
// @access  Private (Admin only)
exports.getUsersChartData = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    const data = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch users chart data",
        code: "FETCH_ERROR",
      });
  }
};

// @route   GET /api/analytics/charts/department
// @desc    Get department distribution
// @access  Private (Admin only)
exports.getDepartmentChartData = async (req, res) => {
  try {
    const papersByDept = await PastPaper.aggregate([
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const usersByDept = await User.aggregate([
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        papersByDepartment: papersByDept,
        usersByDepartment: usersByDept,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch department chart data",
        code: "FETCH_ERROR",
      });
  }
};

// @route   GET /api/analytics/charts/growth
// @desc    Get growth over time
// @access  Private (Admin only)
exports.getGrowthChartData = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const users = await User.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const papers = await PastPaper.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const questions = await Question.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        users,
        papers,
        questions,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch growth chart data",
        code: "FETCH_ERROR",
      });
  }
};

// @route   POST /api/analytics/export/csv
// @desc    Export analytics report as CSV
// @access  Private (Admin only)
exports.exportCSV = async (req, res) => {
  try {
    const users = await User.find()
      .select("email firstName lastName role department createdAt")
      .lean();

    const csv =
      "ID,Email,First Name,Last Name,Role,Department,Created At\n" +
      users
        .map(
          (u) =>
            `${u._id},${u.email},${u.firstName || ""},${u.lastName || ""},${
              u.role
            },${u.department || ""},${u.createdAt}`
        )
        .join("\n");

    res.header("Content-Type", "text/csv");
    res.header(
      "Content-Disposition",
      "attachment; filename=analytics_report.csv"
    );
    res.send(csv);
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to export CSV",
        code: "EXPORT_ERROR",
      });
  }
};

// @route   POST /api/analytics/export/pdf
// @desc    Export analytics report as PDF
// @access  Private (Admin only)
exports.exportPDF = async (req, res) => {
  res.status(501).json({
    success: false,
    error: "PDF export not implemented yet. Use CSV export instead.",
    code: "NOT_IMPLEMENTED",
  });
};

// @route   POST /api/analytics/export/excel
// @desc    Export analytics report as Excel
// @access  Private (Admin only)
exports.exportExcel = async (req, res) => {
  res.status(501).json({
    success: false,
    error: "Excel export not implemented yet. Use CSV export instead.",
    code: "NOT_IMPLEMENTED",
  });
};

module.exports = exports;
