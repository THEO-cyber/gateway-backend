const User = require("../models/User");
const PastPaper = require("../models/PastPaper");
const Question = require("../models/Question");
const Announcement = require("../models/Announcement");
const Course = require("../models/Course");

// @route   GET /api/admin/stats
// @desc    Get dashboard statistics
// @access  Private (Admin only)
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalPapers = await PastPaper.countDocuments();
    const totalQuestions = await Question.countDocuments();

    const totalAnswers = await Question.aggregate([
      { $project: { answersCount: 1 } },
      { $group: { _id: null, total: { $sum: "$answersCount" } } },
    ]);

    const activeUsersToday = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const totalDownloads = await PastPaper.aggregate([
      { $group: { _id: null, total: { $sum: "$downloads" } } },
    ]);

    // Papers by department
    const papersByDepartment = await PastPaper.aggregate([
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Questions by subject
    const questionsBySubject = await Question.aggregate([
      { $group: { _id: "$subject", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalPapers,
          totalQuestions,
          totalAnswers: totalAnswers[0]?.total || 0,
          activeUsersToday,
          totalDownloads: totalDownloads[0]?.total || 0,
        },
        papersByDepartment,
        questionsBySubject,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
};

// @route   GET /api/admin/dashboard/stats
// @desc    Get simplified dashboard stats
// @access  Private (Admin only)
exports.getSimplifiedDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalPapers = await PastPaper.countDocuments();
    const totalQuestions = await Question.countDocuments();

    const totalDownloads = await PastPaper.aggregate([
      { $group: { _id: null, total: { $sum: "$downloads" } } },
    ]);

    res.json({
      totalUsers,
      totalPapers,
      totalQuestions,
      totalDownloads: totalDownloads[0]?.total || 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
      error: error.message,
    });
  }
};

// @route   GET /api/admin/dashboard/quick-stats
// @desc    Get quick stats for today
// @access  Private (Admin only)
exports.getQuickStats = async (req, res) => {
  try {
    const Test = require("../models/Test");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeToday = await User.countDocuments({
      lastLogin: { $gte: today },
    });

    const pendingApprovals = await PastPaper.countDocuments({
      status: "pending",
    });

    const scheduledTests = await Test.countDocuments({
      status: "scheduled",
      date: { $gte: today },
    });

    res.json({
      activeToday,
      pendingApprovals,
      scheduledTests,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch quick stats",
      error: error.message,
    });
  }
};

// @route   GET /api/admin/users
// @desc    Get all users with filters
// @access  Private (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const { search, role, isActive, page = 1, limit = 20 } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ];
    }
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === "true";

    const users = await User.find(query)
      .select("-password -resetPasswordOTP -resetPasswordExpire")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments(query);

    // Get activity stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const papersUploaded = await PastPaper.countDocuments({
          uploadedBy: user._id,
        });
        const questionsAsked = await Question.countDocuments({
          userId: user._id,
        });
        const answersGiven = await Question.countDocuments({
          "answers.userId": user._id,
        });

        return {
          ...user.toObject(),
          stats: {
            papersUploaded,
            questionsAsked,
            answersGiven,
          },
        };
      })
    );

    res.json({
      success: true,
      data: {
        users: usersWithStats,
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
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

// @route   GET /api/admin/users/:id
// @desc    Get user details
// @access  Private (Admin only)
exports.getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -resetPasswordOTP -resetPasswordExpire"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const papers = await PastPaper.find({ uploadedBy: user._id })
      .select("fileName course department year createdAt")
      .limit(10);

    const questions = await Question.find({ userId: user._id })
      .select("question subject createdAt answersCount")
      .limit(10);

    res.json({
      success: true,
      data: {
        user,
        recentPapers: papers,
        recentQuestions: questions,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch user details",
      error: error.message,
    });
  }
};

// @route   PUT /api/admin/users/:id
// @desc    Update user (role, status)
// @access  Private (Admin only)
exports.updateUser = async (req, res) => {
  try {
    const { role, isActive, isBanned } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (isBanned !== undefined) user.isBanned = isBanned;

    await user.save();

    res.json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    });
  }
};

