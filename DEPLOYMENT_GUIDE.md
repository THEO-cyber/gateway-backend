# Deployment Guide

## ✅ What's Been Added

### New Models (5)

- ✅ Department (name, code, description)
- ✅ Course (name, code, department, credits)
- ✅ Subject (name, code, department)
- ✅ Tag (name, usageCount)
- ✅ Announcement (title, message, category, viewCount)

### Enhanced Models

- ✅ User: Added `role`, `department`, `yearOfStudy`, `bio`, `avatar`, `isActive`, `isBanned`
- ✅ PastPaper: Added `status`, `rejectionReason`, `approvedBy`
- ✅ Question: Added `isFeatured`

### New Controllers (5)

- ✅ dashboardController - Overall stats, active users, popular courses, recent activity
- ✅ contentController - Departments, courses, subjects, tags CRUD
- ✅ announcementController - Full announcements system with analytics
- ✅ analyticsController - Charts, trends, top users/papers, exports
- ✅ Enhanced adminController - Bulk delete, export users, user stats

### New Authentication Endpoints (3)

- ✅ POST /auth/verify - Token verification
- ✅ POST /auth/logout - Logout endpoint
- ✅ POST /auth/refresh - Token refresh

### New Routes (7)

- ✅ /api/dashboard/\* - Dashboard statistics
- ✅ /api/users/\* - User management
- ✅ /api/departments/\* - Department management
- ✅ /api/courses/\* - Course management
- ✅ /api/subjects/\* - Subject management
- ✅ /api/tags/\* - Tag management
- ✅ /api/announcements/\* - Announcements system
- ✅ /api/analytics/\* - Analytics & reports

### Total New Endpoints: 65+

---

## 🚀 Deploy to Production

### 1. Create First Admin User

**Option A: MongoDB Atlas Web Interface**

1. Go to https://cloud.mongodb.com/
2. Browse Collections → `hnd_gateway` → `users`
3. Find your user by email
4. Edit and set: `"role": "admin"`

**Option B: MongoDB Shell**

```javascript
use hnd_gateway
db.users.updateOne(
  { email: "youremail@example.com" },
  { $set: { role: "admin" } }
)
```

### 2. Push to GitHub

```powershell
git add .
git commit -m "Add complete admin dashboard functionality with 65+ endpoints"
git push origin main
```

### 3. Deploy to Render

- Render will auto-deploy in ~2 minutes
- Check deployment at: https://gateway-backend-qfjh.onrender.com/health

### 4. Test Admin Login

```bash
curl -X POST https://gateway-backend-qfjh.onrender.com/api/auth/login/admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"yourpassword"}'
```

### 5. Update Admin Panel

Change login endpoint in your admin panel:

```javascript
// OLD
fetch(`${API_URL}/auth/login`, ...)

// NEW
fetch(`${API_URL}/auth/login/admin`, ...)
```

### 6. Update Flutter App

Change login endpoint in Flutter:

```dart
// OLD
Uri.parse('$baseUrl/auth/login')

// NEW
Uri.parse('$baseUrl/auth/login/student')
```

---

## 📊 Available Endpoints Summary

### Authentication (7)

- POST /auth/register
- POST /auth/login (generic)
- POST /auth/login/admin (admin only)
- POST /auth/login/student (student only)
- POST /auth/verify
- POST /auth/logout
- POST /auth/refresh

### Dashboard (5)

- GET /dashboard/stats
- GET /dashboard/active-users
- GET /dashboard/popular-courses
- GET /dashboard/recent-activity
- GET /dashboard/download-stats

### Users (8)

- GET /users
- GET /users/:id
- PUT /users/:id
- DELETE /users/:id
- POST /users/bulk-delete
- POST /users/export
- GET /users/stats

### Papers (11)

- GET /papers
- GET /papers/:id
- POST /papers/upload
- PUT /papers/:id
- DELETE /papers/:id
- GET /papers/search
- GET /papers/:id/download
- PUT /papers/:id/approve
- PUT /papers/:id/reject
- GET /papers/stats
- POST /papers/bulk-upload

### Q&A (10)

- GET /qa/questions
- GET /qa/questions/:id
- POST /qa/questions
- PUT /qa/questions/:id
- DELETE /qa/questions/:id
- PUT /qa/questions/:id/feature
- POST /qa/questions/:id/answers
- DELETE /qa/questions/:questionId/answers/:answerId
- GET /qa/questions/:id/answers

