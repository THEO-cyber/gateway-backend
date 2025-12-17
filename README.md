# HND Gateway Backend API

Educational platform backend for HND students providing access to past papers, Q&A community, and AI-powered study assistance.

## Features

- 🔐 **User Authentication** - Registration, login, password reset with OTP
- 📚 **Past Papers** - Upload, download, and search academic past papers
- 💬 **Q&A Community** - Ask questions, provide answers, like and accept answers
- 🤖 **AI Assistant** - Chat with AI for study help and explanations
- 📧 **Email Service** - OTP verification and notifications
- 🔒 **Security** - JWT authentication, rate limiting, helmet protection

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose ODM)
- **Authentication:** JWT, bcryptjs
- **AI:** OpenAI API (GPT-3.5)
- **File Upload:** Multer
- **Email:** Nodemailer
- **Cloud Storage:** AWS S3 (optional)
- **Logging:** Winston
- **Security:** Helmet, CORS, express-rate-limit

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- OpenAI API Key (for AI features)
- Gmail account with App Password (for email service)

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd hnd_backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root directory (or copy from `.env.example`):

   ```env
   # Server Configuration
   NODE_ENV=development
   PORT=5000

   # Database
   MONGODB_URI=mongodb://localhost:27017/hnd_gateway
   # Or MongoDB Atlas:
   # MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hnd_gateway

   # JWT Secrets
   JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long
   JWT_EXPIRE=7d

   # Email Service (Gmail)
   EMAIL_SERVICE=gmail
   EMAIL_USER=hndgateway@gmail.com
   EMAIL_PASSWORD=your-app-specific-password

   # OpenAI API
   OPENAI_API_KEY=sk-your-openai-api-key-here

   # File Upload
   MAX_FILE_SIZE=10485760
   UPLOAD_PATH=./uploads

   # Frontend URL
   FRONTEND_URL=http://localhost:3000

   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX=100
   ```

4. **Set up MongoDB**

   - **Local MongoDB:** Start MongoDB service

     ```bash
     mongod
     ```

   - **MongoDB Atlas:** Create a cluster and get connection string

5. **Get API Keys**

   - **OpenAI API Key:** https://platform.openai.com/api-keys
   - **Gmail App Password:** https://myaccount.google.com/apppasswords

## Running the Application

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on `http://localhost:5000`

## API Documentation

### Base URL

```
http://localhost:5000/api
```

### Authentication Endpoints

#### Register User

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "student@example.com",
  "password": "SecurePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "student@example.com",
  "password": "SecurePassword123"
}
```

#### Forgot Password

```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "student@example.com"
}
```

#### Verify OTP

```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "student@example.com",
  "otp": "123456"
}
```

#### Reset Password

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "email": "student@example.com",
  "otp": "123456",
  "newPassword": "NewSecurePassword123"
}
```

#### Get Current User

```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Past Papers Endpoints

All paper endpoints require authentication.

#### Get Papers (with filters)

```http
GET /api/papers?department=Computer Science&course=Programming&year=2023&page=1&limit=20
Authorization: Bearer <token>
```

#### Upload Paper

```http
POST /api/papers/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "file": <PDF file>,
  "department": "Computer Science",
  "course": "Programming",
  "year": 2023
}
```

#### Get Available Years for Course

```http
GET /api/papers/years/:course
Authorization: Bearer <token>
```

#### Download Paper

```http
GET /api/papers/download/:id
Authorization: Bearer <token>
```

#### Delete Paper

```http
DELETE /api/papers/:id
Authorization: Bearer <token>
```

#### Search Papers

```http
GET /api/papers/search?q=algorithm&department=CS
Authorization: Bearer <token>
```

### Q&A Endpoints

#### Get Questions (with filters)

```http
GET /api/qa/questions?department=CS&subject=Math&sortBy=recent&page=1
Authorization: Bearer <token>
```

Query parameters:

- `department` - Filter by department
- `subject` - Filter by subject
- `tag` - Filter by tag
- `isSolved` - true/false
- `sortBy` - recent, popular, unanswered
- `page` - Page number
- `limit` - Items per page

#### Get Single Question

```http
GET /api/qa/questions/:id
Authorization: Bearer <token>
```

#### Ask Question

```http
POST /api/qa/questions
Authorization: Bearer <token>
Content-Type: application/json

{
  "question": "How do I solve quadratic equations?",
  "subject": "Mathematics",
  "department": "Computer Science",
  "tags": ["math", "algebra"]
}
```

#### Answer Question

```http
POST /api/qa/questions/:id/answer
Authorization: Bearer <token>
Content-Type: application/json

