# Student App API Endpoints

**Base URL:** `https://gateway-backend-qfjh.onrender.com/api`  
**Local Testing:** `http://localhost:5000/api`

All endpoints require authentication unless marked as "Public". Include JWT token in headers:

```
Authorization: Bearer <token>
```

---

## 🔐 Authentication Endpoints

### 1. Register Student Account

**POST** `/auth/register`

```json
Request:
{
  "email": "student@example.com",
  "password": "Password123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "student",
  "department": "Computer Science",
  "yearOfStudy": 2
}

Response (201):
{
  "success": true,
  "token": "jwt_token_here",
  "data": {
    "user": {
      "_id": "user_id",
      "email": "student@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "student",
      "department": "Computer Science",
      "yearOfStudy": 2
    }
  }
}
```

### 2. Login (Student)

**POST** `/auth/login/student`

```json
Request:
{
  "email": "student@example.com",
  "password": "Password123"
}

Response (200):
{
  "success": true,
  "token": "jwt_token_here",
  "data": {
    "user": { ...user_object }
  }
}
```

### 3. Get Current User Profile

**GET** `/auth/me`  
**Headers:** `Authorization: Bearer <token>`

```json
Response (200):
{
  "success": true,
  "data": {
    "_id": "user_id",
    "email": "student@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "student",
    "department": "Computer Science",
    "yearOfStudy": 2,
    "bio": "...",
    "avatar": "...",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 4. Forgot Password

**POST** `/auth/forgot-password`

```json
Request:
{
  "email": "student@example.com"
}

Response (200):
{
  "success": true,
  "message": "OTP sent to your email"
}
```

### 5. Verify OTP

**POST** `/auth/verify-otp`

```json
Request:
{
  "email": "student@example.com",
  "otp": "123456"
}

Response (200):
{
  "success": true,
  "message": "OTP verified successfully"
}
```

### 6. Reset Password

**POST** `/auth/reset-password`

```json
Request:
{
  "email": "student@example.com",
  "otp": "123456",
  "newPassword": "NewPassword123"
}

Response (200):
{
  "success": true,
  "message": "Password reset successful"
}
```

### 7. Verify Token (Check if logged in)

**GET** `/auth/verify`  
**Headers:** `Authorization: Bearer <token>`

```json
Response (200):
{
  "success": true,
  "valid": true,
  "user": { ...user_object }
}
```

### 8. Logout

**POST** `/auth/logout`  
**Headers:** `Authorization: Bearer <token>`

```json
Response (200):
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 📄 Past Papers Endpoints

### 9. Get All Departments with Papers

**GET** `/papers/departments`  
**Headers:** `Authorization: Bearer <token>`

```json
Response (200):
{
  "success": true,
  "data": [
    {
      "department": "Computer Science",
      "paperCount": 15
    },
    {
      "department": "Engineering",
      "paperCount": 20
    }
  ]
}
```

### 10. Get Years Available for Department

**GET** `/papers/years/:department`  
**Example:** `/papers/years/Computer Science`  
**Headers:** `Authorization: Bearer <token>`

```json
Response (200):
{
  "success": true,
  "data": [
    {
      "year": 2024,
      "paperCount": 5
    },
    {
      "year": 2023,
      "paperCount": 10
    }
  ]
}
```

### 11. Get Papers by Department and Year

**GET** `/papers/titles/:department/:year`  
**Example:** `/papers/titles/Computer Science/2024`  
**Headers:** `Authorization: Bearer <token>`

```json
Response (200):
{
  "success": true,
  "data": [
    {
      "_id": "paper_id",
      "course": "Data Structures",
      "fileName": "CS201_2024.pdf",
      "fileUrl": "https://.../uploads/papers/CS201_2024.pdf",
      "downloads": 45,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 12. Browse/Search All Papers

**GET** `/papers?department=CS&year=2024&page=1&limit=20`  
**Headers:** `Authorization: Bearer <token>`

```json
Response (200):
{
  "success": true,
  "data": {
    "papers": [ ...array_of_papers ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "pages": 3
    }
  }
}
```

### 13. Search Papers

**GET** `/papers/search?q=algorithm`  
**Headers:** `Authorization: Bearer <token>`

```json
Response (200):
{
  "success": true,
  "data": {
    "papers": [ ...matching_papers ],
    "total": 10
  }
}
```

### 14. Download Paper

**GET** `/papers/:id/download`  
**Example:** `/papers/507f1f77bcf86cd799439011/download`  
**Headers:** `Authorization: Bearer <token>`

```
Response: PDF file (binary)
Content-Type: application/pdf
Content-Disposition: attachment; filename="paper.pdf"
```

**Note:** This increments the download counter automatically.

### 15. Upload Paper (Student can upload)

**POST** `/papers/upload`  
**Headers:**

- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

```
FormData:
- file: [PDF file]
- department: "Computer Science"
- course: "Data Structures"
- year: 2024

