const Department = require("../models/Department");
const Course = require("../models/Course");
const Subject = require("../models/Subject");
const Tag = require("../models/Tag");

// DEPARTMENTS

exports.getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    res.json({ success: true, data: departments });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch departments",
      code: "FETCH_ERROR",
    });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { name, code, description } = req.body;
    const department = await Department.create({
      name,
      code,
      description,
      createdBy: req.user._id,
    });
    res
      .status(201)
      .json({ success: true, message: "Department created", data: department });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Department already exists",
        code: "DUPLICATE_ERROR",
      });
    }
    res.status(500).json({
      success: false,
      error: "Failed to create department",
      code: "CREATE_ERROR",
    });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!department) {
      return res.status(404).json({
        success: false,
        error: "Department not found",
        code: "NOT_FOUND",
      });
    }
    res.json({
      success: true,
      message: "Department updated",
      data: department,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to update department",
      code: "UPDATE_ERROR",
    });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findByIdAndDelete(req.params.id);
    if (!department) {
      return res.status(404).json({
        success: false,
        error: "Department not found",
        code: "NOT_FOUND",
      });
    }
    res.json({ success: true, message: "Department deleted" });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to delete department",
      code: "DELETE_ERROR",
    });
  }
};

// COURSES

exports.getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find()
      .populate("department", "name code")
      .sort({ name: 1 });
    res.json({ success: true, data: courses });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch courses",
      code: "FETCH_ERROR",
    });
  }
};

exports.createCourse = async (req, res) => {
  try {
    const { name, code, department, description, credits } = req.body;
    const course = await Course.create({
      name,
      code,
      department,
      description,
      credits,
      createdBy: req.user._id,
    });
    res
      .status(201)
      .json({ success: true, message: "Course created", data: course });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Course already exists",
        code: "DUPLICATE_ERROR",
      });
    }
    res.status(500).json({
      success: false,
      error: "Failed to create course",
      code: "CREATE_ERROR",
    });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("department", "name code");
    if (!course) {
      return res
        .status(404)
        .json({ success: false, error: "Course not found", code: "NOT_FOUND" });
    }
    res.json({ success: true, message: "Course updated", data: course });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to update course",
      code: "UPDATE_ERROR",
    });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) {
      return res
        .status(404)
        .json({ success: false, error: "Course not found", code: "NOT_FOUND" });
    }
    res.json({ success: true, message: "Course deleted" });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to delete course",
      code: "DELETE_ERROR",
    });
  }
};

// SUBJECTS

exports.getAllSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find()
      .populate("department", "name code")
      .sort({ name: 1 });
    res.json({ success: true, data: subjects });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch subjects",
      code: "FETCH_ERROR",
    });
  }
};

exports.createSubject = async (req, res) => {
  try {
    const { name, code, department, description } = req.body;
    const subject = await Subject.create({
      name,
      code,
      department,
      description,
      createdBy: req.user._id,
    });
    res
      .status(201)
      .json({ success: true, message: "Subject created", data: subject });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Subject already exists",
        code: "DUPLICATE_ERROR",
      });
    }
    res.status(500).json({
      success: false,
      error: "Failed to create subject",
      code: "CREATE_ERROR",
    });
  }
};

exports.updateSubject = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("department", "name code");
    if (!subject) {
      return res.status(404).json({
        success: false,
        error: "Subject not found",
        code: "NOT_FOUND",
      });
    }
    res.json({ success: true, message: "Subject updated", data: subject });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to update subject",
      code: "UPDATE_ERROR",
    });
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) {
      return res.status(404).json({
        success: false,
        error: "Subject not found",
        code: "NOT_FOUND",
      });
    }
    res.json({ success: true, message: "Subject deleted" });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to delete subject",
      code: "DELETE_ERROR",
    });
  }
};

// TAGS

exports.getAllTags = async (req, res) => {
  try {
    const tags = await Tag.find().sort({ usageCount: -1, name: 1 });
    res.json({ success: true, data: tags });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch tags",
      code: "FETCH_ERROR",
    });
  }
};

exports.createTag = async (req, res) => {
  try {
    const { name } = req.body;
    const tag = await Tag.create({ name });
    res.status(201).json({ success: true, message: "Tag created", data: tag });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Tag already exists",
        code: "DUPLICATE_ERROR",
      });
    }
    res.status(500).json({
      success: false,
      error: "Failed to create tag",
      code: "CREATE_ERROR",
    });
  }
};

exports.deleteTag = async (req, res) => {
  try {
    const tag = await Tag.findByIdAndDelete(req.params.id);
    if (!tag) {
      return res
        .status(404)
        .json({ success: false, error: "Tag not found", code: "NOT_FOUND" });
    }
    res.json({ success: true, message: "Tag deleted" });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to delete tag",
      code: "DELETE_ERROR",
    });
  }
};

module.exports = exports;