{
  "answer": "To solve quadratic equations, you can use..."
}
```

#### Like Question

```http
POST /api/qa/questions/:id/like
Authorization: Bearer <token>
```

#### Like Answer

```http
POST /api/qa/questions/:questionId/answers/:answerId/like
Authorization: Bearer <token>
```

#### Accept Answer

```http
POST /api/qa/questions/:questionId/answers/:answerId/accept
Authorization: Bearer <token>
```

#### Delete Question

```http
DELETE /api/qa/questions/:id
Authorization: Bearer <token>
```

#### Delete Answer

```http
DELETE /api/qa/questions/:questionId/answers/:answerId
Authorization: Bearer <token>
```

### AI Assistant Endpoints

#### Chat with AI

```http
POST /api/ai/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "Explain the concept of recursion",
  "conversationHistory": [
    {
      "role": "user",
      "content": "Previous question"
    },
    {
      "role": "assistant",
      "content": "Previous response"
    }
  ]
}
```

#### Get Explanation

```http
POST /api/ai/explain
Authorization: Bearer <token>
Content-Type: application/json

{
  "topic": "Binary Search Tree",
  "context": "Data Structures course"
}
```

### Health Check

```http
GET /health
```

## Project Structure

```
hnd_backend/
├── src/
│   ├── config/          # Configuration files
│   │   ├── aws.js
│   │   ├── database.js
│   │   └── multer.js
│   ├── controllers/     # Request handlers
│   │   ├── aiController.js
│   │   ├── authController.js
│   │   ├── paperController.js
│   │   └── qaController.js
│   ├── middleware/      # Custom middleware
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── upload.js
│   ├── models/          # Database models
│   │   ├── Answer.js
│   │   ├── PastPaper.js
│   │   ├── Question.js
│   │   └── User.js
│   ├── routes/          # API routes
│   │   ├── ai.js
│   │   ├── auth.js
│   │   ├── papers.js
│   │   └── qa.js
│   ├── services/        # Business logic
│   │   ├── emailService.js
│   │   ├── openaiService.js
│   │   └── uploadService.js
│   ├── utils/           # Utility functions
│   │   ├── helpers.js
│   │   └── logger.js
│   └── app.js           # Express app setup
├── tests/               # Test files
├── uploads/             # Uploaded files
│   └── papers/
├── .env                 # Environment variables
├── .gitignore
├── package.json
├── server.js            # Entry point
└── README.md
```

## Database Models

### User

- email (unique, required)
- password (hashed, required)
- firstName
- lastName
- resetPasswordOTP
- resetPasswordExpire
- createdAt

### PastPaper

- department (required)
- course (required)
- year (required)
- fileName (required)
- fileUrl (required)
- fileSize (required)
- uploadedBy (ref: User)
- downloads
- createdAt

### Question

- userId (ref: User, required)
- userName
- question (required)
- subject
- department
- tags
- likesCount
- likedBy (array of User IDs)
- answers (embedded Answer schema)
- answersCount
- isSolved
- createdAt
- updatedAt

### Answer (embedded in Question)

- userId (ref: User, required)
- userName
- answer (required)
- likesCount
- likedBy (array of User IDs)
- isAccepted
- createdAt

## Security Features

- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - bcrypt with salt rounds
- **Rate Limiting** - Prevents brute force attacks
- **Helmet** - Sets security HTTP headers
- **CORS** - Configured cross-origin resource sharing
- **Input Validation** - express-validator
- **File Upload Limits** - Max file size enforcement
- **Error Handling** - Centralized error middleware

## Error Handling

The API uses consistent error response format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message (development only)"
}
```

HTTP Status Codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Development

### Running Tests

```bash
npm test
```

### Code Style

- Use ES6+ features
- Follow Node.js best practices
- Use async/await for asynchronous code
- Proper error handling

### Logging

Logs are managed by Winston and output to console in development mode.

## Deployment

### Environment Variables

Ensure all production environment variables are set:

- Use strong `JWT_SECRET`
- Use production MongoDB URI
- Set `NODE_ENV=production`
- Configure proper CORS origins
- Set up AWS S3 for file storage (optional)

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT secret
- [ ] Configure MongoDB Atlas
- [ ] Set up email service
- [ ] Configure OpenAI API
- [ ] Set proper CORS origins
- [ ] Enable HTTPS
- [ ] Set up monitoring/logging
- [ ] Configure file storage (AWS S3)
- [ ] Set appropriate rate limits

## Troubleshooting

### MongoDB Connection Issues

- Verify MongoDB is running
- Check connection string format
- Ensure network access (for Atlas)
- Verify credentials

### Email Service Issues

- Generate Gmail App Password correctly
- Enable 2FA on Gmail account
- Check email credentials in .env

### File Upload Issues

- Verify uploads/papers directory exists
- Check file permissions
- Ensure MAX_FILE_SIZE is set correctly

### OpenAI API Issues

- Verify API key is valid
- Check API quota/credits
- Monitor rate limits

## Support

For issues and questions:

- Create an issue in the repository
- Contact: hndgateway@gmail.com

## License

This project is licensed under the MIT License.

## Contributors

- HND Gateway Team

---

**Built with ❤️ for HND students**
