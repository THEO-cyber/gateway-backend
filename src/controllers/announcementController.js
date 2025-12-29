const Announcement = require("../models/Announcement");

// @route   GET /api/announcements
// @desc    Get all announcements with filters
// @access  Public
exports.getAllAnnouncements = async (req, res) => {
  try {
    const { category, isActive, department, page = 1, limit = 20 } = req.query;

    const query = {};
    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === "true";

    // Department filter: always show 'all' announcements, plus specialty if specified
    if (department && department !== "all") {
      query.$or = [{ department: "all" }, { department: department }];
    }

    // Check if expired
    const now = new Date();
    if (isActive === "true") {
      query.$or = query.$or || [];
      query.$or.push(
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } }
      );
    }

    const announcements = await Announcement.find(query)
      .populate("createdBy", "email firstName lastName")
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Announcement.countDocuments(query);

    res.json({
      success: true,
      data: announcements,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch announcements",
      code: "FETCH_ERROR",
    });
  }
};

// @route   GET /api/announcements/:id
// @desc    Get announcement by ID
// @access  Public
exports.getAnnouncementById = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id).populate(
      "createdBy",
      "email firstName lastName"
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: "Announcement not found",
        code: "NOT_FOUND",
      });
    }

    // Increment view count if user is authenticated
    if (req.user) {
      if (!announcement.viewedBy.includes(req.user._id)) {
        announcement.viewCount += 1;
        announcement.viewedBy.push(req.user._id);
        await announcement.save();
      }
    }

    res.json({
      success: true,
      data: announcement,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch announcement",
      code: "FETCH_ERROR",
    });
  }
};

// @route   POST /api/announcements
// @desc    Create announcement
// @access  Private (Admin only)
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, message, category, targetAudience, isPinned, expiresAt } =
      req.body;

    const announcement = await Announcement.create({
      title,
      message,
      category,
      targetAudience,
      isPinned,
      expiresAt,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Announcement created successfully",
      data: announcement,
    });
  } catch (error) {
    console.error("Create announcement error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create announcement",
      message: error.message,
      code: "CREATE_ERROR",
    });
  }
};

// @route   PUT /api/announcements/:id
// @desc    Update announcement
// @access  Private (Admin only)
exports.updateAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: "Announcement not found",
        code: "NOT_FOUND",
      });
    }

    res.json({
      success: true,
      message: "Announcement updated successfully",
      data: announcement,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to update announcement",
      code: "UPDATE_ERROR",
    });
  }
};

// @route   DELETE /api/announcements/:id
// @desc    Delete announcement
// @access  Private (Admin only)
exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: "Announcement not found",
        code: "NOT_FOUND",
      });
    }

    res.json({
      success: true,
      message: "Announcement deleted successfully",
    });
  } catch (error) {
    console.error("Delete announcement error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete announcement",
      code: "DELETE_ERROR",
      details: error.message,
      stack: error.stack,
      params: req.params,
    });
  }
};

// @route   PUT /api/announcements/:id/toggle
// @desc    Toggle announcement active status
// @access  Private (Admin only)
exports.toggleAnnouncementStatus = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: "Announcement not found",
        code: "NOT_FOUND",
      });
    }

    announcement.isActive = !announcement.isActive;
    announcement.updatedAt = Date.now();
    await announcement.save();

    res.json({
      success: true,
      message: `Announcement ${
        announcement.isActive ? "activated" : "deactivated"
      }`,
      data: announcement,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to toggle announcement status",
      code: "TOGGLE_ERROR",
    });
  }
};

// @route   GET /api/announcements/:id/analytics
// @desc    Get announcement analytics
// @access  Private (Admin only)
exports.getAnnouncementAnalytics = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id).populate(
      "viewedBy",
      "email firstName lastName role"
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: "Announcement not found",
        code: "NOT_FOUND",
      });
    }

    const analytics = {
      totalViews: announcement.viewCount,
      uniqueViewers: announcement.viewedBy.length,
      viewers: announcement.viewedBy,
      createdAt: announcement.createdAt,
      updatedAt: announcement.updatedAt,
    };

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch announcement analytics",
      code: "ANALYTICS_ERROR",
    });
  }
};

module.exports = exports;
