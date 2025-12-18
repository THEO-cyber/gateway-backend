const PastPaper = require("../models/PastPaper");
const path = require("path");
const fs = require("fs");

// @route   GET /api/papers
// @desc    Get all past papers with filters
// @access  Private
exports.getPapers = async (req, res) => {
  try {
    const { department, course, year, page = 1, limit = 20 } = req.query;

    const query = {};
    if (department) query.department = department;
    if (course) query.course = course;
    if (year) query.year = parseInt(year);

    const papers = await PastPaper.find(query)
      .sort({ year: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate("uploadedBy", "email");

    const total = await PastPaper.countDocuments(query);

    res.json({
      success: true,
      data: {
        papers,
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

// @route   POST /api/papers/upload
// @desc    Upload a past paper
// @access  Private
exports.uploadPaper = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a PDF file",
      });
    }

    const { department, course, year } = req.body;

    if (!department || !course || !year) {
      // Delete uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Department, course, and year are required",
      });
    }

    // Create file URL
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/papers/${
      req.file.filename
    }`;

    const paper = await PastPaper.create({
      department,
      course,
      year: parseInt(year),
      fileName: req.file.originalname,
      fileUrl,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Paper uploaded successfully",
      data: paper,
    });
  } catch (error) {
    // Delete uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: "Upload failed",
      error: error.message,
    });
  }
};

// @route   GET /api/papers/years/:course
// @desc    Get available years for a course
// @access  Private
exports.getAvailableYears = async (req, res) => {
  try {
    const { course } = req.params;

    const years = await PastPaper.distinct("year", { course });

    res.json({
      success: true,
      data: years.sort((a, b) => b - a),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @route   GET /api/papers/download/:id
// @desc    Download a paper (increment download count)
// @access  Private
exports.downloadPaper = async (req, res) => {
  try {
    const paper = await PastPaper.findById(req.params.id);

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: "Paper not found",
      });
    }

    // Increment download count
    paper.downloads += 1;
    await paper.save();

    res.json({
      success: true,
      data: {
        fileUrl: paper.fileUrl,
        fileName: paper.fileName,
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

// @route   DELETE /api/papers/:id
// @desc    Delete a paper
// @access  Private (Admin or uploader)
exports.deletePaper = async (req, res) => {
  try {
    const paper = await PastPaper.findById(req.params.id);

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: "Paper not found",
      });
    }

    // Check if user is the uploader (you can add admin check here)
    if (paper.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this paper",
      });
    }

    // Delete file from storage
    const filePath = path.join(
      __dirname,
      "../../uploads/papers",
      path.basename(paper.fileUrl)
    );
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await paper.deleteOne();

    res.json({
      success: true,
      message: "Paper deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @route   GET /api/papers/search
// @desc    Search papers
// @access  Private
exports.searchPapers = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const papers = await PastPaper.find({
      $or: [
        { department: { $regex: q, $options: "i" } },
        { course: { $regex: q, $options: "i" } },
        { fileName: { $regex: q, $options: "i" } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: papers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @route   PUT /api/papers/:id/approve
// @desc    Approve paper
// @access  Private (Admin only)
exports.approvePaper = async (req, res) => {
  try {
    const paper = await PastPaper.findById(req.params.id);
    if (!paper) {
      return res
        .status(404)
        .json({ success: false, error: "Paper not found", code: "NOT_FOUND" });
    }

    paper.status = "approved";
    paper.approvedBy = req.user._id;
    await paper.save();

    res.json({
      success: true,
      message: "Paper approved successfully",
      data: paper,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to approve paper",
        code: "APPROVE_ERROR",
      });
  }
};

// @route   PUT /api/papers/:id/reject
// @desc    Reject paper
// @access  Private (Admin only)
exports.rejectPaper = async (req, res) => {
  try {
    const { reason } = req.body;
    const paper = await PastPaper.findById(req.params.id);
    if (!paper) {
      return res
        .status(404)
        .json({ success: false, error: "Paper not found", code: "NOT_FOUND" });
    }

    paper.status = "rejected";
    paper.rejectionReason = reason;
    await paper.save();

    res.json({ success: true, message: "Paper rejected", data: paper });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to reject paper",
        code: "REJECT_ERROR",
      });
  }
};

// @route   GET /api/papers/stats
// @desc    Get paper statistics
// @access  Private (Admin only)
exports.getPaperStats = async (req, res) => {
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

    const byDepartment = await PastPaper.aggregate([
      {
        $group: {
          _id: "$department",
          count: { $sum: 1 },
          downloads: { $sum: "$downloads" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const byYear = await PastPaper.aggregate([
      { $group: { _id: "$year", count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        totalPapers,
        pendingPapers,
        approvedPapers,
        rejectedPapers,
        totalDownloads: totalDownloads[0]?.total || 0,
        byDepartment,
        byYear,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch paper stats",
        code: "STATS_ERROR",
      });
  }
};

// @route   POST /api/papers/bulk-upload
// @desc    Bulk upload papers (placeholder)
// @access  Private (Admin only)
exports.bulkUploadPapers = async (req, res) => {
  res.status(501).json({
    success: false,
    error: "Bulk upload not implemented yet. Upload papers one at a time.",
    code: "NOT_IMPLEMENTED",
  });
};
