# Supabase Storage Setup Guide

## Why Supabase?

Your current Render deployment has an ephemeral filesystem, meaning all uploaded PDF files are **lost when the server restarts** or redeploys. Supabase provides persistent storage with:

- ✅ Free 1GB storage
- ✅ CDN for fast file delivery
- ✅ Public URLs for downloads
- ✅ Automatic backup and persistence
- ✅ Better scalability

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign up/login
2. Click "New Project"
3. Fill in:
   - **Project Name**: `hnd-gateway` (or your choice)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users (e.g., US East, EU West)
4. Click "Create new project" (takes ~2 minutes)

## Step 2: Create Storage Bucket

1. In your Supabase project, go to **Storage** in the left sidebar
2. Click "Create a new bucket"
3. Bucket settings:
   - **Name**: `papers`
   - **Public bucket**: ✅ **Enable** (required for public downloads)
   - **File size limit**: 50MB (or higher if needed)
4. Click "Create bucket"

## Step 3: Get API Credentials

1. Go to **Project Settings** (gear icon at bottom of sidebar)
2. Click **API** in the settings menu
3. Copy these values:
   - **Project URL** (looks like: `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)

## Step 4: Configure Environment Variables

### Local Development (.env file)

Add these lines to your `.env` file:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_anon_public_key_here
```

Replace with your actual values from Step 3.

### Production (Render.com)

1. Go to your Render dashboard
2. Select your backend service
3. Go to **Environment** tab
4. Add these environment variables:
   - **Key**: `SUPABASE_URL`, **Value**: Your project URL
   - **Key**: `SUPABASE_KEY`, **Value**: Your anon key
5. Click "Save Changes" (this will trigger a redeploy)

## Step 5: Test the Integration

### Test Locally

1. Start your server: `npm start`
2. Upload a test PDF using your admin panel or API
3. Check Supabase dashboard → Storage → papers bucket
4. You should see your uploaded file!

### Test in Production

1. After Render redeploys with new env vars
2. Upload a PDF through your production backend
3. Verify file appears in Supabase
4. Test download link works

## How It Works

The system uses a **hybrid approach**:

1. **If Supabase is configured** (env vars present):
   - Uploads go to Supabase Storage
   - Public URLs are stored in database
   - Files persist forever (until manually deleted)
2. **If Supabase is NOT configured**:
   - Falls back to local storage
   - Works like before (but files lost on restart)

This means:

- ✅ Your app works even if Supabase is down
- ✅ Easy to test locally without Supabase
- ✅ Zero downtime migration

## Bucket Permissions

Your bucket is set to **public**, which means:

- ✅ Anyone with the URL can download files (like now)
- ✅ No authentication needed for downloads
- ✅ Perfect for public study materials

If you need private files later:

1. Make bucket private
2. Generate signed URLs with expiry times
3. Update the service to use `createSignedUrl()`

## Storage Costs

- Free tier: **1 GB** storage + 2 GB bandwidth
- Next tier: $0.021 per GB/month
- For 100 students × 100 PDFs @ 1MB each = ~10GB = **$0.21/month**

Very affordable! 🎉

## Troubleshooting

### "Upload failed" error

- Check SUPABASE_URL and SUPABASE_KEY are correct
- Verify bucket name is exactly `papers`
- Ensure bucket is public

### Files not appearing

- Check Supabase dashboard logs
- Verify API key has storage permissions
- Check file size doesn't exceed bucket limit

### Downloads not working

- Ensure bucket is public
- Check file URL format is correct
- Try accessing URL directly in browser

## Migration Notes

- **Existing files**: Old files in local storage remain accessible until server restarts
- **New files**: All new uploads go to Supabase
- **Database**: storagePath field added to track Supabase file locations
- **Backward compatible**: Code works with or without Supabase

## Next Steps

Once Supabase is working:

1. Consider migrating existing files (optional)
2. Set up backup policies in Supabase
3. Monitor usage in Supabase dashboard
4. Add file compression if needed (PDFs usually compress well)

---

**Need help?** Check Supabase docs: https://supabase.com/docs/guides/storage
