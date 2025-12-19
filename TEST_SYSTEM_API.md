# Test & Quiz System API Documentation

This document outlines all endpoints for the test/quiz system including tests, enrollments, submissions, results, and study materials.

## Base URL

- Production: `https://gateway-backend-qfjh.onrender.com/api`
- Development: `http://localhost:5000/api`

---

## 1. TEST MANAGEMENT (Admin)

### 1.1 Create Test

**POST** `/tests`

**Auth Required:** Yes (Admin only)

**Request Body:**

```json
{
  "title": "Midterm Exam - Engineering Mathematics",
  "department": "Engineering",
  "date": "2024-02-15",
  "time": "10:00",
  "duration": 120,
  "passingPercentage": 50,
  "description": "Covers topics from week 1-8",
  "status": "draft"
}
```

**Response:**

```json
{
  "success": true,
  "test": {
    "_id": "test123",
    "title": "Midterm Exam - Engineering Mathematics",
    "department": "Engineering",
    "date": "2024-02-15T00:00:00.000Z",
    "time": "10:00",
    "duration": 120,
    "passingPercentage": 50,
    "description": "Covers topics from week 1-8",
    "status": "draft",
    "questions": [],
    "createdBy": "admin123",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

---

### 1.2 Get All Tests

**GET** `/tests`

**Auth Required:** No

**Query Parameters:**

- `department` (optional): Filter by department
- `status` (optional): Filter by status (draft/scheduled/active/completed)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Example:** `/tests?department=Engineering&status=active&page=1&limit=10`

**Response:**

```json
{
  "success": true,
  "tests": [
    {
      "_id": "test123",
      "title": "Midterm Exam - Engineering Mathematics",
      "department": "Engineering",
      "date": "2024-02-15T00:00:00.000Z",
      "time": "10:00",
      "duration": 120,
      "status": "active",
      "createdBy": {
        "_id": "admin123",
        "firstName": "John",
        "lastName": "Admin"
      }
    }
  ],
  "total": 1,
  "page": 1,
  "pages": 1
}
```

---

### 1.3 Get Test by ID

**GET** `/tests/:id`

**Auth Required:** No

**Response:**

```json
{
  "success": true,
  "test": {
    "_id": "test123",
    "title": "Midterm Exam - Engineering Mathematics",
    "department": "Engineering",
    "date": "2024-02-15T00:00:00.000Z",
    "time": "10:00",
    "duration": 120,
    "passingPercentage": 50,
    "description": "Covers topics from week 1-8",
    "status": "active",
    "questions": [],
    "createdBy": {
      "_id": "admin123",
      "firstName": "John",
      "lastName": "Admin"
    }
  }
}
```

---

### 1.4 Update Test

**PUT** `/tests/:id`

**Auth Required:** Yes (Admin only)

**Request Body:**

```json
{
  "status": "completed",
  "description": "Updated description"
}
```

**Response:**

```json
{
  "success": true,
  "test": {
    "_id": "test123",
    "status": "completed",
    "completedAt": "2024-02-15T14:00:00.000Z"
  }
}
```

---

### 1.5 Delete Test

**DELETE** `/tests/:id`

**Auth Required:** Yes (Admin only)

**Response:**

```json
{
  "success": true,
  "message": "Test and all related enrollments/submissions deleted successfully"
}
```

---

### 1.6 Add Questions to Test

**POST** `/tests/:id/questions`

**Auth Required:** Yes (Admin only)

**Request Body:**

```json
{
  "questions": [
    {
      "question": "What is the derivative of x²?",
      "options": {
        "A": "x",
        "B": "2x",
        "C": "x³",
        "D": "2"
      },
      "correctAnswer": "B"
    },
    {
      "question": "What is the integral of 1/x?",
      "options": {
        "A": "x²",
        "B": "ln(x)",
        "C": "1/x²",
        "D": "e^x"
      },
      "correctAnswer": "B"
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "test": {
    "_id": "test123",
    "questions": [
      {
        "question": "What is the derivative of x²?",
        "options": {
          "A": "x",
          "B": "2x",
          "C": "x³",
          "D": "2"
        },
        "correctAnswer": "B"
      },
      {
        "question": "What is the integral of 1/x?",
        "options": {
          "A": "x²",
          "B": "ln(x)",
          "C": "1/x²",
          "D": "e^x"
        },
        "correctAnswer": "B"
      }
    ]
  },
  "addedCount": 2
}
```

---

### 1.7 Get Test Questions (Student View)

**GET** `/tests/:id/questions`

**Auth Required:** No

**Response:**

```json
{
  "success": true,
  "questions": [
    {
      "question": "What is the derivative of x²?",
      "options": {
        "A": "x",
        "B": "2x",
        "C": "x³",
        "D": "2"
      }
    },
    {
      "question": "What is the integral of 1/x?",
      "options": {
        "A": "x²",
        "B": "ln(x)",
        "C": "1/x²",
        "D": "e^x"
      }
    }
  ]
}
```

> **Note:** This endpoint does NOT include `correctAnswer` field.

---

## 2. ENROLLMENT

### 2.1 Enroll in Test

**POST** `/tests/:id/enroll`

**Auth Required:** No

**Request Body:**

```json
{
  "studentEmail": "student@example.com",
  "studentName": "John Doe"
}
```

**Response:**

```json
{
  "success": true,
  "enrollment": {
    "_id": "enroll123",
    "testId": "test123",
    "studentEmail": "student@example.com",
    "studentName": "John Doe",
    "enrolledAt": "2024-02-10T10:00:00.000Z",
    "submitted": false
  }
}
```

**Error (Already Enrolled):**

```json
{
  "success": false,
  "message": "Already enrolled in this test"
}
```

---

### 2.2 Get Test Enrollments (Admin)

**GET** `/tests/:id/enrollments`

**Auth Required:** Yes (Admin only)

**Response:**

```json
{
  "success": true,
  "enrollments": [
    {
      "_id": "enroll123",
      "testId": "test123",
      "studentEmail": "student1@example.com",
      "studentName": "John Doe",
      "enrolledAt": "2024-02-10T10:00:00.000Z",
      "submitted": true
    },
    {
      "_id": "enroll124",
      "testId": "test123",
      "studentEmail": "student2@example.com",
      "studentName": "Jane Smith",
      "enrolledAt": "2024-02-10T11:00:00.000Z",
      "submitted": false
    }
  ],
  "total": 2
}
```

---

## 3. SUBMISSIONS

### 3.1 Submit Test

**POST** `/tests/:id/submit`

**Auth Required:** No

**Request Body:**

```json
{
  "studentEmail": "student@example.com",
  "studentName": "John Doe",
  "answers": [
    {
      "questionIndex": 0,
      "selectedAnswer": "B"
    },
    {
      "questionIndex": 1,
      "selectedAnswer": "B"
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "score": 2,
  "totalQuestions": 2,
  "percentage": 100,
  "grade": "A"
}
```

**Error (Already Submitted):**

```json
{
  "success": false,
  "message": "Test already submitted"
}
```

---

### 3.2 Get Test Submissions (Admin)

**GET** `/tests/:id/submissions`

**Auth Required:** Yes (Admin only)

**Response:**

```json
{
  "success": true,
  "submissions": [
    {
      "_id": "sub123",
      "testId": "test123",
      "studentEmail": "student1@example.com",
      "studentName": "John Doe",
      "score": 8,
      "totalQuestions": 10,
      "percentage": 80,
      "grade": "B",
      "resultsReleased": false,
      "submittedAt": "2024-02-15T12:00:00.000Z"
    }
  ],
  "total": 1
}
```

> **Note:** This endpoint does NOT include the `answers` array in the list view.

---

### 3.3 Get Specific Student Submission (Admin)

**GET** `/tests/:id/submissions/:email`

**Auth Required:** Yes (Admin only)

**Example:** `/tests/test123/submissions/student@example.com`

**Response:**

```json
{
  "success": true,
  "submission": {
    "_id": "sub123",
    "testId": "test123",
    "studentEmail": "student@example.com",
    "studentName": "John Doe",
    "answers": [
      {
        "questionIndex": 0,
        "selectedAnswer": "B"
      },
      {
        "questionIndex": 1,
        "selectedAnswer": "B"
      }
    ],
    "score": 2,
    "totalQuestions": 2,
    "percentage": 100,
    "grade": "A",
    "resultsReleased": true,
    "releasedAt": "2024-02-22T10:00:00.000Z",
    "submittedAt": "2024-02-15T12:00:00.000Z"
  }
}
```

---

## 4. RESULTS MANAGEMENT

### 4.1 Release Results (Admin - 7 Day Rule)

**POST** `/tests/:id/results/release`

**Auth Required:** Yes (Admin only)

**Request Body:**

```json
{
  "emails": [
    "student1@example.com",
    "student2@example.com",
    "student3@example.com"
  ]
}
```

**Response (Success):**

```json
{
  "success": true,
  "releasedCount": 3,
  "message": "Results released to 3 student(s)"
}
```

**Error (Before 7 Days):**

```json
{
  "success": false,
  "message": "Results can only be released 7 days after test completion. 3 days remaining."
}
```

---

### 4.2 Get Student Results

**GET** `/tests/results?email=student@example.com`

**Auth Required:** No

**Query Parameters:**

- `email` (required): Student email address

**Response:**

```json
{
  "success": true,
  "results": [
    {
      "testId": "test123",
      "testTitle": "Midterm Exam - Engineering Mathematics",
      "score": 8,
      "totalQuestions": 10,
      "percentage": 80,
      "grade": "B",
      "submittedAt": "2024-02-15T12:00:00.000Z",
      "releasedAt": "2024-02-22T10:00:00.000Z"
    },
    {
      "testId": "test124",
      "testTitle": "Final Exam - Physics",
      "score": 18,
      "totalQuestions": 20,
      "percentage": 90,
      "grade": "A",
      "submittedAt": "2024-03-01T14:00:00.000Z",
      "releasedAt": "2024-03-08T10:00:00.000Z"
    }
  ]
}
```

> **Note:** Only returns results where `resultsReleased = true`.

---

## 5. STUDY MATERIALS

### 5.1 Create Study Material (Admin)

**POST** `/study-materials`

**Auth Required:** Yes (Admin only)

**Content-Type:** `multipart/form-data` (for PDFs) or `application/json` (for videos/links)

**For PDF Upload:**

```
POST /study-materials
Content-Type: multipart/form-data

Form Data:
- material: [PDF file]
- title: "Engineering Mathematics Lecture Notes"
- type: "pdf"
- department: "Engineering"
- description: "Comprehensive notes covering all topics"
```

**For Video/Link:**

```json
{
  "title": "Introduction to Calculus - Video Tutorial",
  "type": "video",
  "department": "Engineering",
  "description": "YouTube video covering basic calculus",
  "url": "https://youtube.com/watch?v=abc123"
}
```

**Response:**

```json
{
  "success": true,
  "material": {
    "_id": "mat123",
    "title": "Engineering Mathematics Lecture Notes",
    "type": "pdf",
    "department": "Engineering",
    "description": "Comprehensive notes covering all topics",
    "fileUrl": "/uploads/materials/1234567890-abc.pdf",
    "fileName": "Engineering_Math_Notes.pdf",
    "visible": true,
    "downloads": 0,
    "createdBy": "admin123",
    "createdAt": "2024-02-01T10:00:00.000Z"
  }
}
```

---

### 5.2 Get All Study Materials

**GET** `/study-materials`

**Auth Required:** No

**Query Parameters:**

- `department` (optional): Filter by department
- `type` (optional): Filter by type (pdf/video/link)

**Example:** `/study-materials?department=Engineering&type=pdf`

**Response:**

```json
{
  "success": true,
  "materials": [
    {
      "_id": "mat123",
      "title": "Engineering Mathematics Lecture Notes",
      "type": "pdf",
      "department": "Engineering",
      "description": "Comprehensive notes covering all topics",
      "fileUrl": "/uploads/materials/1234567890-abc.pdf",
      "fileName": "Engineering_Math_Notes.pdf",
      "visible": true,
      "downloads": 45,
      "createdBy": {
        "_id": "admin123",
        "firstName": "John",
        "lastName": "Admin"
      },
      "createdAt": "2024-02-01T10:00:00.000Z"
    },
    {
      "_id": "mat124",
      "title": "Calculus Video Series",
      "type": "video",
      "department": "Engineering",
      "url": "https://youtube.com/playlist?list=xyz",
      "visible": true,
      "downloads": 120,
      "createdAt": "2024-02-05T10:00:00.000Z"
    }
  ],
  "total": 2
}
```

---

### 5.3 Toggle Material Visibility (Admin)

**PATCH** `/study-materials/:id/toggle-visibility`

**Auth Required:** Yes (Admin only)

**Response:**

```json
{
  "success": true,
  "material": {
    "_id": "mat123",
    "visible": false
  },
  "message": "Study material is now hidden"
}
```

---

### 5.4 Track Download

**POST** `/study-materials/:id/download`

**Auth Required:** No

**Response:**

```json
{
  "success": true,
  "message": "Download tracked"
}
```

> **Usage:** Call this endpoint before initiating download to increment counter.

---

### 5.5 Delete Study Material (Admin)

**DELETE** `/study-materials/:id`

**Auth Required:** Yes (Admin only)

**Response:**

```json
{
  "success": true,
  "message": "Study material deleted successfully"
}
```

> **Note:** This also deletes the physical file for PDFs.

---

## 6. DEPARTMENT MANAGEMENT

### 6.1 Create Department (Admin)

**POST** `/api/content/departments`

**Auth Required:** Yes (Admin only)

**Request Body:**

```json
{
  "name": "Engineering",
  "code": "ENG",
  "description": "Engineering department",
  "imageUrl": "https://example.com/engineering-icon.png"
}
```

**Response:**

```json
{
  "success": true,
  "department": {
    "_id": "dept123",
    "name": "Engineering",
    "code": "ENG",
    "description": "Engineering department",
    "imageUrl": "https://example.com/engineering-icon.png",
    "isActive": true,
    "createdBy": "admin123"
  }
}
```

---

### 6.2 Get All Departments

**GET** `/papers/departments`

**Auth Required:** No

**Response:**

```json
{
  "success": true,
  "departments": [
    {
      "name": "Engineering",
      "count": 25
    },
    {
      "name": "Business",
      "count": 18
    }
  ]
}
```

---

## 7. PAST PAPERS

### 7.1 Upload Multiple Papers (Admin)

**POST** `/api/admin/papers/upload`

**Auth Required:** Yes (Admin only)

**Content-Type:** `multipart/form-data`

**Form Data:**

```
- papers: [PDF file 1]
- papers: [PDF file 2]
- papers: [PDF file 3]
- title: "Engineering Mathematics"
- department: "Engineering"
- year: "2023"
- description: "Past exam papers"
```

**Response:**

```json
{
  "success": true,
  "uploadedPapers": [
    {
      "_id": "paper123",
      "course": "Engineering Mathematics",
      "department": "Engineering",
      "year": "2023",
      "description": "Past exam papers",
      "fileName": "1234567890-abc.pdf",
      "fileUrl": "/uploads/papers/1234567890-abc.pdf",
      "fileSize": 1024000,
      "status": "pending"
    }
  ],
  "errors": []
}
```

---

### 7.2 Get Papers by Department & Year

**GET** `/papers/titles/:department/:year`

**Auth Required:** No

**Example:** `/papers/titles/Engineering/2023`

**Response:**

```json
{
  "success": true,
  "papers": [
    {
      "_id": "paper123",
      "course": "Engineering Mathematics",
      "year": "2023",
      "description": "Past exam papers",
      "fileName": "exam_2023.pdf",
      "fileUrl": "/uploads/papers/1234567890-abc.pdf",
      "fileSize": 1024000,
      "downloads": 45
    }
  ]
}
```

---

## Grading System

The system uses the following grading scale:

| Percentage | Grade |
| ---------- | ----- |
| 90-100     | A     |
| 80-89      | B     |
| 70-79      | C     |
| 60-69      | D     |
| 50-59      | E     |
| 0-49       | F     |

---

## Status Enums

### Test Status

- `draft` - Test is being created
- `scheduled` - Test is scheduled for future
- `active` - Test is currently available
- `completed` - Test has ended

### Paper Status

- `pending` - Awaiting admin approval
- `approved` - Available to students
- `rejected` - Not approved

### Study Material Types

- `pdf` - PDF document (requires file upload)
- `video` - Video URL (YouTube, Vimeo, etc.)
- `link` - External link (articles, websites)

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message (development only)"
}
```

Common HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Server Error

---

## Authentication

Include JWT token in Authorization header:

```
Authorization: Bearer <your_token_here>
```

Admin-only endpoints require a valid admin token.

---

## Rate Limiting

- **Limit:** 500 requests per 15 minutes
- **Applies to:** All `/api/*` endpoints
- **Response when exceeded:** 429 Too Many Requests

---

## File Upload Limits

- **Max file size:** 10 MB
- **Accepted formats:** PDF only (for papers and study materials)
- **Multiple files:** Up to 10 PDFs per request (papers bulk upload)

---

## Notes

1. **7-Day Rule:** Results can only be released 7 days after test completion (based on `completedAt` timestamp).
2. **Auto-Grading:** Test submissions are automatically graded upon submission.
3. **Cascading Deletes:** Deleting a test also deletes all associated enrollments and submissions.
4. **Visibility Control:** Study materials can be hidden/shown without deletion.
5. **Download Tracking:** Call the download tracking endpoint before initiating file downloads.

---

## Support

For issues or questions, contact: empiretechnology.tech@gmail.com