Response (201):
{
  "success": true,
  "message": "Paper uploaded successfully",
  "data": {
    "_id": "paper_id",
    "department": "Computer Science",
    "course": "Data Structures",
    "year": 2024,
    "fileName": "original_filename.pdf",
    "fileUrl": "https://.../uploads/papers/...",
    "status": "approved",
    "uploadedBy": "user_id"
  }
}
```

---

## ❓ Q&A (Questions & Answers) Endpoints

### 16. Get All Questions

**GET** `/qa/questions?page=1&limit=20`  
**Headers:** `Authorization: Bearer <token>`

```json
Response (200):
{
  "success": true,
  "data": {
    "questions": [
      {
        "_id": "question_id",
        "title": "How to solve this algorithm?",
        "question": "Full question text...",
        "subject": "Data Structures",
        "department": "Computer Science",
        "tags": ["algorithm", "sorting"],
        "userId": { "firstName": "John", "lastName": "Doe" },
        "likesCount": 5,
        "answersCount": 3,
        "isFeatured": false,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": { ... }
  }
}
```

### 17. Get Single Question with Answers

**GET** `/qa/questions/:id`  
**Headers:** `Authorization: Bearer <token>`

```json
Response (200):
{
  "success": true,
  "data": {
    "_id": "question_id",
    "title": "Question title",
    "question": "Full question...",
    "subject": "Data Structures",
    "answers": [
      {
        "_id": "answer_id",
        "answer": "Answer text...",
        "userId": { "firstName": "Jane", "lastName": "Smith" },
        "likesCount": 2,
        "isAccepted": false,
        "createdAt": "2024-01-02T00:00:00.000Z"
      }
    ],
    "likesCount": 5,
    "answersCount": 3
  }
}
```

### 18. Ask Question

**POST** `/qa/questions`  
**Headers:** `Authorization: Bearer <token>`

```json
Request:
{
  "title": "How to implement binary search?",
  "question": "I'm having trouble implementing...",
  "subject": "Data Structures",
  "department": "Computer Science",
  "tags": ["algorithm", "search"]
}

Response (201):
{
  "success": true,
  "data": { ...created_question }
}
```

### 19. Update Your Question

**PUT** `/qa/questions/:id`  
**Headers:** `Authorization: Bearer <token>`

```json
Request:
{
  "title": "Updated title",
  "question": "Updated question text",
  "tags": ["new", "tags"]
}

Response (200):
{
  "success": true,
  "data": { ...updated_question }
}
```

### 20. Delete Your Question

**DELETE** `/qa/questions/:id`  
**Headers:** `Authorization: Bearer <token>`

```json
Response (200):
{
  "success": true,
  "message": "Question deleted successfully"
}
```

### 21. Answer a Question

**POST** `/qa/questions/:id/answers`  
**Headers:** `Authorization: Bearer <token>`

```json
Request:
{
  "answer": "Here's how you implement binary search..."
}

Response (201):
{
  "success": true,
  "data": {
    "_id": "answer_id",
    "answer": "...",
    "userId": "user_id",
    "likesCount": 0,
    "createdAt": "..."
  }
}
```

### 22. Update Your Answer

**PUT** `/qa/questions/:questionId/answers/:answerId`  
**Headers:** `Authorization: Bearer <token>`

```json
Request:
{
  "answer": "Updated answer text"
}

Response (200):
{
  "success": true,
  "data": { ...updated_answer }
}
```

### 23. Delete Your Answer

**DELETE** `/qa/questions/:questionId/answers/:answerId`  
**Headers:** `Authorization: Bearer <token>`

```json
Response (200):
{
  "success": true,
  "message": "Answer deleted successfully"
}
```

### 24. Like a Question

**POST** `/qa/questions/:id/like`  
**Headers:** `Authorization: Bearer <token>`

```json
Response (200):
{
  "success": true,
  "message": "Question liked successfully",
  "likesCount": 6
}
```

### 25. Like an Answer

**POST** `/qa/questions/:questionId/answers/:answerId/like`  
**Headers:** `Authorization: Bearer <token>`

```json
Response (200):
{
  "success": true,
  "message": "Answer liked successfully",
  "likesCount": 3
}
```

---

## 📢 Announcements Endpoints

### 26. Get All Announcements

**GET** `/announcements?category=academic&isActive=true&page=1&limit=20`  
**Headers:** `Authorization: Bearer <token>`

```json
Response (200):
{
  "success": true,
  "data": [
    {
      "_id": "announcement_id",
      "title": "Exam Schedule Released",
      "message": "The exam schedule for semester...",
      "category": "academic",
      "targetAudience": "students",
      "isPinned": true,
      "isActive": true,
      "viewCount": 120,
      "createdBy": { "firstName": "Admin", "lastName": "User" },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "expiresAt": "2024-12-31T23:59:59.000Z"
    }
  ],
  "pagination": { ... }
}
```

**Categories:** general, urgent, maintenance, update, event, academic, exam, holiday, deadline

### 27. Get Single Announcement

**GET** `/announcements/:id`  
**Headers:** `Authorization: Bearer <token>`

```json
Response (200):
{
  "success": true,
  "data": { ...announcement_details }
}
```

**Note:** Automatically increments view count when viewing.

---

## 🤖 AI Chat Assistant Endpoint

### 28. Ask AI Assistant

**POST** `/ai/ask`  
**Headers:** `Authorization: Bearer <token>`

```json
Request:
{
  "question": "Explain how binary search works"
}

Response (200):
{
  "success": true,
  "data": {
    "answer": "Binary search is an efficient algorithm...",
    "question": "Explain how binary search works"
  }
}
```

**Note:** Requires valid OpenAI API key configured on backend.

---

## 📊 Additional Helper Endpoints

### Get Available Years for a Course

**GET** `/papers/years/:course`  
**Example:** `/papers/years/CS201`  
**Headers:** `Authorization: Bearer <token>`

```json
Response (200):
{
  "success": true,
  "data": [2024, 2023, 2022, 2021]
}
```

---

## 🔒 Authentication Flow

1. **Register** → Receive JWT token
2. **Store token** in secure storage (flutter_secure_storage)
3. **Include token** in all subsequent requests
4. **Handle 401** responses by redirecting to login

---

## 📱 Flutter Implementation Tips

### 1. API Service Class

```dart
class ApiService {
  static const String baseUrl = 'https://gateway-backend-qfjh.onrender.com/api';

  Future<String?> getToken() async {
    final storage = FlutterSecureStorage();
    return await storage.read(key: 'token');
  }

  Future<http.Response> get(String endpoint) async {
    final token = await getToken();
    return http.get(
      Uri.parse('$baseUrl$endpoint'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );
  }
}
```

### 2. PDF Download and Offline Storage

```dart
Future<void> downloadPaper(String paperId) async {
  final response = await ApiService().get('/papers/$paperId/download');

  if (response.statusCode == 200) {
    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/paper_$paperId.pdf');
    await file.writeAsBytes(response.bodyBytes);

    // Save to local database for offline access
    await saveToLocalDB(paperId, file.path);
  }
}
```

### 3. Handle Errors

```dart
if (response.statusCode == 401) {
  // Token expired, redirect to login
  Navigator.pushReplacementNamed(context, '/login');
} else if (response.statusCode == 500) {
  // Server error
  showError('Server error. Please try again later.');
}
```

---

## 🚀 Ready to Build!

All endpoints are live and ready for integration. The backend handles:

- ✅ Authentication & authorization
- ✅ File upload & download
- ✅ PDF storage & serving
- ✅ Download tracking
- ✅ Search & filtering
- ✅ Q&A with likes
- ✅ Announcements
- ✅ AI assistance

**Production URL:** https://gateway-backend-qfjh.onrender.com  
**Local Testing:** http://localhost:5000

Happy coding! 🎉
