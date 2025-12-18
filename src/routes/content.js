const express = require("express");
const router = express.Router();
const {
  getAllDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getAllCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getAllSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getAllTags,
  createTag,
  deleteTag,
} = require("../controllers/contentController");
const { protect } = require("../middleware/auth");
const { isAdmin } = require("../middleware/adminAuth");

// All content management routes require admin authentication
router.use(protect);
router.use(isAdmin);

// Departments
router.route("/departments").get(getAllDepartments).post(createDepartment);
router.route("/departments/:id").put(updateDepartment).delete(deleteDepartment);

// Courses
router.route("/courses").get(getAllCourses).post(createCourse);
router.route("/courses/:id").put(updateCourse).delete(deleteCourse);

// Subjects
router.route("/subjects").get(getAllSubjects).post(createSubject);
router.route("/subjects/:id").put(updateSubject).delete(deleteSubject);

// Tags
router.route("/tags").get(getAllTags).post(createTag);
router.route("/tags/:id").delete(deleteTag);

module.exports = router;
