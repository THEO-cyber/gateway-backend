const express = require("express");
const router = express.Router();
const {
  getGeneralSettings,
  updateGeneralSettings,
  getEmailTemplates,
  updateEmailTemplate,
  getApiKeys,
  createApiKey,
  deleteApiKey,
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  getSecuritySettings,
  updateSecuritySettings,
  getBackups,
  createBackup,
  downloadBackup,
  deleteBackup,
} = require("../controllers/settingsController");
const { protect } = require("../middleware/auth");
const { isAdmin } = require("../middleware/adminAuth");

// All settings routes require admin authentication
router.use(protect);
router.use(isAdmin);

// General Settings
router.get("/general", getGeneralSettings);
router.put("/general", updateGeneralSettings);

// Email Templates
router.get("/email-templates", getEmailTemplates);
router.put("/email-templates/:name", updateEmailTemplate);

// API Keys
router.get("/api-keys", getApiKeys);
router.post("/api-keys", createApiKey);
router.delete("/api-keys/:id", deleteApiKey);

// Admin Users
router.get("/admins", getAdminUsers);
router.post("/admins", createAdminUser);
router.put("/admins/:id", updateAdminUser);
router.delete("/admins/:id", deleteAdminUser);

// Security Settings
router.get("/security", getSecuritySettings);
router.put("/security", updateSecuritySettings);

// Backups
router.get("/backups", getBackups);
router.post("/backups", createBackup);
router.get("/backups/:id/download", downloadBackup);
router.delete("/backups/:id", deleteBackup);

module.exports = router;
