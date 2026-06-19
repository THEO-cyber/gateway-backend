const express = require("express");
const axios = require("axios");

const router = express.Router();

// Parse JSON bodies for this route (it runs before app-level express.json())
router.use(express.json({ limit: "1mb" }));

// Normalize language names sent from the Flutter app to JDoodle identifiers
const LANGUAGE_MAP = {
  python:     { lang: "python3",  versionIndex: "3" },
  python3:    { lang: "python3",  versionIndex: "3" },
  python2:    { lang: "python3",  versionIndex: "0" }, // fallback to py3
  java:       { lang: "java",     versionIndex: "4" },
  c:          { lang: "c",        versionIndex: "5" },
  cpp:        { lang: "cpp17",    versionIndex: "0" },
  "c++":      { lang: "cpp17",    versionIndex: "0" },
  cpp17:      { lang: "cpp17",    versionIndex: "0" },
  cpp14:      { lang: "cpp14",    versionIndex: "0" },
  javascript: { lang: "nodejs",   versionIndex: "4" },
  js:         { lang: "nodejs",   versionIndex: "4" },
  nodejs:     { lang: "nodejs",   versionIndex: "4" },
  php:        { lang: "php",      versionIndex: "3" },
  ruby:       { lang: "ruby",     versionIndex: "4" },
  rust:       { lang: "rust",     versionIndex: "4" },
  go:         { lang: "go",       versionIndex: "4" },
  kotlin:     { lang: "kotlin",   versionIndex: "3" },
  swift:      { lang: "swift",    versionIndex: "4" },
  bash:       { lang: "bash",     versionIndex: "4" },
  r:          { lang: "r",        versionIndex: "4" },
  dart:       { lang: "dart",     versionIndex: "3" },
  scala:      { lang: "scala",    versionIndex: "4" },
  csharp:     { lang: "csharp",   versionIndex: "4" },
  "c#":       { lang: "csharp",   versionIndex: "4" },
};

// POST /api/execute
router.post("/execute", async (req, res) => {
  try {
    const { code, language, input } = req.body || {};

    if (!code || !language) {
      return res.status(400).json({ output: "", error: "Code and language are required." });
    }

    const langKey = language.toLowerCase().trim();
    const mapped = LANGUAGE_MAP[langKey];

    if (!mapped) {
      return res.status(400).json({
        output: "",
        error: `Unsupported language: "${language}". Supported: ${Object.keys(LANGUAGE_MAP).filter((k, i, a) => a.indexOf(k) === i).join(", ")}`,
      });
    }

    const response = await axios.post(
      "https://api.jdoodle.com/v1/execute",
      {
        script: code,
        language: mapped.lang,
        versionIndex: mapped.versionIndex,
        stdin: input || "",
        clientId: process.env.JDOODLE_CLIENT_ID,
        clientSecret: process.env.JDOODLE_CLIENT_SECRET,
      },
      { timeout: 30000 }
    );

    res.json(response.data);
  } catch (error) {
    const jdoodleError = error.response?.data;

    // Return errors in the output field so the Flutter UI can display them
    if (jdoodleError) {
      return res.status(200).json({
        output: jdoodleError.error || JSON.stringify(jdoodleError),
        statusCode: jdoodleError.statusCode || 500,
        isExecutionSuccess: false,
      });
    }

    res.status(500).json({
      output: process.env.NODE_ENV !== "production" ? error.message : "Code execution failed",
      isExecutionSuccess: false,
    });
  }
});

module.exports = router;
