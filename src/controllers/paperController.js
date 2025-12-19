const PastPaper = require("../models/PastPaper");
const path = require("path");
const fs = require("fs");
const {
  uploadFile: uploadToSupabase,
  deleteFile: deleteFromSupabase,
  isSupabaseConfigured,
} = require("../services/supabaseStorage");

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

    let fileUrl;
    let storagePath;

    // Use Supabase if configured, otherwise use local storage
    if (isSupabaseConfigured()) {
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const { url, path: uploadPath } = await uploadToSupabase(
          fileBuffer,
          req.file.originalname,
          "papers",
          "papers"
        );
        fileUrl = url;
        storagePath = uploadPath;

        // Delete temp file after upload
        fs.unlinkSync(req.file.path);
      } catch (error) {
        // Fallback to local storage if Supabase fails
        console.error("Supabase upload failed, using local storage:", error);
        fileUrl = `${req.protocol}://${req.get("host")}/uploads/papers/${
          req.file.filename
        }`;
        storagePath = req.file.path;
      }
    } else {
      // Use local storage
      fileUrl = `${req.protocol}://${req.get("host")}/uploads/papers/${
        req.file.filename
      }`;
      storagePath = req.file.path;
    }

    const paper = await PastPaper.create({
      department,
      course,
      year: parseInt(year),
      fileName: req.file.originalname,
      fileUrl,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
      storagePath, // Store path for deletion
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
    if (isSupabaseConfigured() && paper.storagePath) {
      // Delete from Supabase
      await deleteFromSupabase(paper.storagePath, "papers");
    } else {
      // Delete from local storage
      const filePath = path.join(
        __dirname,
        "../../uploads/papers",
        path.basename(paper.fileUrl)
      );
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
      success: false,
      error: "Failed to fetch paper stats",
      code: "STATS_ERROR",
    });
  }
};

// @route   POST /api/papers/bulk-upload
// @desc    Bulk upload multiple papers at once
// @access  Private (Admin only)
exports.bulkUploadPapers = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload at least one PDF file",
      });
    }

    const { title, department, year, description } = req.body;

    if (!title || !department || !year) {
      // Delete uploaded files if validation fails
      req.files.forEach((file) => fs.unlinkSync(file.path));
      return res.status(400).json({
        success: false,
        message: "Title, department, and year are required",
      });
    }

    const uploadedPapers = [];
    const errors = [];

    // Process each uploaded file
    for (const file of req.files) {
      try {
        let fileUrl;
        let storagePath;

        // Use Supabase if configured
        if (isSupabaseConfigured()) {
          try {
            const fileBuffer = fs.readFileSync(file.path);
            const { url, path: uploadPath } = await uploadToSupabase(
              fileBuffer,
              file.originalname,
              "papers",
              "papers"
            );
            fileUrl = url;
            storagePath = uploadPath;

            // Delete temp file
            fs.unlinkSync(file.path);
          } catch (uploadError) {
            // Fallback to local storage
            console.error(
              "Supabase upload failed, using local storage:",
              uploadError
            );
            fileUrl = `${req.protocol}://${req.get("host")}/uploads/papers/${
              file.filename
            }`;
            storagePath = file.path;
          }
        } else {
          fileUrl = `${req.protocol}://${req.get("host")}/uploads/papers/${
            file.filename
          }`;
          storagePath = file.path;
        }

        const paper = await PastPaper.create({
          course: title, // Using title as course name
          department,
          year: parseInt(year),
          description: description || "",
          fileName: file.originalname,
          fileUrl,
          fileSize: file.size,
          uploadedBy: req.user._id,
          storagePath,
        });

        uploadedPapers.push(paper);
      } catch (error) {
        errors.push({
          fileName: file.originalname,
          error: error.message,
        });
        // Don't delete the file, keep it for debugging
      }
    }

    if (uploadedPapers.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to upload any papers",
        errors,
      });
    }

    res.status(201).json({
      success: true,
      message: `${uploadedPapers.length} paper(s) uploaded successfully`,
      data: {
        uploadedPapers,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    // Delete uploaded files on error
    if (req.files) {
      req.files.forEach((file) => {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          // Ignore cleanup errors
        }
      });
    }
    res.status(500).json({
      success: false,
      message: "Bulk upload failed",
      error: error.message,
    });
  }
};

// @route   GET /api/papers/departments
// @desc    Get all departments with papers
// @access  Public
exports.getDepartments = async (req, res) => {
  try {
    const departments = await PastPaper.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          department: "$_id",
          paperCount: "$count",
        },
      },
    ]);

    res.json({
      success: true,
      data: departments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch departments",
      error: error.message,
    });
  }
};

// @route   GET /api/papers/years/:department
// @desc    Get available years for a department
// @access  Public
exports.getYearsByDepartment = async (req, res) => {
  try {
    const { department } = req.params;

    const years = await PastPaper.aggregate([
      { $match: { department, status: "approved" } },
      { $group: { _id: "$year", count: { $sum: 1 } } },
      { $sort: { _id: -1 } }, // Most recent first
      {
        $project: {
          _id: 0,
          year: "$_id",
          paperCount: "$count",
        },
      },
    ]);

    res.json({
      success: true,
      data: years,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch years",
      error: error.message,
    });
  }
};

// @route   GET /api/papers/titles/:department/:year
// @desc    Get paper titles (courses) for a department and year
// @access  Public
exports.getTitlesByDepartmentAndYear = async (req, res) => {
  try {
    const { department, year } = req.params;

    const papers = await PastPaper.find({
      department,
      year: parseInt(year),
      status: "approved",
    })
      .select("course fileName fileUrl downloads createdAt _id")
      .sort({ course: 1 });

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