// @route   DELETE /api/admin/users/:id
// @desc    Delete user
// @access  Private (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!userId || userId === "undefined") {
      return res.status(400).json({
        success: false,
        message: "Missing or invalid user ID in request.",
        details: {
          userId,
          method: req.method,
          url: req.originalUrl,
          timestamp: new Date().toISOString(),
        },
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
        details: {
          userId,
          method: req.method,
          url: req.originalUrl,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Delete user's content
    await PastPaper.deleteMany({ uploadedBy: user._id });
    await Question.deleteMany({ userId: user._id });

    await user.deleteOne();

    res.json({
      success: true,
      message: "User and associated content deleted successfully",
      details: { userId },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
      stack: error.stack,
      details: {
        userId: req.params.id,
        method: req.method,
        url: req.originalUrl,
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// @route   GET /api/admin/papers/pending
// @desc    Get papers pending approval (if needed)
// @access  Private (Admin only)
exports.getPendingPapers = async (req, res) => {
  try {
    const papers = await PastPaper.find()
      .sort({ createdAt: -1 })
      .populate("uploadedBy", "email firstName lastName")
      .limit(50);

    res.json({
      success: true,
      data: papers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch papers",
      error: error.message,
    });
  }
};

// @route   DELETE /api/admin/questions/:id
// @desc    Delete any question (moderation)
// @access  Private (Admin only)
exports.deleteAnyQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
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

// @route   DELETE /api/admin/answers/:questionId/:answerId
// @desc    Delete any answer (moderation)
// @access  Private (Admin only)
exports.deleteAnyAnswer = async (req, res) => {
  try {
    const question = await Question.findById(req.params.questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const answer = question.answers.id(req.params.answerId);

    if (!answer) {
      return res.status(404).json({
        success: false,
        message: "Answer not found",
      });
    }

    answer.deleteOne();
    question.answersCount = Math.max(0, question.answersCount - 1);
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

// @route   GET /api/admin/reports/popular-papers
// @desc    Get most downloaded papers
// @access  Private (Admin only)
exports.getPopularPapers = async (req, res) => {
  try {
    const papers = await PastPaper.find()
      .sort({ downloads: -1 })
      .limit(20)
      .populate("uploadedBy", "email firstName lastName");

    res.json({
      success: true,
      data: papers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch popular papers",
      error: error.message,
    });
  }
};

// @route   GET /api/admin/reports/active-users
// @desc    Get most active users
// @access  Private (Admin only)
exports.getActiveUsers = async (req, res) => {
  try {
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
          papersCount: { $size: "$papers" },
          questionsCount: { $size: "$questions" },
          totalActivity: {
            $add: [{ $size: "$papers" }, { $size: "$questions" }],
          },
        },
      },
      { $sort: { totalActivity: -1 } },
      { $limit: 20 },
    ]);

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch active users",
      error: error.message,
    });
  }
};

// @route   POST /api/users/bulk-delete
// @desc    Bulk delete users
// @access  Private (Admin only)
exports.bulkDeleteUsers = async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please provide an array of user IDs",
        code: "INVALID_INPUT",
      });
    }

    // Delete users and their content
    await User.deleteMany({ _id: { $in: userIds } });
    await PastPaper.deleteMany({ uploadedBy: { $in: userIds } });
    await Question.deleteMany({ userId: { $in: userIds } });

    res.json({
      success: true,
      message: `${userIds.length} users deleted successfully`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to delete users",
      code: "BULK_DELETE_ERROR",
    });
  }
};

