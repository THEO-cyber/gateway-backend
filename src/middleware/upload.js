const multer = require("multer");
const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine folder based on route or field name
    let folder = "papers"; // default

    if (
      req.path.includes("/study-materials") ||
      file.fieldname === "material"
    ) {
      folder = "materials";
    }

    const uploadPath = path.join(__dirname, `../../uploads/${folder}`);

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Create unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter - only PDFs
const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
  },
  fileFilter: fileFilter,
});

module.exports = upload;
