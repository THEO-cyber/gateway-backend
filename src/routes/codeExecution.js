const express = require("express");
const axios = require("axios");
require("dotenv").config();

const router = express.Router();

// POST /api/execute
router.post("/execute", async (req, res) => {
  const { code, language, input } = req.body;
  const clientId = process.env.JDOODLE_CLIENT_ID;
  const clientSecret = process.env.JDOODLE_CLIENT_SECRET;

  if (!code || !language) {
    return res.status(400).json({ error: "Code and language are required." });
  }

  try {
    const response = await axios.post("https://api.jdoodle.com/v1/execute", {
      script: code,
      language,
      versionIndex: getVersionIndex(language),
      stdin: input || "",
      clientId,
      clientSecret,
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// Helper to map language to JDoodle versionIndex
function getVersionIndex(language) {
  const map = {
    java: "4", // Java 8
    c: "5", // C (gcc 5.3.1)
    cpp: "5", // C++ (g++ 5.3.1)
    // Add more as needed
  };
  return map[language] || "0";
}

module.exports = router;