// @route   POST /api/users/export
// @desc    Export users to CSV
// @access  Private (Admin only)
exports.exportUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select(
        "email firstName lastName role department yearOfStudy isActive isBanned createdAt"
      )
      .lean();

    // Convert to CSV
    const csvHeader =
      "ID,Email,First Name,Last Name,Role,Department,Year,Active,Banned,Created At\n";
    const csvRows = users
      .map(
        (u) =>
          `${u._id},${u.email},${u.firstName || ""},${u.lastName || ""},${
            u.role
          },${u.department || ""},${u.yearOfStudy || ""},${u.isActive},${
            u.isBanned
          },${u.createdAt}`
      )
      .join("\n");

    const csv = csvHeader + csvRows;

    res.header("Content-Type", "text/csv");
    res.header("Content-Disposition", "attachment; filename=users.csv");
    res.send(csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to export users",
      code: "EXPORT_ERROR",
    });
  }
};

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private (Admin only)
exports.getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const studentCount = await User.countDocuments({ role: "student" });
    const adminCount = await User.countDocuments({ role: "admin" });
    const activeCount = await User.countDocuments({ isActive: true });
    const bannedCount = await User.countDocuments({ isBanned: true });

    // Users by department
    const byDepartment = await User.aggregate([
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Users by year
    const byYear = await User.aggregate([
      { $group: { _id: "$yearOfStudy", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        studentCount,
        adminCount,
        activeCount,
        bannedCount,
        byDepartment,
        byYear,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch user stats",
      code: "USER_STATS_ERROR",
    });
  }
};

// @route   GET /api/admin/users/stats
// @desc    Get user statistics for admin dashboard
// @access  Private (Admin only)
exports.getUserStatsForDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const studentCount = await User.countDocuments({ role: "student" });
    const adminCount = await User.countDocuments({ role: "admin" });
    const activeCount = await User.countDocuments({ isActive: true });
    const bannedCount = await User.countDocuments({ isBanned: true });

    // New users in last 7 days
    const newUsersWeek = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });

    // New users in last 30 days
    const newUsersMonth = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });

    res.json({
      success: true,
      data: {
        totalUsers,
        studentCount,
        adminCount,
        activeCount,
        bannedCount,
        newUsersWeek,
        newUsersMonth,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch user statistics",
      error: error.message,
    });
  }
};

// @route   GET /api/admin/papers/stats
// @desc    Get papers statistics for admin dashboard
// @access  Private (Admin only)
exports.getPapersStats = async (req, res) => {
  try {
    const totalPapers = await PastPaper.countDocuments();
    const pendingPapers = await PastPaper.countDocuments({ status: "pending" });
    const approvedPapers = await PastPaper.countDocuments({
      status: "approved",
    });
    const rejectedPapers = await PastPaper.countDocuments({
      status: "rejected",
    });

    const totalDownloads = await PastPaper.aggregate([
      { $group: { _id: null, total: { $sum: "$downloads" } } },
    ]);

    // Papers added in last 7 days
    const newPapersWeek = await PastPaper.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });

    // Papers added in last 30 days
    const newPapersMonth = await PastPaper.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });

    res.json({
      success: true,
      data: {
        totalPapers,
        pendingPapers,
        approvedPapers,
        rejectedPapers,
        totalDownloads: totalDownloads[0]?.total || 0,
        newPapersWeek,
        newPapersMonth,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch papers statistics",
      error: error.message,
    });
  }
};

// @route   GET /api/admin/qa/stats
// @desc    Get Q&A statistics for admin dashboard
// @access  Private (Admin only)
exports.getQaStats = async (req, res) => {
  try {
    const totalQuestions = await Question.countDocuments();
    const featuredQuestions = await Question.countDocuments({
      isFeatured: true,
    });

    const totalAnswers = await Question.aggregate([
      { $unwind: "$answers" },
      { $count: "total" },
    ]);

    // Questions in last 7 days
    const newQuestionsWeek = await Question.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });

    // Questions in last 30 days
    const newQuestionsMonth = await Question.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });

    // Unanswered questions
    const unansweredQuestions = await Question.countDocuments({
      answersCount: 0,
    });

    res.json({
      success: true,
      data: {
        totalQuestions,
        featuredQuestions,
        totalAnswers: totalAnswers[0]?.total || 0,
        newQuestionsWeek,
        newQuestionsMonth,
        unansweredQuestions,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch Q&A statistics",
      error: error.message,
    });
  }
};

