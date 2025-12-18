# Complete Admin Dashboard API Documentation

**Base URL**: `https://gateway-backend-qfjh.onrender.com/api`

All endpoints (except auth/login) require: `Authorization: Bearer <JWT_TOKEN>`

---

## 1. AUTHENTICATION

### POST /auth/login/admin

Admin panel login

```json
Request: { "email": "admin@example.com", "password": "password123" }
Response: { "success": true, "data": { "user": {...}, "token": "..." } }
```

### POST /auth/verify

Verify token validity

```json
Response: { "success": true, "data": { "user": {...} } }
```

### POST /auth/logout

Logout (client removes token)

```json
Response: { "success": true, "message": "Logged out successfully" }
```

### POST /auth/refresh

Refresh JWT token

```json
Response: { "success": true, "data": { "token": "...", "user": {...} } }
```

---

## 2. DASHBOARD STATS

### GET /dashboard/stats

Overall statistics

```json
Response: {
  "success": true,
  "data": {
    "totalUsers": 150,
    "totalPapers": 450,
    "totalQuestions": 89,
    "totalAnswers": 234,
    "totalDownloads": 3450,
    "activeUsersToday": 12,
    "activeUsersWeek": 45,
    "activeUsersMonth": 120
  }
}
```

### GET /dashboard/active-users?days=7

Active users data

```json
Response: {
  "success": true,
  "data": [
    { "_id": "2024-01-15", "count": 12 },
    { "_id": "2024-01-16", "count": 18 }
  ]
}
```

### GET /dashboard/popular-courses?limit=10

Popular courses by downloads

```json
Response: {
  "success": true,
  "data": [
    { "_id": "CS101", "paperCount": 25, "totalDownloads": 450 }
  ]
}
```

### GET /dashboard/recent-activity?limit=20

Recent activity feed

```json
Response: {
  "success": true,
  "data": [
    {
      "type": "user_registered",
      "message": "John Doe registered",
      "user": {...},
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### GET /dashboard/download-stats?days=30

Download statistics

```json
Response: {
  "success": true,
  "data": {
    "topPapers": [...],
    "byDepartment": [...],
    "byYear": [...]
  }
}
```

---

## 3. USERS MANAGEMENT

### GET /users?search=john&role=student&isActive=true&page=1&limit=20

Get all users with filters

### GET /users/:id

Get user by ID

### POST /users

Not implemented (use /auth/register)

### PUT /users/:id

Update user

```json
Request: { "role": "admin", "isActive": true, "isBanned": false }
```

### DELETE /users/:id

Delete user and their content

### POST /users/bulk-delete

Bulk delete users

```json
Request: { "userIds": ["id1", "id2", "id3"] }
```

### POST /users/export

Export users to CSV (downloads file)

### GET /users/stats

Get user statistics

---

## 4. PAST PAPERS MANAGEMENT

### GET /papers?department=CS&year=2023&status=approved&page=1&limit=20

Get all papers with filters

### GET /papers/:id

Get paper by ID

### POST /papers/upload

Upload new paper (multipart/form-data)

```
FormData: { file: File, department: "CS", course: "CS101", year: 2023 }
```

### PUT /papers/:id

Update paper metadata

```json
Request: { "department": "CS", "course": "CS101", "year": 2024 }
```

### DELETE /papers/:id

Delete paper

### POST /papers/bulk-upload

Bulk upload papers (not implemented)

### GET /papers/:id/download

Download paper file (increments download count)

### PUT /papers/:id/approve

Approve paper

### PUT /papers/:id/reject

Reject paper

```json
Request: { "reason": "Invalid content" }
```

### GET /papers/stats

Get paper statistics

---

## 5. Q&A MODERATION

### GET /qa/questions?department=CS&subject=Math&page=1&limit=20

Get all questions with filters

### GET /qa/questions/:id

Get question with answers

### POST /qa/questions

Create question

```json
Request: { "question": "How to...", "subject": "Math", "department": "CS", "tags": ["algorithm"] }
```

### PUT /qa/questions/:id

Update question

### DELETE /qa/questions/:id

Delete question

### PUT /qa/questions/:id/feature

Mark question as featured (Admin only)

### GET /qa/questions/:id/answers

Get answers for question

### DELETE /qa/questions/:questionId/answers/:answerId

Delete answer

### PUT /users/:id/ban

Ban user (Update user with isBanned: true)

---

## 6. CONTENT MANAGEMENT

### Departments

- GET /departments - Get all
- POST /departments - Create { "name": "...", "code": "CS", "description": "..." }
- PUT /departments/:id - Update
- DELETE /departments/:id - Delete

### Courses

- GET /courses - Get all
- POST /courses - Create { "name": "...", "code": "CS101", "department": "id", "credits": 3 }
- PUT /courses/:id - Update
- DELETE /courses/:id - Delete

### Subjects

- GET /subjects - Get all
- POST /subjects - Create { "name": "...", "code": "MATH101", "department": "id" }
- PUT /subjects/:id - Update
- DELETE /subjects/:id - Delete

### Tags

- GET /tags - Get all
- POST /tags - Create { "name": "algorithm" }
- DELETE /tags/:id - Delete

---

## 7. ANNOUNCEMENTS

### GET /announcements?category=urgent&isActive=true&page=1&limit=20

Get all announcements (Public)

### GET /announcements/:id

Get announcement by ID (Public)

### POST /announcements

Create announcement (Admin)

```json
Request: {
  "title": "System Maintenance",
  "message": "Server will be down...",
  "category": "maintenance",
  "targetAudience": "all",
  "isPinned": true,
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

### PUT /announcements/:id

Update announcement (Admin)

### DELETE /announcements/:id

Delete announcement (Admin)

### PUT /announcements/:id/toggle

Toggle active status (Admin)

### GET /announcements/:id/analytics

Get announcement analytics (Admin)

---

## 8. ANALYTICS & REPORTS

### GET /analytics/top-papers?limit=20

Top downloaded papers

### GET /analytics/top-users?limit=20

Most active users

### GET /analytics/trending-questions?limit=20&days=7

Trending questions

### GET /analytics/engagement

Engagement metrics

```json
Response: {
  "totalQuestions": 150,
  "solvedQuestions": 98,
  "solvedRate": "65.33",
  "avgAnswersPerQuestion": "2.5",
  "totalLikes": 456,
  "mostActiveSubjects": [...]
}
```

### GET /analytics/charts/users?days=30

User growth chart data

### GET /analytics/charts/department

Department distribution

### GET /analytics/charts/growth?days=90

Growth over time

### POST /analytics/export/csv

Export report as CSV (downloads file)

### POST /analytics/export/pdf

Export as PDF (not implemented)

### POST /analytics/export/excel

Export as Excel (not implemented)

---

## Response Formats

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Pagination Format

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (not admin or banned)
- `404` - Not Found
- `500` - Server Error
- `501` - Not Implemented

---

## Notes

1. All admin endpoints require `role: "admin"` in user document
2. Create first admin manually in MongoDB Atlas
3. PDF and Excel exports not yet implemented (use CSV)
4. Bulk paper upload not yet implemented
5. All dates in ISO 8601 format
6. File uploads use multipart/form-data
7. Downloads are served as file streams
