# 🚀 Quick Start - Deploy in 3 Steps

## ⚡ Fastest Path to Live (30 minutes total)

### 1️⃣ Database → MongoDB Atlas (Free)
https://www.mongodb.com/cloud/atlas/register
- Create M0 Free cluster
- Allow IP `0.0.0.0/0`
- Copy connection string

### 2️⃣ Backend → Render.com (Free)
https://render.com → New Web Service → Connect GitHub
- **Build**: `pip install -r requirements.txt`
- **Start**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
- **Env vars**: `MONGO_URL`, `DB_NAME=pos_database`, `CORS_ORIGINS=*`

### 3️⃣ Frontend → Netlify (Free)
https://app.netlify.com → Add new site → Import from GitHub
- Auto-detects `netlify.toml`
- **⚠️ MUST ADD ENV VAR**: `REACT_APP_BACKEND_URL=https://your-render-url.onrender.com`

## 📚 Full Guide
See `DEPLOYMENT_GUIDE.md` for detailed instructions.

## 🚨 The Error You Saw
`Failed to load /undefined/api/seed` = `REACT_APP_BACKEND_URL` not set on Netlify.

**Fix**: Netlify → Site settings → Environment variables → Add `REACT_APP_BACKEND_URL` → Trigger redeploy.
