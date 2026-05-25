# 🚀 Complete Deployment Guide: Netlify + Render + MongoDB Atlas

Your POS app has 3 parts that need separate hosting (all FREE):
- **Frontend (React)** → Netlify
- **Backend (FastAPI)** → Render.com
- **Database (MongoDB)** → MongoDB Atlas

Total time: ~30 minutes

---

## PART 1: MongoDB Atlas (5 minutes)

### Step 1.1: Create Free Account
1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up with Google/email

### Step 1.2: Create a Free Cluster
1. Click **"Build a Database"**
2. Choose **"M0 FREE"** tier
3. Select any cloud provider (AWS recommended) and region close to you
4. Cluster name: `pos-cluster`
5. Click **"Create Deployment"**

### Step 1.3: Create Database User
1. Username: `posadmin`
2. Password: Click "Autogenerate Secure Password" → **COPY IT SOMEWHERE SAFE**
3. Click **"Create Database User"**

### Step 1.4: Allow Network Access
1. Click **"Add IP Address"**
2. Click **"Allow Access from Anywhere"** (0.0.0.0/0)
3. Click **"Finish and Close"**

### Step 1.5: Get Connection String
1. Click **"Connect"** → **"Drivers"**
2. Copy the connection string. It looks like:
   ```
   mongodb+srv://posadmin:<password>@pos-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
3. **Replace `<password>`** with your saved password
4. **SAVE THIS — you need it for Part 2**

---

## PART 2: Backend on Render.com (10 minutes)

### Step 2.1: Push Code to GitHub
1. Create a GitHub account if you don't have one: https://github.com/signup
2. Create a new repository: https://github.com/new
   - Name: `pos-backend`
   - Public or Private (your choice)
   - Click **"Create repository"**
3. From your local machine, push your `/app/backend` folder to this repo

### Step 2.2: Create Render Account
1. Go to https://render.com/register
2. Sign up with GitHub (easiest)

### Step 2.3: Deploy Backend
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub `pos-backend` repository
3. Configure:
   - **Name**: `pos-backend`
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: **Free**

### Step 2.4: Add Environment Variables
Scroll to **"Environment Variables"** section, add:
- `MONGO_URL` = `<paste your MongoDB Atlas connection string from Step 1.5>`
- `DB_NAME` = `pos_database`
- `CORS_ORIGINS` = `*` (we'll restrict this later)

### Step 2.5: Deploy
1. Click **"Create Web Service"**
2. Wait 3-5 minutes for build
3. Once you see "Live" status, copy your backend URL:
   ```
   https://pos-backend-xxxx.onrender.com
   ```
4. **Test it** by visiting `https://pos-backend-xxxx.onrender.com/api/`
   - You should see: `{"message":"POS API"}`

### Step 2.6: Seed the Database
Visit (or curl): `https://pos-backend-xxxx.onrender.com/api/seed` (POST request)
Or just open your Netlify app once — it auto-seeds on first load.

---

## PART 3: Frontend on Netlify (5 minutes)

### Step 3.1: Push Frontend to GitHub
1. Create another repository: `pos-frontend`
2. Push your `/app/frontend` folder (and `netlify.toml` from `/app/`)

### Step 3.2: Connect to Netlify
1. Go to https://app.netlify.com
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **"Deploy with GitHub"**
4. Select your `pos-frontend` repository

### Step 3.3: Configure Build Settings
Netlify should auto-detect from `netlify.toml`, but verify:
- **Base directory**: `frontend` (or leave blank if you push only the frontend folder contents)
- **Build command**: `yarn build`
- **Publish directory**: `build`

### Step 3.4: Add Environment Variable ⚠️ CRITICAL
Before deploying, click **"Add environment variables"**:
- Key: `REACT_APP_BACKEND_URL`
- Value: `https://pos-backend-xxxx.onrender.com` (your Render URL from Step 2.5)

**⚠️ Without this, you get the "undefined/api/seed" error you saw!**

### Step 3.5: Deploy
1. Click **"Deploy site"**
2. Wait 2-3 minutes
3. You'll get a URL like: `https://your-site-name.netlify.app`

---

## PART 4: Update Backend CORS (1 minute)

For security, restrict backend to only your Netlify URL:

1. Go back to Render → your backend service → **"Environment"**
2. Edit `CORS_ORIGINS` to: `https://your-site-name.netlify.app`
3. Save → service auto-redeploys

---

## ✅ You're Done!

Visit `https://your-site-name.netlify.app` and your POS system is LIVE!

---

## 🐛 Troubleshooting

### Error: `Failed to load resource /undefined/api/...`
→ `REACT_APP_BACKEND_URL` is not set on Netlify. Go to Site Settings → Environment Variables → Add it → Trigger redeploy.

### Error: `CORS policy blocked`
→ Backend CORS doesn't allow your Netlify URL. Update `CORS_ORIGINS` on Render.

### Backend sleeps after inactivity (Render free tier)
→ Render free tier sleeps after 15min idle. First request takes ~30s to wake up. Upgrade to $7/month for always-on, or use a free uptime monitor like UptimeRobot to ping every 14min.

### Products empty after deployment
→ Visit `https://your-backend-url.onrender.com/api/seed` (POST) once to seed sample data.

---

## 💡 Pro Tips

1. **Custom domain**: Both Netlify and Render support free custom domains
2. **Auto-deploys**: Both platforms redeploy automatically when you push to GitHub
3. **Logs**: Check Render logs for backend errors, Netlify deploy logs for frontend errors
4. **MongoDB backups**: Atlas auto-backs up daily on free tier
