# 🏛️ CivicConnect — Intelligent Municipal Governance & Grievance Redressal Platform

[![CI/CD Pipeline](https://github.com/Bhargav18-gif/civicnew/actions/workflows/civicconnect-tests.yml/badge.svg)](https://github.com/Bhargav18-gif/civicnew/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/React-19.0.0-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF.svg)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Database-Supabase_PostgreSQL-3ECF8E.svg)](https://supabase.com/)

CivicConnect is an enterprise-grade civic grievance management and intelligent triage platform engineered for modern municipalities. It streamlines the lifecycle of civic issues from citizen submission through automated AI classification, department-level delegation, field engineer execution, and final transparent resolution with photographic verification.

---

## 🚀 Key System Capabilities

- **Multimodal AI Triage**: Automated issue categorization, sentiment analysis, priority assignment, and routing powered by Google Gemini and localized fallback NLP models.
- **Role-Based Workflows**: Tailored portals with strict access control and real-time state machines:
  - **Citizen Portal**: Multi-step issue filing with image uploads, GPS geocoding, multi-language support (9 Indian languages), and real-time status tracking.
  - **Department Coordinator Dashboard**: Department-isolated queue management, SLA tracking, engineer task assignment, and duplicate resolution.
  - **Field Operations Engineer Portal**: Mobile-responsive field interface with location mapping, status updates, and photographic resolution proof upload.
  - **Master Admin Operations**: City-wide oversight, cross-department analytics, AI model hyperparameter tuning, and user role management.
  - **Public Transparency Hub**: Interactive GIS live map displaying verified resolution metrics and active civic clusters.
- **Enterprise Security**: Role-based access control (RBAC), Firebase Auth JWT verification, PostgreSQL Row-Level Security (RLS), CSP headers, and rate-limiting middleware.
- **Comprehensive Quality Assurance**: Automated Playwright E2E testing, API integration tests, Lighthouse performance audits, OWASP ZAP security scans, and Autocannon load benchmarks.

---

## 🛠️ Architecture & Tech Stack

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             CIVICCONNECT                                 │
└──────────────────────────────────────────────────────────────────────────┘
       │                                     │                       │
 ┌─────▼──────────┐                   ┌──────▼─────────┐      ┌──────▼─────────┐
 │ Frontend UI    │                   │ Backend & API  │      │ Data & AI      │
 ├────────────────┤                   ├────────────────┤      ├────────────────┤
 │ React 19       │ ──REST / JSON───► │ Node.js Express│ ───► │ Supabase Postgres│
 │ Vite 6         │                   │ Firebase Funcs │      │ Google Gemini  │
 │ Tailwind CSS   │                   │ JWT & RBAC Auth│      │ Realtime PubSub│
 │ Lucide & Leaflet│                  │ Rate Limiting  │      │ Cloudinary CDN │
 └────────────────┘                   └────────────────┘      └────────────────┘
```

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS v4, Framer Motion, GSAP, React Leaflet, Lucide Icons, Recharts |
| **Backend & APIs** | Node.js, Express 5, Firebase Cloud Functions, RESTful Architecture, CORS, Multer |
| **Database & Auth** | Supabase (PostgreSQL 15), Firebase Authentication (JWT Verification), Row Level Security |
| **AI / ML & Storage** | Google Gemini Flash, Cloudinary Cloud Storage, Local NLP Classifier |
| **Testing & CI/CD** | Playwright, Autocannon, Google Lighthouse, OWASP ZAP Security Scanner, GitHub Actions |

---

## 📂 Repository Structure

```
civicconnect/
├── .github/
│   └── workflows/
│       └── civicconnect-tests.yml    # Automated CI/CD test workflow
├── functions/                        # Firebase Cloud Functions & backend handlers
│   ├── routes/                       # Express REST API route handlers
│   ├── services/                     # Business logic and AI services
│   ├── ai.js                         # AI classification & vision processing
│   ├── authMiddleware.js             # JWT authentication & RBAC middleware
│   └── db.js                         # Supabase database client and pooling
├── public/                           # Static assets, videos, and icons
├── screenshots/                      # High-resolution application screenshots
├── scripts/                          # Test runners and report consolidators
├── security/                         # OWASP ZAP security configurations
├── server/                           # Standalone Express development server
├── src/                              # React application source code
│   ├── components/                   # UI components by domain (admin, citizen, etc.)
│   ├── context/                      # React context providers (Auth, Language)
│   ├── i18n/                         # Localization dictionaries (9 languages)
│   ├── pages/                        # View controllers & route pages
│   ├── services/                     # Frontend API services & Supabase client
│   └── styles/                       # Global stylesheet and Tailwind tokens
├── supabase/                         # Database migrations and RLS policies
└── tests/                            # Test automation suite
    ├── ai/                           # AI classification accuracy tests
    ├── api/                          # Backend API endpoint tests
    ├── e2e/                          # End-to-end user workflow tests
    ├── load/                         # High-concurrency performance benchmarks
    ├── performance/                  # Lighthouse core web vitals tests
    └── security/                     # OWASP security vulnerability scanner
```

---

## 🚦 Getting Started

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Git**

### 2. Clone and Install Dependencies

```bash
git clone https://github.com/Bhargav18-gif/civicnew.git
cd civicnew
npm install
```

### 3. Environment Setup

Copy `.env.example` to `.env` and provide your credentials:

```bash
cp .env.example .env
```

Configure your environment variables:
- `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`
- `GEMINI_API_KEY`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### 4. Running the Development Server

Start both the backend API server (`port 5177`) and Vite frontend dev server (`port 5173`) concurrently:

```bash
npm run dev:all
```

- Frontend Application: `http://localhost:5173`
- Backend API Server: `http://localhost:5177/api`

---

## 🧪 Comprehensive Test Suite

CivicConnect includes an automated testing framework covering all operational aspects:

```bash
# Run End-to-End browser tests (Playwright)
npm run test:e2e

# Run Backend API integration tests
npm run test:api

# Run AI classification & fallback accuracy tests
npm run test:ai

# Run Security vulnerability scans (OWASP ZAP & headers)
npm run test:security

# Run Concurrency and load benchmarks (Autocannon)
npm run test:load

# Run Lighthouse performance & Core Web Vitals audit
npm run test:performance

# Run full unified test suite
npm run test:all
```

---

## 🛡️ Security & Compliance

- **Authentication**: JWT token verification on all protected API endpoints with role claims (`citizen`, `department_head`, `engineer`, `admin`).
- **Data Isolation**: Multi-tenant department isolation enforced at the database query layer and backend middleware.
- **Input Sanitization**: Strict payload validation against schema definitions to prevent SQL injection and XSS.
- **Transport Security**: HTTPS and strict Content Security Policy (CSP) headers enabled.

---

## 📖 Detailed Documentation

- [System Architecture](ARCHITECTURE.md)
- [API Contract & Endpoints](API_CONTRACT.md)
- [Security Policy & Standards](SECURITY.md)
- [Testing & Quality Assurance](TESTING.md)
- [Complaint Lifecycle & Workflow](WORKFLOW.md)
- [Deployment Guide](DEPLOYMENT.md)

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
