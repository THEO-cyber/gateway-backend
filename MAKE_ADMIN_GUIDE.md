# Making a User Admin in MongoDB Atlas

## Step-by-Step Guide

### 1. Login to MongoDB Atlas

1. Go to https://cloud.mongodb.com/
2. Login with your credentials
3. Select your cluster (hndgateway)

### 2. Browse Collections

1. Click "**Browse Collections**" button (or "**Collections**" tab)
2. Select database: `hnd_gateway`
3. Select collection: `users`

### 3. Find Your User

You can search by email to find your account:

- Use the filter box at the top
- Enter: `{ "email": "youremail@example.com" }`
- Click "**Apply**"

### 4. Edit User Document

1. Find your user in the list
2. Click the **Edit** icon (pencil) on the right side
3. Find the `role` field
   - If it exists: Change value to `"admin"`
   - If it doesn't exist: Click "**Add Field**"
     - Field name: `role`
     - Type: `String`
     - Value: `admin`
4. Click "**Update**" to save

### 5. Verify Admin Access

Try logging into admin panel at:

```
POST https://gateway-backend-qfjh.onrender.com/api/auth/login/admin
```

---

## Important: Role-Based Login

### Admin Panel Login

**Endpoint:** `POST /api/auth/login/admin`

```javascript
// Admin panel should use this endpoint
fetch("https://gateway-backend-qfjh.onrender.com/api/auth/login/admin", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
```

**Response if successful:**

```json
{
  "success": true,
  "message": "Admin login successful",
  "data": {
    "user": {
      "id": "64abc123...",
      "email": "admin@example.com",
      "firstName": "Admin",
      "lastName": "User",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response if user is not admin:**

```json
{
  "success": false,
  "message": "Access denied. This login is for administrators only. Please use the student app."
}
```

### Student App Login

**Endpoint:** `POST /api/auth/login/student`

```javascript
// Student app (Flutter) should use this endpoint
final response = await http.post(
  Uri.parse('https://gateway-backend-qfjh.onrender.com/api/auth/login/student'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({'email': email, 'password': password}),
);
```

**Response if successful:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "64abc456...",
      "email": "student@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "student",
      "department": "Computer Science",
      "yearOfStudy": "Year 2"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response if user is admin:**

```json
{
  "success": false,
  "message": "Access denied. Administrator accounts cannot use the student app. Please use the admin panel."
}
```

---

## Security Features

### ✅ Role Separation

- **Admin Panel**: Only accepts `role: "admin"` users
- **Student App**: Only accepts `role: "student"` users
- Attempting to login with wrong role returns error

### ✅ Account Status Checks

Both login endpoints check:

- `isBanned: true` → "Your account has been banned"
- `isActive: false` → "Your account has been deactivated"

### ✅ Default Role

- New registrations automatically get `role: "student"`
- Admin role must be manually set in database

---

## Admin Panel JavaScript Update

Update your admin panel's `index.js` to use the admin endpoint:

```javascript
// OLD - Generic login
const response = await fetch(`${API_URL}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});

// NEW - Admin-specific login
const response = await fetch(`${API_URL}/auth/login/admin`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
```

## Flutter App Update

Update your Flutter app's login to use the student endpoint:

```dart
// OLD - Generic login
final url = Uri.parse('$baseUrl/auth/login');

// NEW - Student-specific login
final url = Uri.parse('$baseUrl/auth/login/student');
```

---

## Testing

### Test Admin Login

```bash
# Should succeed for admin users
curl -X POST https://gateway-backend-qfjh.onrender.com/api/auth/login/admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"yourpassword"}'
```

### Test Student Login

```bash
# Should succeed for student users
curl -X POST https://gateway-backend-qfjh.onrender.com/api/auth/login/student \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.com","password":"yourpassword"}'
```

---

## Quick Reference

| User Type | Endpoint                  | Role Required | Can Access               |
| --------- | ------------------------- | ------------- | ------------------------ |
| Admin     | `/api/auth/login/admin`   | `admin`       | Admin Panel only         |
| Student   | `/api/auth/login/student` | `student`     | Student App only         |
| Generic   | `/api/auth/login`         | Any           | Returns role in response |

**Note:** The generic `/api/auth/login` endpoint still exists for flexibility, but it's recommended to use the specific endpoints for better security.