### Content Management (15)

- GET/POST /departments
- GET/PUT/DELETE /departments/:id
- GET/POST /courses
- GET/PUT/DELETE /courses/:id
- GET/POST /subjects
- GET/PUT/DELETE /subjects/:id
- GET/POST /tags
- DELETE /tags/:id

### Announcements (7)

- GET /announcements
- GET /announcements/:id
- POST /announcements
- PUT /announcements/:id
- DELETE /announcements/:id
- PUT /announcements/:id/toggle
- GET /announcements/:id/analytics

### Analytics (10)

- GET /analytics/top-papers
- GET /analytics/top-users
- GET /analytics/trending-questions
- GET /analytics/engagement
- GET /analytics/charts/users
- GET /analytics/charts/department
- GET /analytics/charts/growth
- POST /analytics/export/csv
- POST /analytics/export/pdf (not implemented)
- POST /analytics/export/excel (not implemented)

---

## ⚠️ Important Notes

1. **Admin Access**: Must manually set `role: "admin"` in MongoDB
2. **Role Separation**:
   - Admin panel uses `/auth/login/admin`
   - Student app uses `/auth/login/student`
3. **Banned Users**: Cannot access any endpoints
4. **Status Field**: Papers now have `pending`, `approved`, `rejected` status
5. **Featured Questions**: Admins can feature important questions
6. **Exports**: CSV works, PDF/Excel not yet implemented
7. **Bulk Upload**: Not yet implemented (use individual uploads)

---

## 🧪 Testing Endpoints

Use the provided [COMPLETE_API_DOCS.md](COMPLETE_API_DOCS.md) for full endpoint documentation.

### Quick Test

```bash
# Health check
curl https://gateway-backend-qfjh.onrender.com/health

# Admin login
curl -X POST https://gateway-backend-qfjh.onrender.com/api/auth/login/admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# Get dashboard stats (use token from login)
curl https://gateway-backend-qfjh.onrender.com/api/dashboard/stats \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 📝 Frontend Integration

### Admin Panel Endpoints to Use:

1. **Login**: `/auth/login/admin`
2. **Dashboard**: `/dashboard/stats`
3. **Users**: `/users?page=1&limit=20`
4. **Papers**: `/papers?status=approved`
5. **Analytics**: `/analytics/top-papers`
6. **Announcements**: `/announcements?isActive=true`

### Student App Endpoints to Use:

1. **Login**: `/auth/login/student`
2. **Browse Papers**: `/papers?department=CS`
3. **Ask Questions**: `/qa/questions`
4. **AI Chat**: `/ai/chat`
5. **Announcements**: `/announcements?isActive=true`

---

## 🔒 Security Features

✅ Role-based access control (admin/student)
✅ JWT token authentication
✅ Account suspension (isBanned, isActive)
✅ Admin-only endpoints protected
✅ CORS configured for admin panel
✅ Rate limiting enabled
✅ Password hashing with bcrypt

---

## 📈 What's Next?

Optional enhancements:

- [ ] PDF/Excel export implementation
- [ ] Bulk paper upload
- [ ] Real-time notifications (Socket.io)
- [ ] Email notifications for announcements
- [ ] Advanced search with Elasticsearch
- [ ] Caching with Redis
- [ ] Image uploads for user avatars
- [ ] Report generation system

---

## ✅ Deployment Checklist

- [ ] Create admin user in MongoDB
- [ ] Push code to GitHub
- [ ] Verify Render deployment
- [ ] Test admin login
- [ ] Update admin panel login endpoint
- [ ] Update Flutter app login endpoint
- [ ] Test all major endpoints
- [ ] Configure OpenAI API key (for AI features)
- [ ] Configure Gmail app password (for emails)
- [ ] Add 0.0.0.0/0 to MongoDB whitelist (already done)

---

## 📚 Documentation Files

- `COMPLETE_API_DOCS.md` - Full API documentation
- `MAKE_ADMIN_GUIDE.md` - How to create admin users
- `ADMIN_API.md` - Original admin API docs
- `DEPLOYMENT_GUIDE.md` - This file
- `README.md` - General project info
