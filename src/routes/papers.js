const express = require("express");
const router = express.Router();
const {
  getPapers,
  uploadPaper,
  getAvailableYears,
  downloadPaper,
  deletePaper,
  searchPapers,
} = require("../controllers/paperController");
const { protect } = require("../middleware/auth");
const upload = require("../middleware/upload");

// All routes require authentication
router.use(protect);

router.get("/", getPapers);
router.post("/upload", upload.single("file"), uploadPaper);
router.get("/years/:course", getAvailableYears);
router.get("/download/:id", downloadPaper);
router.delete("/:id", deletePaper);
router.get("/search", searchPapers);

module.exports = router;