// @route   GET /api/admin/downloads/stats
// @desc    Get downloads statistics for admin dashboard
// @access  Private (Admin only)
exports.getDownloadsStats = async (req, res) => {
  try {
    const totalDownloads = await PastPaper.aggregate([
      { $group: { _id: null, total: { $sum: "$downloads" } } },
    ]);

    // Downloads in last 7 days (approximation - count papers with recent download activity)
    const downloadsWeek = await PastPaper.aggregate([
      {
        $match: {
          updatedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      },
      { $group: { _id: null, total: { $sum: "$downloads" } } },
    ]);

    // Downloads in last 30 days
    const downloadsMonth = await PastPaper.aggregate([
      {
        $match: {
          updatedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      { $group: { _id: null, total: { $sum: "$downloads" } } },
    ]);

    // Top 5 most downloaded papers
    const topPapers = await PastPaper.find()
      .sort({ downloads: -1 })
      .limit(5)
      .select("title courseCode downloads");

    res.json({
      success: true,
      data: {
        totalDownloads: totalDownloads[0]?.total || 0,
        downloadsWeek: downloadsWeek[0]?.total || 0,
        downloadsMonth: downloadsMonth[0]?.total || 0,
        topPapers,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch downloads statistics",
      error: error.message,
    });
  }
};

// @route   GET /api/admin/announcements/stats
// @desc    Get announcements statistics for admin dashboard
// @access  Private (Admin only)
exports.getAnnouncementsStats = async (req, res) => {
  try {
    const totalAnnouncements = await Announcement.countDocuments();
    const activeAnnouncements = await Announcement.countDocuments({
      isActive: true,
    });
    const pinnedAnnouncements = await Announcement.countDocuments({
      isPinned: true,
    });

    // Announcements by category
    const byCategory = await Announcement.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);

    // Total views
    const totalViews = await Announcement.aggregate([
      { $group: { _id: null, total: { $sum: "$viewCount" } } },
    ]);

    res.json({
      success: true,
      data: {
        totalAnnouncements,
        activeAnnouncements,
        pinnedAnnouncements,
        byCategory,
        totalViews: totalViews[0]?.total || 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch announcements statistics",
      error: error.message,
    });
  }
};

// @route   GET /api/admin/courses/stats
// @desc    Get courses statistics for admin dashboard
// @access  Private (Admin only)
exports.getCoursesStats = async (req, res) => {
  try {
    const totalCourses = await Course.countDocuments();
    const activeCourses = await Course.countDocuments({ isActive: true });

    // Courses with papers count
    const coursesWithPapers = await PastPaper.aggregate([
      { $group: { _id: "$courseCode", count: { $sum: 1 } } },
    ]);

    // Top 5 courses by papers count
    const topCourses = await PastPaper.aggregate([
      { $group: { _id: "$courseCode", paperCount: { $sum: 1 } } },
      { $sort: { paperCount: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      success: true,
      data: {
        totalCourses,
        activeCourses,
        coursesWithPapers: coursesWithPapers.length,
        topCourses,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch courses statistics",
      error: error.message,
    });
  }
};

// @route   GET /api/admin/activity/recent
// @desc    Get recent activity across the platform
// @access  Private (Admin only)
exports.getRecentActivity = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    // Get recent users
    const recentUsers = await User.find()
      .select("firstName lastName email createdAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Get recent papers
    const recentPapers = await PastPaper.find()
      .select("title courseCode uploadedBy createdAt")
      .populate("uploadedBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Get recent questions
    const recentQuestions = await Question.find()
      .select("title subject userId createdAt")
      .populate("userId", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Combine and sort all activities
    const activities = [
      ...recentUsers.map((u) => ({
        type: "user",
        action: "New user registered",
        user: `${u.firstName} ${u.lastName}`,
        email: u.email,
        timestamp: u.createdAt,
      })),
      ...recentPapers.map((p) => ({
        type: "paper",
        action: "Paper uploaded",
        title: p.title,
        course: p.courseCode,
        user: p.uploadedBy
          ? `${p.uploadedBy.firstName} ${p.uploadedBy.lastName}`
          : "Unknown",
        timestamp: p.createdAt,
      })),
      ...recentQuestions.map((q) => ({
        type: "question",
        action: "Question asked",
        title: q.title,
        subject: q.subject,
        user: q.userId
          ? `${q.userId.firstName} ${q.userId.lastName}`
          : "Unknown",
        timestamp: q.createdAt,
      })),
    ];

    // Sort by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const recentActivities = activities.slice(0, limit);

    res.json({
      success: true,
      data: recentActivities,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent activity",
      error: error.message,
    });
  }
};
