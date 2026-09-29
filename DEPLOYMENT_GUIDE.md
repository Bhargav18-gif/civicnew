# CivicConnect Backend Deployment Guide

This guide explains how to deploy your **CivicConnect Express Backend** to free cloud hosting platforms (such as Render or Railway), and how to connect your Firebase account if you choose Firebase Functions.

---

## Why `npm build` Failed Previously
1. In npm, the command is **`npm run build`** (not `npm build`).
2. The actual project is located inside `CIVIC-CONNECT-DRAFT-main/CivicConnect-master`. A root proxy has now been added so `npm run build` and `npm start` work from both the root directory and the project directory.

---

## Option 1: Deploy to Render (Recommended Free Web Service)

Render provides free hosting for Node.js web applications with automatic HTTPS.

### Step 1: Push your project to GitHub
If you haven't already, push this folder to your GitHub repository:
```bash
git init
git add .
git commit -m "Configure CivicConnect backend for cloud deployment"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

### Step 2: Create a Web Service on Render
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** > **Web Service**.
2. Connect your GitHub repository.
3. Configure the settings:
   - **Name**: `civicconnect-api`
   - **Root Directory**: *(Leave blank/empty — do not enter anything)*
   - **Runtime / Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
4. Under **Advanced** / **Health Check Path**, enter:
   `/health`
5. Click **Create Web Service**.

Once deployed, Render gives you a public URL like:
`https://civicconnect-api.onrender.com`

---

## Option 2: Deploy to Railway

1. Go to [Railway.app](https://railway.app/).
2. Click **New Project** > **Deploy from GitHub repo**.
3. Select your repository. Railway automatically detects Node.js and uses the `Dockerfile` or `npm start`.
4. Under **Settings** > **Networking**, click **Generate Domain** to get your public API URL (e.g. `https://civicconnect-production.up.railway.app`).

---

## Connecting the Frontend to the Deployed Backend

Once your backend is deployed:
1. In your frontend configuration or `.env` file, set:
   ```env
   VITE_API_URL=https://your-deployed-backend.onrender.com/api
   VITE_USE_MOCK_API=false
   ```
2. Re-build and deploy your frontend:
   ```bash
   npm run build
   ```

---

## Option 3: Deploying with Firebase (If using Cloud Functions)

If you decide to deploy via Firebase Cloud Functions using your `civic-b6108` project:

1. **Log in with the Google Account that has access to `civic-b6108`**:
   ```bash
   firebase login --reauth
   ```
2. **Verify project access**:
   ```bash
   firebase projects:list
   ```
3. **Select your project**:
   ```bash
   cd CIVIC-CONNECT-DRAFT-main/CivicConnect-master
   firebase use civic-b6108
   ```
4. **Deploy functions**:
   ```bash
   firebase deploy --only functions
   ```
*(Note: Cloud Functions requires the Firebase Blaze pay-as-you-go billing plan).*
