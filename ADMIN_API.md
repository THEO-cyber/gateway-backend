# Admin API Documentation

Base URL: `https://gateway-backend-qfjh.onrender.com/api`

## Authentication Required

All admin endpoints require:

- `Authorization: Bearer <JWT_TOKEN>` header
- User must have `role: "admin"` in database

---

## Admin Endpoints

### 1. Dashboard Statistics

```http
GET /api/admin/stats
```

**Response:**

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 150,
      "totalPapers": 450,
      "totalQuestions": 89,
      "totalAnswers": 234,
      "activeUsersToday": 12,
      "totalDownloads": 3450
    },
    "papersByDepartment": [
      { "_id": "Computer Science", "count": 120 },
      { "_id": "Engineering", "count": 85 }
    ],
    "questionsBySubject": [
      { "_id": "Data Structures", "count": 23 },
      { "_id": "Mathematics", "count": 18 }
    ]
  }
}
```

---

### 2. User Management

#### Get All Users

```http
GET /api/admin/users?search=john&role=student&isActive=true&page=1&limit=20
```

**Query Parameters:**

- `search` (optional): Search by email/name
- `role` (optional): Filter by role (student/admin)
- `isActive` (optional): Filter by active status
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20)

**Response:**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "64abc123...",
        "email": "student@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "student",
        "department": "Computer Science",
        "yearOfStudy": "Year 2",
        "isActive": true,
        "isBanned": false,
        "createdAt": "2024-01-15T10:30:00Z",
        "stats": {
          "papersUploaded": 5,
          "questionsAsked": 12,
          "answersGiven": 34
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

#### Get User Details

```http
GET /api/admin/users/:id
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "64abc123...",
      "email": "student@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "student",
      "department": "Computer Science"
    },
    "recentPapers": [...],
    "recentQuestions": [...]
  }
}
```

#### Update User

```http
PUT /api/admin/users/:id
Content-Type: application/json

{
  "role": "admin",
  "isActive": true,
  "isBanned": false
}
```

**Response:**

```json
{
  "success": true,
  "message": "User updated successfully",
  "data": { ...updated user }
}
```

#### Delete User

```http
DELETE /api/admin/users/:id
```

**Response:**

```json
{
  "success": true,
  "message": "User and associated content deleted successfully"
}
```

---

### 3. Content Moderation

#### Get Pending Papers

```http
GET /api/admin/papers/pending
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "64abc456...",
      "fileName": "CS101_2023.pdf",
      "course": "CS101",
      "department": "Computer Science",
      "year": "2023",
      "uploadedBy": {
        "_id": "64abc123...",
        "email": "student@example.com",
        "firstName": "John"
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Delete Question (Moderation)

```http
DELETE /api/admin/questions/:id
```

**Response:**

```json
{
  "success": true,
  "message": "Question deleted successfully"
}
```

#### Delete Answer (Moderation)

```http
DELETE /api/admin/answers/:questionId/:answerId
```

**Response:**

```json
{
  "success": true,
  "message": "Answer deleted successfully"
}
```

---

### 4. Reports & Analytics

#### Get Popular Papers

```http
GET /api/admin/reports/popular-papers
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "64abc789...",
      "fileName": "CS101_2023.pdf",
      "course": "CS101",
      "downloads": 234,
      "uploadedBy": {
        "email": "student@example.com"
      }
    }
  ]
}
```

#### Get Active Users

```http
GET /api/admin/reports/active-users
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "64abc123...",
      "email": "student@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "papersCount": 15,
      "questionsCount": 23,
      "totalActivity": 38
    }
  ]
}
```

---

## Creating First Admin User

You need to manually update a user in MongoDB to make them admin:

### Option 1: MongoDB Compass

1. Connect to your MongoDB
2. Find `hnd_gateway` database → `users` collection
3. Find your user by email
4. Edit document and set: `"role": "admin"`
5. Save

### Option 2: MongoDB Shell

```javascript
use hnd_gateway
db.users.updateOne(
  { email: "youremail@example.com" },
  { $set: { role: "admin" } }
)
```

### Option 3: Using API (one-time setup)

Temporarily add this route to `src/routes/auth.js`:

```javascript
// REMOVE AFTER CREATING FIRST ADMIN!
router.post("/make-admin", protect, async (req, res) => {
  req.user.role = "admin";
  await req.user.save();
  res.json({ success: true, message: "You are now admin" });
});
```

Then call:

```bash
POST /api/auth/make-admin
Authorization: Bearer YOUR_TOKEN
```

**IMPORTANT:** Remove this route immediately after creating your admin user!

---

## Error Responses

### 403 Forbidden (Not Admin)

```json
{
  "success": false,
  "message": "Access denied. Admin privileges required."
}
```

### 403 Forbidden (Banned User)

```json
{
  "success": false,
  "message": "Your account has been suspended or banned"
}
```

### 404 Not Found

```json
{
  "success": false,
  "message": "User not found"
}
```
