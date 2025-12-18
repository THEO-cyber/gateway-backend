const User = require("../models/User");
const PastPaper = require("../models/PastPaper");
const Question = require("../models/Question");
const Department = require("../models/Department");
const Course = require("../models/Course");

// @route   GET /api/dashboard/stats
// @desc    Get overall dashboard statistics
// @access  Private (Admin only)
exports.getOverallStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalPapers = await PastPaper.countDocuments();
    const totalQuestions = await Question.countDocuments();

    const totalAnswers = await Question.aggregate([
      { $unwind: "$answers" },
      { $count: "total" },
    ]);

    const totalDownloads = await PastPaper.aggregate([
      { $group: { _id: null, total: { $sum: "$downloads" } } },
    ]);

    const activeUsersToday = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const activeUsersWeek = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });

    const activeUsersMonth = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });

    res.json({
      success: true,
      data: {
        totalUsers,
        totalPapers,
        totalQuestions,
        totalAnswers: totalAnswers[0]?.total || 0,
        totalDownloads: totalDownloads[0]?.total || 0,
        activeUsersToday,
        activeUsersWeek,
        activeUsersMonth,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch statistics",
      code: "STATS_ERROR",
    });
  }
};

// @route   GET /api/dashboard/active-users
// @desc    Get active users data
// @access  Private (Admin only)
exports.getActiveUsers = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;

    const activeUsers = await User.aggregate([
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

    res.json({
      success: true,
      data: activeUsers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch active users",
      code: "ACTIVE_USERS_ERROR",
    });
  }
};

// @route   GET /api/dashboard/popular-courses
// @desc    Get popular courses by paper count
// @access  Private (Admin only)
exports.getPopularCourses = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const popularCourses = await PastPaper.aggregate([
      {
        $group: {
          _id: "$course",
          paperCount: { $sum: 1 },
          totalDownloads: { $sum: "$downloads" },
        },
      },
      { $sort: { totalDownloads: -1 } },
      { $limit: limit },
    ]);

    res.json({
      success: true,
      data: popularCourses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch popular courses",
      code: "POPULAR_COURSES_ERROR",
    });
  }
};

// @route   GET /api/dashboard/recent-activity
// @desc    Get recent activity feed
// @access  Private (Admin only)
exports.getRecentActivity = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    // Recent users
    const recentUsers = await User.find()
      .select("email firstName lastName role createdAt")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Recent papers
    const recentPapers = await PastPaper.find()
      .select("fileName course department uploadedBy createdAt")
      .populate("uploadedBy", "email firstName lastName")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Recent questions
    const recentQuestions = await Question.find()
      .select("question subject userId createdAt")
      .populate("userId", "email firstName lastName")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Combine and format activities
    const activities = [
      ...recentUsers.map((u) => ({
        type: "user_registered",
        message: `${u.firstName} ${u.lastName} registered`,
        user: u,
        timestamp: u.createdAt,
      })),
      ...recentPapers.map((p) => ({
        type: "paper_uploaded",
        message: `${p.uploadedBy?.firstName || "User"} uploaded ${p.fileName}`,
        paper: p,
        timestamp: p.createdAt,
      })),
      ...recentQuestions.map((q) => ({
        type: "question_asked",
        message: `${q.userId?.firstName || "User"} asked about ${q.subject}`,
        question: q,
        timestamp: q.createdAt,
      })),
    ];

    // Sort by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedActivities = activities.slice(0, limit);

    res.json({
      success: true,
      data: limitedActivities,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch recent activity",
      code: "RECENT_ACTIVITY_ERROR",
    });
  }
};

// @route   GET /api/dashboard/download-stats
// @desc    Get download statistics
// @access  Private (Admin only)
exports.getDownloadStats = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    // Top downloaded papers
    const topPapers = await PastPaper.find()
      .select("fileName course department downloads")
      .sort({ downloads: -1 })
      .limit(10);

    // Downloads by department
    const byDepartment = await PastPaper.aggregate([
      {
        $group: {
          _id: "$department",
          totalDownloads: { $sum: "$downloads" },
          paperCount: { $sum: 1 },
        },
      },
      { $sort: { totalDownloads: -1 } },
    ]);

    // Downloads by year
    const byYear = await PastPaper.aggregate([
      {
        $group: {
          _id: "$year",
          totalDownloads: { $sum: "$downloads" },
          paperCount: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        topPapers,
        byDepartment,
        byYear,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch download statistics",
      code: "DOWNLOAD_STATS_ERROR",
    });
  }
};

module.exports = exports;
