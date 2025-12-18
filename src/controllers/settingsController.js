const Settings = require("../models/Settings");
const EmailTemplate = require("../models/EmailTemplate");
const ApiKey = require("../models/ApiKey");
const Backup = require("../models/Backup");
const User = require("../models/User");
const crypto = require("crypto");

// GENERAL SETTINGS

exports.getGeneralSettings = async (req, res) => {
  try {
    const settings = await Settings.find({ category: "general" }).lean();

    // Convert array to object for easier access
    const settingsObj = {};
    settings.forEach((s) => {
      settingsObj[s.key] = s.value;
    });

    // Default settings if not found
    const defaults = {
      siteName: "HND Gateway",
      siteDescription: "Educational platform for HND students",
      adminEmail: "admin@hndgateway.com",
      maxUploadSize: 10485760, // 10MB
      allowRegistration: true,
      maintenanceMode: false,
    };

    res.json({
      success: true,
      data: { ...defaults, ...settingsObj },
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch settings",
        code: "FETCH_ERROR",
      });
  }
};

exports.updateGeneralSettings = async (req, res) => {
  try {
    const updates = req.body;
    const updatedSettings = [];

    for (const [key, value] of Object.entries(updates)) {
      const setting = await Settings.findOneAndUpdate(
        { key, category: "general" },
        { value, updatedBy: req.user._id, updatedAt: Date.now() },
        { new: true, upsert: true, runValidators: true }
      );
      updatedSettings.push(setting);
    }

    res.json({
      success: true,
      message: "Settings updated successfully",
      data: updatedSettings,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to update settings",
        code: "UPDATE_ERROR",
      });
  }
};

// EMAIL TEMPLATES

exports.getEmailTemplates = async (req, res) => {
  try {
    const templates = await EmailTemplate.find().sort({ name: 1 });
    res.json({ success: true, data: templates });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch templates",
        code: "FETCH_ERROR",
      });
  }
};

exports.updateEmailTemplate = async (req, res) => {
  try {
    const { name } = req.params;
    const { subject, body, variables, isActive } = req.body;

    const template = await EmailTemplate.findOneAndUpdate(
      { name },
      {
        subject,
        body,
        variables,
        isActive,
        updatedBy: req.user._id,
        updatedAt: Date.now(),
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      success: true,
      message: "Template updated successfully",
      data: template,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to update template",
        code: "UPDATE_ERROR",
      });
  }
};

// API KEYS

exports.getApiKeys = async (req, res) => {
  try {
    const apiKeys = await ApiKey.find()
      .select("-key") // Don't expose full keys
      .populate("createdBy", "email firstName lastName")
      .sort({ createdAt: -1 });

    // Mask keys for security
    const maskedKeys = apiKeys.map((k) => ({
      ...k.toObject(),
      keyPreview: "***" + k.key.slice(-4),
    }));

    res.json({ success: true, data: maskedKeys });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch API keys",
        code: "FETCH_ERROR",
      });
  }
};

exports.createApiKey = async (req, res) => {
  try {
    const { name, service, key } = req.body;

    if (!name || !service || !key) {
      return res.status(400).json({
        success: false,
        error: "Name, service, and key are required",
        code: "INVALID_INPUT",
      });
    }

    const apiKey = await ApiKey.create({
      name,
      service,
      key,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "API key created successfully",
      data: {
        id: apiKey._id,
        name: apiKey.name,
        service: apiKey.service,
        keyPreview: "***" + key.slice(-4),
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({
          success: false,
          error: "API key already exists",
          code: "DUPLICATE_ERROR",
        });
    }
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to create API key",
        code: "CREATE_ERROR",
      });
  }
};

exports.deleteApiKey = async (req, res) => {
  try {
    const apiKey = await ApiKey.findByIdAndDelete(req.params.id);

    if (!apiKey) {
      return res
        .status(404)
        .json({
          success: false,
          error: "API key not found",
          code: "NOT_FOUND",
        });
    }

    res.json({ success: true, message: "API key deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to delete API key",
        code: "DELETE_ERROR",
      });
  }
};

// ADMIN USERS

exports.getAdminUsers = async (req, res) => {
  try {
    const admins = await User.find({ role: "admin" })
      .select("-password -resetPasswordOTP -resetPasswordExpire")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: admins });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch admin users",
        code: "FETCH_ERROR",
      });
  }
};

