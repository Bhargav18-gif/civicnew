# 🏛️ CivicConnect — Project Engineering Divisions & Team Ownership Matrix

This document outlines the architectural division of **CivicConnect** across **4 specialized engineering roles/team members**. Each division represents a distinct, high-impact technical pillar of the project with clear code ownership, system deliverables, and presentation talking points.

---

## 👥 Executive Division Summary

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             CIVICCONNECT ARCHITECTURE                            │
└──────────────────────────────────────────────────────────────────────────────────┘
         │                           │                          │
 ┌───────▼────────┐          ┌───────▼────────┐         ┌───────▼────────┐
 │   DIVISION 1   │          │   DIVISION 2   │         │   DIVISION 3   │
 │   AI, NLP &    │          │  Backend API,  │         │ Citizen Portal │
 │ Triage Engine  │          │ DB & Security  │         │  & Public GIS  │
 └────────────────┘          └────────────────┘         └────────────────┘
                                     │
                             ┌───────▼────────┐
                             │   DIVISION 4   │
                             │ Department Ops │
                             │ & Field Mobile │
                             └────────────────┘
```

| Division | Role Title | Core Focus & Domain | Code Ownership |
| :--- | :--- | :--- | :--- |
| **Division 1** | **AI / ML & Intelligent Triage Lead** | Multimodal AI classification, zero-shot fallback NLP, priority & SLA engine, automated department routing. | `functions/ai.js`, `functions/nlpClassifier.js`, `functions/priority.js`, `src/pages/admin/AIConfig.jsx` |
| **Division 2** | **Backend API, Database & Security Lead** | Supabase PostgreSQL schema, connection pooling, Firebase Auth JWT verification, RESTful API architecture, audit logs. | `functions/db.js`, `functions/authMiddleware.js`, `server/index.js`, `functions/routes/`, `lib/supabaseAdmin.js` |
| **Division 3** | **Citizen Experience & Public GIS Lead** | Citizen complaint reporting wizard, GIS mapping & spatial clustering, public tracking portal, accessibility & UI design system. | `src/pages/citizen/`, `src/pages/public/`, `src/components/map/`, `src/context/AuthContext.jsx` |
| **Division 4** | **Department Operations & Field Mobility Lead** | Department isolation dashboards, field engineer mobile execution, GPS check-in, real-time WebSocket state machine, E2E test suites. | `src/pages/department/`, `src/pages/engineer/`, `src/pages/admin/`, `test_all_departments_e2e.cjs` |

---

## 📋 Detailed Division Breakdown

### 🧠 DIVISION 1: AI, NLP & Intelligent Triage Engineering
**Focus Area:** Artificial Intelligence, Natural Language Processing, Computer Vision & Automated Decision Engines.

#### 🎯 Key Responsibilities & Deliverables
1. **Multimodal AI Classification Engine**: Built integration with Google Gemini 2.5 Flash for simultaneous textual sentiment and computer vision analysis of citizen complaint images.
2. **Deterministic & NLP Fallback Pipeline**: Developed a local Naive Bayes / TF-IDF classifier trained on 336 municipal issue patterns to ensure $100\%$ zero-latency classification even when external AI networks are unreachable.
3. **Priority & Safety Hazard Assessment Engine**: Built algorithmic rule engines that detect critical keywords (e.g. *live wire, gas leak, severe flooding*) and escalate priority to `CRITICAL` within $<5\text{ ms}$.
4. **Automated Department Routing & Confidence Scoring**: Implemented intelligent threshold routing ($\ge 70\%$ confidence routes directly; $< 70\%$ flags for admin review).
5. **AI Model Control Center UI**: Built admin interface to adjust model temperatures, view classification confusion matrices, and audit AI reasoning logs.

#### 💻 Primary Code Files Owned
- [`functions/ai.js`](file:///d:/civicnew-main/functions/ai.js) — Multimodal Gemini 2.5 Flash integration and prompt engineering.
- [`functions/nlpClassifier.js`](file:///d:/civicnew-main/functions/nlpClassifier.js) — Local TF-IDF Naive Bayes classifier & training dictionary.
- [`functions/priority.js`](file:///d:/civicnew-main/functions/priority.js) — Deterministic priority and SLA deadline calculation logic.
- [`functions/departmentRoutingService.js`](file:///d:/civicnew-main/functions/departmentRoutingService.js) — Routing decision engine.
- [`src/pages/admin/AIConfig.jsx`](file:///d:/civicnew-main/src/pages/admin/AIConfig.jsx) — AI model configuration dashboard.

---

### 🛡️ DIVISION 2: Backend Architecture, Database & Security Engineering
**Focus Area:** Cloud Infrastructure, Relational Database Schema, Authentication, API Security & Scalability.

#### 🎯 Key Responsibilities & Deliverables
1. **Supabase PostgreSQL Relational Schema**: Designed complete normalized database architecture (`complaints`, `users`, `departments`, `assignments`, `audit_logs`, `sla_records`, `notifications`).
2. **Stateless JWT Authentication & RBAC**: Implemented secure dual-layer auth bridging Firebase Authentication ID tokens with Supabase PostgreSQL user roles (`CITIZEN`, `DEPARTMENT`, `ENGINEER`, `ADMIN`).
3. **High-Performance RESTful API Services**: Engineered modular Express router structure handling fast-path ingest, parameter validation, and rate limiting.
4. **Immutable Audit Trail & Compliance Logging**: Implemented automated audit logging on every complaint status change with timestamp, actor ID, and metadata.
5. **Connection Pooling & Query Optimization**: Implemented PgBouncer / Supavisor connection pooling with B-Tree indexes on high-traffic columns (`department_id`, `status`, `assigned_engineer_id`).

#### 💻 Primary Code Files Owned
- [`functions/db.js`](file:///d:/civicnew-main/functions/db.js) — PostgreSQL data access layer & parameterized query handlers.
- [`functions/authMiddleware.js`](file:///d:/civicnew-main/functions/authMiddleware.js) — Firebase Token verification & Role-Based Access Control (RBAC).
- [`functions/lib/supabaseAdmin.js`](file:///d:/civicnew-main/functions/lib/supabaseAdmin.js) — Supabase PostgreSQL client initialization.
- [`functions/routes/issues.js`](file:///d:/civicnew-main/functions/routes/issues.js) — Complaint submission & public tracking routes.
- [`server/index.js`](file:///d:/civicnew-main/server/index.js) & [`functions/index.js`](file:///d:/civicnew-main/functions/index.js) — Express server entry points and middleware.

---

### 🌐 DIVISION 3: Citizen Experience, Public GIS & UI Design System
**Focus Area:** Frontend Architecture, Citizen Grievance Reporting Wizard, GIS Spatial Heatmaps & Public Transparency.

#### 🎯 Key Responsibilities & Deliverables
1. **Citizen Complaint Submission Wizard**: Developed responsive multi-step issue filing interface with real-time GPS coordinate capture, camera photo capture, and interactive preview.
2. **Interactive GIS Public Heatmap**: Built dynamic mapping interface utilizing Leaflet/MapLibre with category-specific custom markers, priority clustering, and spatial search.
3. **Public Real-Time Tracking Portal**: Created zero-friction public status tracking by Reference ID (`CC-YYYY-XXXXXX`) allowing citizens to track progress without logging in.
4. **Design System & Theme Engine**: Established glassmorphism UI design tokens, dark/light theme switching, responsive layouts, and TailwindCSS/Vanilla CSS styling.
5. **Citizen Verification & Feedback Loop**: Created interface for citizens to inspect completed repairs, submit satisfaction ratings ($1\text{ to }5\text{ stars}$), and reopen unresolved issues.

#### 💻 Primary Code Files Owned
- [`src/pages/citizen/ReportIssue.jsx`](file:///d:/civicnew-main/src/pages/citizen/ReportIssue.jsx) — Grievance reporting wizard with geolocation & media upload.
- [`src/pages/citizen/Dashboard.jsx`](file:///d:/civicnew-main/src/pages/citizen/Dashboard.jsx) — Citizen grievance overview & resolution feedback modal.
- [`src/pages/public/PublicMap.jsx`](file:///d:/civicnew-main/src/pages/public/PublicMap.jsx) — Spatial GIS public heatmap.
- [`src/pages/public/PublicTrack.jsx`](file:///d:/civicnew-main/src/pages/public/PublicTrack.jsx) — Public tracking lookup page.
- [`src/pages/public/LandingPage.jsx`](file:///d:/civicnew-main/src/pages/public/LandingPage.jsx) — Public landing page and feature showcase.
- [`src/context/AuthContext.jsx`](file:///d:/civicnew-main/src/context/AuthContext.jsx) — Frontend authentication state provider.

---

### 📱 DIVISION 4: Department Operations, Field Mobility & Real-Time Orchestration
**Focus Area:** Department Workflows, Field Engineer Mobile App, Real-Time State Machine & E2E Testing.

#### 🎯 Key Responsibilities & Deliverables
1. **Strict Department Scoping & Isolation**: Architected the Department Coordinator dashboard ensuring managers can only see and manage grievances within their assigned department (`roads`, `water`, `electricity`, etc.).
2. **Field Operations Mobile Interface**: Built mobile-optimized dashboard for field engineers to view assigned tasks, accept work, navigate to site, and upload Before/After repair photos.
3. **GPS Site Arrival & Field Proof Engine**: Integrated GPS verification confirming engineer is physically on-site before permitting work initiation.
4. **Canonical State Machine Enforcement**: Implemented strict status transition validation:
   $$\text{SUBMITTED} \rightarrow \text{ROUTED} \rightarrow \text{ASSIGNED} \rightarrow \text{ACCEPTED} \rightarrow \text{EN\_ROUTE} \rightarrow \text{ON\_SITE} \rightarrow \text{IN\_PROGRESS} \rightarrow \text{VERIFICATION\_PENDING} \rightarrow \text{CLOSED}$$
5. **Automated Testing & Load Benchmark Suite**: Developed end-to-end multi-department test suites and high-concurrency traffic stress testing suites.

#### 💻 Primary Code Files Owned
- [`src/pages/department/Dashboard.jsx`](file:///d:/civicnew-main/src/pages/department/Dashboard.jsx) — Department Coordinator operations center.
- [`src/components/department/ComplaintDetailDrawer.jsx`](file:///d:/civicnew-main/src/components/department/ComplaintDetailDrawer.jsx) — Department triage, assignment, and verification drawer.
- [`src/pages/engineer/Dashboard.jsx`](file:///d:/civicnew-main/src/pages/engineer/Dashboard.jsx) — Field engineer mobile task manager.
- [`src/services/api/engineerApi.js`](file:///d:/civicnew-main/src/services/api/engineerApi.js) — Engineer API client & GPS verification.
- [`test_all_departments_e2e.cjs`](file:///d:/civicnew-main/test_all_departments_e2e.cjs) — Complete 8-department E2E test suite.
- [`load_test_suite.cjs`](file:///d:/civicnew-main/load_test_suite.cjs) — Real-world traffic and load testing engine.

---

## 🎤 Project Viva & Presentation Talking Points Per Member

### Member 1 (AI & Triage Lead)
> *"I spearheaded the intelligent triage and NLP pipeline. My primary contribution was creating a hybrid AI architecture: using Google Gemini 2.5 Flash for multimodal photo/text analysis, combined with a local Naive Bayes classifier that guarantees zero-latency fallbacks. I also implemented the automated priority scoring algorithm that instantly escalates life safety hazards."*

### Member 2 (Backend & Security Lead)
> *"I designed the cloud backend architecture, database schema, and security framework. I engineered the normalized PostgreSQL schema on Supabase, implemented connection pooling to handle high concurrency, and created the stateless JWT authentication layer that enforces Role-Based Access Control between citizens, department managers, field engineers, and administrators."*

### Member 3 (Citizen Portal & GIS Lead)
> *"I led the citizen-facing web applications, public transparency portal, and spatial GIS integration. I developed the multi-step grievance filing wizard with live GPS geolocation, designed the interactive public heatmap for community awareness, and built the zero-auth public tracking system so citizens can monitor their complaints in real time."*

### Member 4 (Department Ops & Field Lead)
> *"I developed the department management portal, field engineer mobility system, and real-time lifecycle orchestrator. I enforced strict cross-department data isolation, built the mobile-first field engineer workflow with GPS arrival verification and Before/After photo proof, and created the comprehensive automated E2E and load testing suites."*
