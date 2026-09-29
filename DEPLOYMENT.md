# CivicConnect Deployment & Environment Guide

---

## 1. Environment Configuration

Copy `.env.example` to `.env` in the project root:

```ini
# Server Configuration
PORT=5177
NODE_ENV=production

# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=civic-b6108.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=civic-b6108
VITE_FIREBASE_STORAGE_BUCKET=civic-b6108.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1089270081878
VITE_FIREBASE_APP_ID=1:1089270081878:web:...

# Cloudinary Storage Configuration
CLOUDINARY_CLOUD_NAME=drh583xwf
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Backend AI Services (Server-Side Only - Never expose in frontend)
GEMINI_API_KEY=AIzaSy...
```

---

## 2. Local Development & Verification

### Running the Application Locally
```bash
# 1. Install dependencies
npm install

# 2. Run backend and frontend concurrently
npm run dev:all

# Frontend: http://localhost:5173
# Backend API: http://localhost:5177
```

### Running the Automated End-to-End Test Suite
```bash
node test_canonical_workflow.mjs
```

---

## 3. Firebase Cloud Deployment

CivicConnect is configured with `firebase.json` to route `/api/**` traffic directly to the backend Cloud Function or container, while serving the React SPA on all other routes.

### Deploying Hosting (Frontend):
```bash
# Build the production bundle
npm run build

# Deploy hosting to Firebase
firebase deploy --only hosting
```

### Deploying Firestore Rules:
```bash
firebase deploy --only firestore:rules
```

### Deploying Cloud Functions:
```bash
firebase deploy --only functions
```

---

## 4. Cloud Container Deployment (Render / Docker)

The repository includes a production-ready `Dockerfile` and `render.yaml`.

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 5177
CMD ["npm", "start"]
```

---

## 5. Rollback Procedures

### Frontend Rollback:
```bash
firebase hosting:rollback
```

### AI Model Rollback:
1. Navigate to **Admin Console** $\rightarrow$ **AI Model Config**.
2. Select the previous stable version (e.g., `gemini-2.5-flash-v1` or `civicconnect-deberta-v3-prod`).
3. Click **Rollback to Candidate**. The AI Gateway immediately updates its active pointer in `system_config/ai`.
