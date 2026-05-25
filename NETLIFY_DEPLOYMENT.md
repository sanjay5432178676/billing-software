# Netlify Deployment Guide

## ⚠️ Important: Netlify Limitations
Netlify only hosts **static frontend sites**. Your FastAPI backend and MongoDB database **cannot run on Netlify**.

## 🚀 Recommended Deployment Strategy

### Frontend → Netlify (Free)
1. Push your code to GitHub
2. Go to https://app.netlify.com and click "Add new site" → "Import from Git"
3. Select your repository
4. Build settings (already configured in `netlify.toml`):
   - Base directory: `frontend/`
   - Build command: `yarn build`
   - Publish directory: `frontend/build`
5. **Important**: Add environment variable in Netlify:
   - `REACT_APP_BACKEND_URL` = `https://your-backend-url.com`
6. Deploy!

### Backend → Choose One:
- **Render.com** (Free tier available) — Recommended
- **Railway.app** (Free trial, then paid)
- **Fly.io** (Free tier available)
- **Emergent Platform** (current — already deployed)

### MongoDB → MongoDB Atlas (Free)
1. Sign up at https://www.mongodb.com/cloud/atlas
2. Create a free M0 cluster
3. Get connection string
4. Set `MONGO_URL` in your backend host's env variables

## 📦 Files Created for Netlify
- `/app/netlify.toml` — Build configuration
- `/app/frontend/public/_redirects` — SPA routing support

## 🔄 After Deployment
Update your backend's CORS settings to allow your Netlify domain:
```python
allow_origins=["https://your-app.netlify.app"]
```
