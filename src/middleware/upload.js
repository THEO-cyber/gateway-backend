const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Debug: log incoming request and file info
    console.log("[MULTER][DEBUG] --- FILE UPLOAD ATTEMPT ---");
    console.log(
      `[MULTER][DEBUG] Request path: ${req.path}, method: ${req.method}`
    );
    console.log(
      `[MULTER][DEBUG] Incoming fieldname: '${file.fieldname}', originalname: '${file.originalname}', mimetype: '${file.mimetype}'`
    );
    if (req.body && Object.keys(req.body).length > 0) {
      console.log("[MULTER][DEBUG] Other form fields:", req.body);
    } else {
      console.log("[MULTER][DEBUG] No other form fields detected.");
    }
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
  // Debug: log fileFilter check
  console.log(
    `[MULTER][DEBUG] fileFilter: fieldname='${file.fieldname}', mimetype='${file.mimetype}'`
  );
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
