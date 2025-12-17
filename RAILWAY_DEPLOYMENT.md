# Railway Deployment Guide for HND Gateway Backend

## ✅ Your .env is Ready!

- MongoDB Atlas: Connected ✓
- OpenAI API: Configured ✓
- Email: Needs App Password (see below)

---

## 🚀 Deploy to Railway.com

### Step 1: Install Railway CLI

```powershell
npm install -g @railway/cli
```

### Step 2: Login to Railway

```powershell
railway login
```

This will open your browser - login with: **theocyber57@gmail.com**

### Step 3: Initialize Railway Project

```powershell
# In your project directory
railway init
```

- Choose: "Create a new project"
- Name it: **hnd-gateway-backend**

### Step 4: Link Your Project

```powershell
railway link
```

Select the project you just created.

### Step 5: Add Environment Variables

```powershell
# Add all your environment variables
railway variables set NODE_ENV=production
railway variables set PORT=5000
railway variables set MONGODB_URI="mongodb+srv://theocyber57_db_user:ONYIBEST1980@hndgateway.utlqmsq.mongodb.net/?appName=hndGateway"
railway variables set JWT_SECRET="2367bed4be6b3d015ddf4b43d56657eebb69fd3d1b43889e99e304c7543bb30b88256c4146e3dfa9f402b027fefa5e48dc4683012ef8df82c7887ac658eeed3e"
railway variables set JWT_EXPIRE="7d"
railway variables set EMAIL_SERVICE="gmail"
railway variables set EMAIL_USER="theocyber57@gmail.com"
railway variables set EMAIL_PASSWORD="YOUR_16_CHAR_APP_PASSWORD"
railway variables set OPENAI_API_KEY="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"
railway variables set MAX_FILE_SIZE="10485760"
railway variables set UPLOAD_PATH="./uploads"
railway variables set FRONTEND_URL="https://hndgatewayadminpanel.kesug.com"
railway variables set RATE_LIMIT_WINDOW_MS="900000"
railway variables set RATE_LIMIT_MAX="100"
```

### Step 6: Deploy

```powershell
railway up
```

### Step 7: Get Your Deployment URL

```powershell
railway domain
```

This will give you a URL like: **https://hnd-gateway-backend-production.up.railway.app**

---

## 🌐 Alternative: Deploy via GitHub (Easier)

### Step 1: Push to GitHub

```powershell
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### Step 2: Connect Railway to GitHub

1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Choose "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect Node.js

### Step 3: Add Environment Variables in Railway Dashboard

1. Click on your project
2. Go to "Variables" tab
3. Add all variables from your .env file (except .env file itself)

### Step 4: Deploy

Railway will automatically deploy! You'll get a URL.

---

## ⚙️ Required Files for Railway

Railway needs these files in your project root:

### 1. Create `railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 2. Update `package.json` engines

Add this to your package.json:

```json
"engines": {
  "node": ">=18.0.0",
  "npm": ">=9.0.0"
}
```

---

## 📧 Fix Gmail App Password

Your current password `HELLOWORLD2.` won't work. You need a Gmail App Password:

1. Go to: https://myaccount.google.com/apppasswords
2. Login with: theocyber57@gmail.com
3. Enable 2-Step Verification first (if not enabled)
4. Create App Password:
   - Select "Mail" and "Other device"
   - Name it: "HND Gateway"
   - Copy the 16-character password (looks like: `abcd efgh ijkl mnop`)
5. Update your .env:
   ```
   EMAIL_PASSWORD=abcdefghijklmnop
   ```

---

## 🔧 After Deployment

1. **Get your Railway URL**: `https://your-app.up.railway.app`

2. **Update Admin Panel**: Point your admin panel to the new URL:

   ```javascript
   const API_BASE_URL = "https://your-app.up.railway.app/api";
   ```

3. **Test the API**:

   ```bash
   curl https://your-app.up.railway.app/health
   ```

4. **Update CORS** if needed - Railway URL is automatically allowed

---

## 🚨 Important Notes

- Railway free tier: $5 credit/month
- Don't commit .env file to git (add to .gitignore)
- Keep your OpenAI key private
- Railway auto-deploys on git push
- Check logs: `railway logs`

---

## 📋 Quick Commands

```bash
# View logs
railway logs

# Check status
railway status

# Open in browser
railway open

# Add more variables
railway variables set KEY=VALUE

# Redeploy
railway up --detach
```

---

## ✅ Deployment Checklist

- [ ] Railway account created
- [ ] GitHub repo created (if using GitHub method)
- [ ] railway.json file created
- [ ] package.json engines added
- [ ] Environment variables set
- [ ] Gmail App Password obtained
- [ ] Deployed successfully
- [ ] Got deployment URL
- [ ] Tested /health endpoint
- [ ] Updated admin panel API URL
- [ ] Added .env to .gitignore

---

**Ready to deploy! Choose CLI method or GitHub method above.**
