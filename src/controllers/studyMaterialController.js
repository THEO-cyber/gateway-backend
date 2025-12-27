// @route   POST /api/study-materials/:id/download
// @desc    Track a download for a study material
// @access  Public or Private (as needed)
exports.trackDownload = async (req, res) => {
  try {
    const material = await StudyMaterial.findById(req.params.id);
    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Study material not found",
      });
    }
    material.downloads = (material.downloads || 0) + 1;
    await material.save();
    res.json({
      success: true,
      message: "Download tracked",
      downloads: material.downloads,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to track download",
      error: error.message,
    });
  }
};
const StudyMaterial = require("../models/StudyMaterial");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const {
  uploadFile: uploadToSupabase,
  deleteFile: deleteFromSupabase,
  isSupabaseConfigured,
} = require("../services/supabaseStorage");

// @route   POST /api/study-materials
// @desc    Upload study material (PDF, video, or link)
// @access  Private (Admin only)
exports.createStudyMaterial = async (req, res) => {
  try {
    const { title, type, department, description, url } = req.body;

    if (!title || !type || !department) {
      return res.status(400).json({
        success: false,
        message: "Title, type, and department are required",
      });
    }

    const materialData = {
      title,
      type,
      department,
      description,
      uploadedBy: req.user?._id || req.user?.id || "admin",
    };

    // Handle different material types
    if (type === "pdf") {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "PDF file is required for pdf type",
        });
      }

      // Use Supabase if configured
      if (isSupabaseConfigured()) {
        try {
          const fileBuffer = fsSync.readFileSync(req.file.path);
          const { url, path: uploadPath } = await uploadToSupabase(
            fileBuffer,
            req.file.originalname,
            process.env.SUPABASE_BUCKET,
            "materials"
          );
          materialData.fileUrl = url;
          materialData.storagePath = uploadPath;

          // Delete temp file
          fsSync.unlinkSync(req.file.path);
        } catch (uploadError) {
          console.error(
            "Supabase upload failed, using local storage:",
            uploadError
          );
          materialData.fileUrl = `/uploads/materials/${req.file.filename}`;
        }
      } else {
        materialData.fileUrl = `/uploads/materials/${req.file.filename}`;
      }

      materialData.fileName = req.file.originalname;
    } else if (type === "video" || type === "link") {
      if (!url) {
        return res.status(400).json({
          success: false,
          message: "URL is required for video/link type",
        });
      }

      materialData.url = url;
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid type. Must be 'pdf', 'video', or 'link'",
      });
    }

    const material = await StudyMaterial.create(materialData);

    res.status(201).json({
      success: true,
      material,
    });
  } catch (error) {
    console.error("Upload error:", error); // Log full error stack
    res.status(500).json({
      success: false,
      message: "Failed to create study material",
      error: error.message,
    });
  }
};

// @route   GET /api/study-materials
// @desc    Get all study materials (with optional filters)
// @access  Public
exports.getAllStudyMaterials = async (req, res) => {
  try {
    const { department, type } = req.query;

    const query = { visible: true };

    if (department) {
      query.department = department;
    }

    if (type) {
      query.type = type;
    }

    const materials = await StudyMaterial.find(query)
      .populate("uploadedBy", "email firstName lastName")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      materials,
      total: materials.length,
    });
  } catch (error) {
    console.error("getAllStudyMaterials error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch study materials",
      error: error.message,
      stack: error.stack,
    });
  }
};

// @route   DELETE /api/study-materials/:id
// @desc    Delete study material
// @access  Private (Admin only)
exports.deleteStudyMaterial = async (req, res) => {
  try {
    const material = await StudyMaterial.findById(req.params.id);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Study material not found",
      });
    }

    // Delete physical file if it exists
    if (material.type === "pdf" && material.fileUrl) {
      try {
        if (isSupabaseConfigured() && material.storagePath) {
          // Delete from Supabase (use correct bucket)
          await deleteFromSupabase(
            material.storagePath,
            process.env.SUPABASE_BUCKET
          );
        } else {
          // Delete from local storage
          const filePath = path.join(__dirname, "../..", material.fileUrl);
          await fs.unlink(filePath);
        }
      } catch (error) {
        console.error("Error deleting file:", error);
        // Continue with database deletion even if file deletion fails
      }
    }

    await StudyMaterial.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Study material deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete study material",
      error: error.message,
    });
  }
};

// @route   PATCH /api/study-materials/:id/toggle-visibility
// @desc    Toggle study material visibility
// @access  Private (Admin only)
exports.toggleVisibility = async (req, res) => {
  try {
    const material = await StudyMaterial.findById(req.params.id);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Study material not found",
      });
    }

    material.visible = !material.visible;
    await material.save();

    res.json({
      success: true,
      material,
      message: `Study material is now ${
        material.visible ? "visible" : "hidden"
      }`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to toggle visibility",
      error: error.message,
    });
  }
};