exports.createAdminUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
        code: "INVALID_INPUT",
      });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        error: "User already exists",
        code: "DUPLICATE_ERROR",
      });
    }

    const bcrypt = require("bcryptjs");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const admin = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: "admin",
    });

    res.status(201).json({
      success: true,
      message: "Admin user created successfully",
      data: {
        id: admin._id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to create admin user",
        code: "CREATE_ERROR",
      });
  }
};

exports.updateAdminUser = async (req, res) => {
  try {
    const { firstName, lastName, isActive } = req.body;

    const admin = await User.findById(req.params.id);

    if (!admin || admin.role !== "admin") {
      return res
        .status(404)
        .json({
          success: false,
          error: "Admin user not found",
          code: "NOT_FOUND",
        });
    }

    if (firstName) admin.firstName = firstName;
    if (lastName) admin.lastName = lastName;
    if (isActive !== undefined) admin.isActive = isActive;

    await admin.save();

    res.json({
      success: true,
      message: "Admin user updated successfully",
      data: admin,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to update admin user",
        code: "UPDATE_ERROR",
      });
  }
};

exports.deleteAdminUser = async (req, res) => {
  try {
    const admin = await User.findById(req.params.id);

    if (!admin || admin.role !== "admin") {
      return res
        .status(404)
        .json({
          success: false,
          error: "Admin user not found",
          code: "NOT_FOUND",
        });
    }

    // Prevent deleting yourself
    if (admin._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete your own admin account",
        code: "INVALID_OPERATION",
      });
    }

    await admin.deleteOne();

    res.json({ success: true, message: "Admin user deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to delete admin user",
        code: "DELETE_ERROR",
      });
  }
};

// SECURITY SETTINGS

exports.getSecuritySettings = async (req, res) => {
  try {
    const settings = await Settings.find({ category: "security" }).lean();

    const settingsObj = {};
    settings.forEach((s) => {
      settingsObj[s.key] = s.value;
    });

    const defaults = {
      passwordMinLength: 8,
      requireSpecialChar: true,
      requireNumber: true,
      requireUppercase: true,
      sessionTimeout: 7200, // 2 hours in seconds
      maxLoginAttempts: 5,
      lockoutDuration: 1800, // 30 minutes
      twoFactorEnabled: false,
    };

    res.json({ success: true, data: { ...defaults, ...settingsObj } });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch security settings",
        code: "FETCH_ERROR",
      });
  }
};

exports.updateSecuritySettings = async (req, res) => {
  try {
    const updates = req.body;
    const updatedSettings = [];

    for (const [key, value] of Object.entries(updates)) {
      const setting = await Settings.findOneAndUpdate(
        { key, category: "security" },
        { value, updatedBy: req.user._id, updatedAt: Date.now() },
        { new: true, upsert: true, runValidators: true }
      );
      updatedSettings.push(setting);
    }

    res.json({
      success: true,
      message: "Security settings updated successfully",
      data: updatedSettings,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to update security settings",
        code: "UPDATE_ERROR",
      });
  }
};

// BACKUPS

exports.getBackups = async (req, res) => {
  try {
    const backups = await Backup.find()
      .populate("createdBy", "email firstName lastName")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, data: backups });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch backups",
        code: "FETCH_ERROR",
      });
  }
};

exports.createBackup = async (req, res) => {
  try {
    // This is a placeholder - actual backup logic would export database
    const fileName = `backup_${Date.now()}.json`;
    const backup = await Backup.create({
      fileName,
      fileSize: 0,
      fileUrl: `/backups/${fileName}`,
      type: "manual",
      status: "completed",
      collections: ["users", "pastpapers", "questions", "announcements"],
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Backup created successfully",
      data: backup,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to create backup",
        code: "CREATE_ERROR",
      });
  }
};

exports.downloadBackup = async (req, res) => {
  try {
    const backup = await Backup.findById(req.params.id);

    if (!backup) {
      return res
        .status(404)
        .json({ success: false, error: "Backup not found", code: "NOT_FOUND" });
    }

    // In production, this would stream the actual backup file
    res.json({
      success: true,
      message: "Backup download not implemented yet",
      data: {
        fileName: backup.fileName,
        downloadUrl: backup.fileUrl,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to download backup",
        code: "DOWNLOAD_ERROR",
      });
  }
};

exports.deleteBackup = async (req, res) => {
  try {
    const backup = await Backup.findByIdAndDelete(req.params.id);

    if (!backup) {
      return res
        .status(404)
        .json({ success: false, error: "Backup not found", code: "NOT_FOUND" });
    }

    // In production, delete the actual backup file from storage
    res.json({ success: true, message: "Backup deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to delete backup",
        code: "DELETE_ERROR",
      });
  }
};

module.exports = exports;
