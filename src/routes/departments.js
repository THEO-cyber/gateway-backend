const express = require("express");
const router = express.Router();
const Department = require("../models/Department");

// @route   GET /api/departments
// @desc    Get departments (public, for students)
// @access  Public
router.get("/", async (req, res) => {
  try {
    const { name } = req.query;

    const query = { isActive: true };

    if (name) {
      query.name = { $regex: name, $options: "i" };
    }

    const departments = await Department.find(query)
      .select("name code description isActive")
      .sort({ name: 1 });

    // Count students and papers per department
    const User = require("../models/User");
    const PastPaper = require("../models/PastPaper");

    const departmentsWithCounts = await Promise.all(
      departments.map(async (dept) => {
        const studentCount = await User.countDocuments({
          department: dept.name,
          role: "student",
        });

        const paperCount = await PastPaper.countDocuments({
          department: dept.name,
          status: "approved",
        });

        return {
          _id: dept._id,
          name: dept.name,
          code: dept.code,
          description: dept.description,
          courseCode: dept.code,
          isActive: dept.isActive,
          studentCount,
          paperCount,
        };
      })
    );

    res.json({
      success: true,
      data: departmentsWithCounts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch departments",
      error: error.message,
    });
  }
});

module.exports = router;
