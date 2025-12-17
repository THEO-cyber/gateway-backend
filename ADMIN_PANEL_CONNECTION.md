# Admin Panel Connection Fix

## Issue

Your admin panel can't connect to the backend even though it's running on localhost:5000.

## Solutions Applied

### 1. ✅ Enhanced CORS Configuration

Updated CORS to allow all origins and methods for development:

- Allows all origins (your admin panel can connect from any port)
- Allows credentials
- Supports all HTTP methods (GET, POST, PUT, DELETE, etc.)
- Allows Authorization headers

### 2. 🔧 How to Test the Backend

Open a **NEW PowerShell terminal** and run:

```powershell
# Test 1: Check if server is listening
Test-NetConnection -ComputerName localhost -Port 5000

# Test 2: Test health endpoint
curl.exe http://localhost:5000/health

# Test 3: Test login endpoint
$body = '{"email":"test@example.com","password":"test123"}'
curl.exe -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d $body
```

### 3. 📋 Checklist for Admin Panel Connection

Make sure your admin panel is configured with:

✅ **API Base URL:** `http://localhost:5000/api`

✅ **Login Endpoint:** `http://localhost:5000/api/auth/login`

✅ **Request Format:**

```javascript
{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

✅ **Headers:**

```javascript
{
  "Content-Type": "application/json"
}
```

### 4. 🚀 Start the Server Properly

From the project directory, run:

```bash
npm start
```

Keep that terminal open and don't close it.

### 5. 🔍 Common Issues & Fixes

#### Issue: "Backend is not running"

**Solution:**

- Make sure you see: `Server running on port 5000` in the terminal
- Don't close the terminal where the server is running
- Check if another app is using port 5000

#### Issue: "CORS error"

**Solution:** Already fixed - CORS now allows all origins

#### Issue: "Network error" or "Failed to fetch"

**Solution:**

- Check your admin panel is using `http://localhost:5000` (not https)
- Check the URL has `/api` prefix: `http://localhost:5000/api/auth/login`
- Verify server terminal shows the server is running

#### Issue: "Invalid credentials"

**Solution:**

- First, register a user:
  ```bash
  POST http://localhost:5000/api/auth/register
  {
    "email": "admin@example.com",
    "password": "Admin123!",
    "firstName": "Admin",
    "lastName": "User"
  }
  ```
- Then use those credentials to login

### 6. 📱 Test with Postman or Browser

**Using Browser DevTools:**

1. Open browser console (F12)
2. Paste this:

```javascript
fetch("http://localhost:5000/health")
  .then((r) => r.json())
  .then((d) => console.log("✅ Backend is working:", d))
  .catch((e) => console.log("❌ Error:", e));
```

**Using Postman:**

1. Create new request
2. Method: POST
3. URL: `http://localhost:5000/api/auth/login`
4. Body (JSON):

```json
{
  "email": "admin@example.com",
  "password": "Admin123!"
}
```

### 7. 🔐 Register First User

If you haven't registered any users yet, run this first:

**PowerShell:**

```powershell
$body = @{
  email = "admin@hnd.com"
  password = "SecurePass123!"
  firstName = "Admin"
  lastName = "User"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/auth/register" -Method POST -Body $body -ContentType "application/json"
```

**Or using curl:**

```bash
curl.exe -X POST http://localhost:5000/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@hnd.com\",\"password\":\"SecurePass123!\",\"firstName\":\"Admin\",\"lastName\":\"User\"}"
```

### 8. 📝 What Your Admin Panel Should Send

**Login Request:**

```
Method: POST
URL: http://localhost:5000/api/auth/login
Headers: {
  "Content-Type": "application/json"
}
Body: {
  "email": "admin@hnd.com",
  "password": "SecurePass123!"
}
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "...",
      "email": "admin@hnd.com",
      "firstName": "Admin",
      "lastName": "User"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

Save the `token` and include it in subsequent requests:

```
Authorization: Bearer <token>
```

### 9. 🛠️ Admin Panel Configuration

If you're using a frontend framework, update your API configuration:

**React/Next.js:**

```javascript
const API_BASE_URL = "http://localhost:5000/api";
```

**Vue.js:**

```javascript
axios.defaults.baseURL = "http://localhost:5000/api";
```

**Angular:**

```typescript
environment = {
  apiUrl: "http://localhost:5000/api",
};
```

---

## Quick Start Commands

1. **Start Backend:**

   ```bash
   npm start
   ```

2. **Register Admin:**

   ```bash
   curl.exe -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"admin@hnd.com\",\"password\":\"SecurePass123!\",\"firstName\":\"Admin\",\"lastName\":\"User\"}"
   ```

3. **Test Login:**

   ```bash
   curl.exe -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@hnd.com\",\"password\":\"SecurePass123!\"}"
   ```

4. **Point your admin panel to:** `http://localhost:5000/api`

---

**The backend is now configured to accept connections from your admin panel! 🎉**
