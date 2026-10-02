const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUTPUT_PDF = path.join(__dirname, 'CIVICCONNECT_SOURCE_CODE_AND_STRUCTURE.pdf');

function generateDoc() {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 45, right: 45 },
    bufferPages: true,
    autoFirstPage: false
  });

  const writeStream = fs.createWriteStream(OUTPUT_PDF);
  doc.pipe(writeStream);

  // Palette
  const PRIMARY = '#0f172a';      // Slate 900
  const ACCENT = '#0284c7';       // Sky 600
  const SECONDARY = '#334155';    // Slate 700
  const MUTED = '#64748b';        // Slate 500
  const CODE_BG = '#1e293b';      // Slate 800
  const CODE_FG = '#e2e8f0';      // Slate 200
  const CODE_COMMENT = '#94a3b8'; // Slate 400
  const CODE_KEYWORD = '#38bdf8'; // Sky 400
  const BOX_BG = '#f8fafc';       // Slate 50
  const BORDER_CLR = '#cbd5e1';   // Slate 300

  function addCoverPage() {
    doc.addPage();
    // Background accent bar
    doc.rect(0, 0, 595.28, 12).fill(ACCENT);

    doc.moveDown(4);
    doc.fillColor(ACCENT).fontSize(12).font('Helvetica-Bold').text('TECHNICAL ARCHITECTURE & SOURCE CODE GUIDE', { align: 'center', characterSpacing: 2 });
    doc.moveDown(0.8);
    doc.fillColor(PRIMARY).fontSize(26).font('Helvetica-Bold').text('CivicConnect Platform', { align: 'center' });
    doc.moveDown(0.3);
    doc.fillColor(MUTED).fontSize(12).font('Helvetica').text('Comprehensive Project File Structure & Core Source Code Reference', { align: 'center' });

    doc.moveDown(2);
    doc.strokeColor(BORDER_CLR).lineWidth(1).moveTo(80, doc.y).lineTo(515, doc.y).stroke();
    doc.moveDown(2);

    // Metadata card
    const boxY = doc.y;
    doc.rect(60, boxY, 475, 140).fillAndStroke(BOX_BG, BORDER_CLR);

    doc.fillColor(PRIMARY).fontSize(10).font('Helvetica-Bold').text('Document Overview', 75, boxY + 15);
    doc.fillColor(SECONDARY).fontSize(9).font('Helvetica')
      .text('• System: Citizen Grievance Redressal & Smart City AI Dispatcher', 75, boxY + 35)
      .text('• Tech Stack: React 19, Vite, Tailwind CSS, Node.js/Express, Supabase (PostgreSQL), Firebase Auth', 75, boxY + 52)
      .text('• AI/ML Engine: Google Gemini 2.0 / GenAI, TF-IDF Text Classification, Haversine Duplicate Detection', 75, boxY + 69)
      .text('• Architecture: Clean 3-Tier Multi-Tenant SaaS with Realtime State Machine & GIS Geofencing', 75, boxY + 86)
      .text('• Generated Date: October 2026 | Production Build Release v1.0.0', 75, boxY + 103);

    doc.y = boxY + 170;

    // Table of contents box
    doc.rect(60, doc.y, 475, 260).fillAndStroke('#ffffff', BORDER_CLR);
    const tocY = doc.y - 250;
    doc.fillColor(ACCENT).fontSize(11).font('Helvetica-Bold').text('TABLE OF CONTENTS', 75, tocY);
    doc.moveDown(0.6);

    const items = [
      ['1. System Architecture & High-Level Technology Stack', 'Page 2'],
      ['2. Complete Project File Directory Hierarchy', 'Page 2'],
      ['3. Frontend Application Routing & Role Gates (src/App.jsx)', 'Page 3'],
      ['4. Production Server Entry & Express API (server/index.js & functions/index.js)', 'Page 4'],
      ['5. Database Layer & PostgreSQL Schema Client (functions/db.js)', 'Page 5'],
      ['6. Workflow State Machine & Finite Role Definitions (src/constants/workflow.js)', 'Page 6'],
      ['7. AI/ML Categorization & Duplicate Detection Pipeline (functions/ai.js)', 'Page 7'],
      ['8. REST API Contracts, Endpoints & Security Specification', 'Page 8']
    ];

    items.forEach(([label, p]) => {
      doc.fillColor(PRIMARY).fontSize(8.5).font('Helvetica-Bold').text(label, 75, doc.y, { continued: true, width: 370 });
      doc.fillColor(MUTED).font('Helvetica').text(` ${p}`, { align: 'right', width: 440 });
      doc.moveDown(0.4);
    });
  }

  function addHeader(sectionTitle) {
    doc.rect(0, 0, 595.28, 6).fill(ACCENT);
    doc.fillColor(MUTED).fontSize(7.5).font('Helvetica').text('CivicConnect Technical Source Code Guide', 45, 18, { align: 'left' });
    doc.fillColor(ACCENT).fontSize(7.5).font('Helvetica-Bold').text(sectionTitle, 45, 18, { align: 'right' });
    doc.strokeColor(BORDER_CLR).lineWidth(0.5).moveTo(45, 28).lineTo(550, 28).stroke();
    doc.y = 42;
  }

  function addSectionHeading(num, title) {
    doc.fillColor(ACCENT).fontSize(8.5).font('Helvetica-Bold').text(`SECTION ${num}`, { characterSpacing: 1 });
    doc.fillColor(PRIMARY).fontSize(13).font('Helvetica-Bold').text(title);
    doc.strokeColor(ACCENT).lineWidth(1.5).moveTo(45, doc.y + 2).lineTo(140, doc.y + 2).stroke();
    doc.moveDown(0.6);
  }

  function addSubHeading(title) {
    doc.fillColor(PRIMARY).fontSize(9.5).font('Helvetica-Bold').text(title);
    doc.moveDown(0.3);
  }

  function addParagraph(text) {
    doc.fillColor(SECONDARY).fontSize(8).font('Helvetica').lineGap(2).text(text, { align: 'justify' });
    doc.moveDown(0.4);
  }

  function addCodeBlock(code, lang = 'javascript') {
    const lines = code.trim().split('\n');
    const lineHeight = 10;
    const blockHeight = (lines.length * lineHeight) + 16;
    
    // Check page overflow
    if (doc.y + blockHeight > 780) {
      doc.addPage();
      addHeader('Source Code Listing');
    }

    const startY = doc.y;
    doc.rect(45, startY, 505, blockHeight).fillAndStroke(CODE_BG, '#334155');
    
    doc.fillColor(CODE_FG).fontSize(6.8).font('Courier');
    lines.forEach((line, i) => {
      const lineY = startY + 8 + (i * lineHeight);
      let color = CODE_FG;
      if (line.trim().startsWith('//') || line.trim().startsWith('#') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
        color = CODE_COMMENT;
      } else if (line.includes('import ') || line.includes('export ') || line.includes('const ') || line.includes('function ') || line.includes('return ') || line.includes('async ') || line.includes('await ')) {
        color = CODE_KEYWORD;
      }
      doc.fillColor(color).text(line, 55, lineY, { width: 485, lineBreak: false });
    });

    doc.y = startY + blockHeight + 8;
  }

  // PAGE 1: COVER
  addCoverPage();

  // PAGE 2: TECH STACK & FILE STRUCTURE
  doc.addPage();
  addHeader('Section 1 & 2: Architecture & File Hierarchy');
  addSectionHeading('1', 'System Architecture & High-Level Tech Stack');
  addParagraph('CivicConnect is built as an enterprise-grade civic grievance redressal portal. The system uses a modern 3-tier architecture with Supabase PostgreSQL as the primary single-source-of-truth datastore, Firebase Authentication for role-based JWT issuance, Google Gemini AI for automated categorization and severity scoring, and React 19 for a high-performance, accessible citizen/admin UI.');

  addSubHeading('Core Technology Components');
  doc.fillColor(SECONDARY).fontSize(8).font('Helvetica')
    .text('• Frontend: React 19, Vite 6, Tailwind CSS 4, Framer Motion, Leaflet GIS Maps, Recharts, Lucide Icons', { lineGap: 2 })
    .text('• Backend API: Node.js / Express 5 with modular micro-handlers (Cloud Functions / Containerized)', { lineGap: 2 })
    .text('• Database & Storage: Supabase PostgreSQL (Structured relational schema) + Cloudinary Media Storage', { lineGap: 2 })
    .text('• AI Engine: Google Gemini 2.0 / GenAI SDK, TF-IDF NLP model, Haversine Spatio-Temporal Duplicate Filter', { lineGap: 2 })
    .text('• Realtime & Auth: Firebase Auth (RBAC Custom Claims) + Supabase Realtime WebSocket Channels', { lineGap: 2 });
  doc.moveDown(0.6);

  addSectionHeading('2', 'Complete Project Directory Structure');
  const treeText = `civicnew-main/
├── .agents/                 # AI Assistant skills & custom guidelines
├── ai/                      # Machine Learning Training, Datasets & Models
│   ├── dataset/             # Categorization and severity labeled data
│   ├── model/               # Serialized classifier weights
│   └── src/                 # Training & inference Python scripts
├── functions/               # Modular Express API & Cloud Functions
│   ├── index.js             # API Router & Express application configuration
│   ├── authMiddleware.js    # Firebase JWT verification & role authorization
│   ├── db.js                # Supabase PostgreSQL client & query engine
│   ├── ai.js                # Gemini AI triage & automated classification
│   ├── complaintsHandler.js # Complaint lifecycle CRUD & status transition
│   ├── departmentRoutingService.js # Department dispatch & SLA escalation
│   ├── departmentsHandler.js # Department queues, engineers & analytics
│   ├── engineerHandler.js   # Field engineer updates & photo verification
│   ├── adminHandler.js      # System analytics, user administration & logs
│   ├── duplicates.js        # Geolocation (Haversine) & similarity analysis
│   └── workflow.js          # Complaint Finite State Machine validator
├── server/                  # Standalone Node.js production web server
│   └── index.js             # Express HTTP bootstrap listener (Port 5177)
├── src/                     # React 19 Frontend Application (Vite SPA)
│   ├── main.jsx             # React DOM root mounting
│   ├── App.jsx              # Global route dispatcher & role protection
│   ├── firebase.js          # Firebase SDK client initialization
│   ├── components/          # Modular UI components (auth, admin, dept, ui)
│   ├── constants/           # Workflow status, SLA timers, and RBAC roles
│   ├── pages/               # Route views (Landing, Report, Dashboard, Admin)
│   ├── services/            # API integrations (Supabase, Cloudinary, AI)
│   └── styles/              # Global Tailwind CSS and styling themes
├── supabase/                # PostgreSQL schema migrations & DDL
├── firestore.rules          # Security and authorization rules
├── package.json             # Root dependency configuration & scripts
└── vite.config.js           # Vite build pipeline & alias configurations`;

  addCodeBlock(treeText, 'text');

  // PAGE 3: FRONTEND ROUTING & ACCESS CONTROL
  doc.addPage();
  addHeader('Section 3: Frontend Application Router');
  addSectionHeading('3', 'Frontend Application Routing & Role Gates (src/App.jsx)');
  addParagraph('The frontend router controls application navigation and strictly enforces Role-Based Access Control (RBAC). Routes are partitioned into Public (Landing, Track, Auth), Citizen Protected (Grievance Submission, Tracking), Department Officer, Field Engineer, and Super Administrator views.');

  addSubHeading('Source Code: src/App.jsx');
  const appJsxCode = `import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import AuroraBackground from "./components/layout/AuroraBackground.jsx";

// Citizen / Public Pages
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ReportIssuePage from "./pages/ReportIssuePage.jsx";
import TrackComplaintPage from "./pages/TrackComplaintPage.jsx";

// Role-protected Route Guards
import ProtectedRoute from "./components/auth/ProtectedRoute.jsx";
import RoleRoute from "./components/auth/RoleRoute.jsx";
import AdminRoute from "./components/auth/AdminRoute.jsx";
import { ROLES } from "./constants/workflow.js";

// Role-specific Dashboards
import AdminDashboardPage from "./pages/admin/Dashboard.jsx";
import DepartmentDashboard from "./pages/department/Dashboard.jsx";
import EngineerDashboard from "./pages/engineer/Dashboard.jsx";

export default function App() {
  const location = useLocation();

  return (
    <>
      <AuroraBackground />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/track" element={<TrackComplaintPage />} />

          {/* Citizen Protected Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/report" element={<ProtectedRoute><ReportIssuePage /></ProtectedRoute>} />

          {/* Department Protected Routes */}
          <Route path="/department/dashboard" element={<RoleRoute allowedRoles={[ROLES.DEPARTMENT]}><DepartmentDashboard /></RoleRoute>} />

          {/* Engineer Protected Routes */}
          <Route path="/engineer/dashboard" element={<RoleRoute allowedRoles={[ROLES.ENGINEER]}><EngineerDashboard /></RoleRoute>} />

          {/* Admin Protected Routes */}
          <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
        </Routes>
      </AnimatePresence>
    </>
  );
}`;
  addCodeBlock(appJsxCode);

  // PAGE 4: SERVER ENTRY & API ROUTER
  doc.addPage();
  addHeader('Section 4: Backend Server & Express Router');
  addSectionHeading('4', 'Production Server & API Router (server/index.js & functions/index.js)');
  addParagraph('The backend utilizes Express 5 mounted over HTTP and Cloud Functions. It coordinates database persistence, Google Gemini AI triage, geospatial clustering, and Firebase user session validation.');

  addSubHeading('Source Code: server/index.js');
  const serverIndexCode = `import express from "express";
import http from "http";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { app } = require("../functions/index.js");

const PORT = process.env.PORT || 5177;
const server = http.createServer(app);

server.listen(PORT, "0.0.0.0", () => {
  console.log(" CivicConnect Production Backend API Server Online");
  console.log(\` Port: \${PORT} (0.0.0.0)\`);
  console.log(" Single Source of Truth: Supabase PostgreSQL & Firebase Auth");
});

export default app;`;
  addCodeBlock(serverIndexCode);

  addSubHeading('Source Code: functions/index.js (Route Registration Summary)');
  const functionsIndexCode = `const express = require("express");
const cors = require("cors");
const { authenticateUser, requireRole } = require("./authMiddleware");
const complaintsHandler = require("./complaintsHandler");
const adminHandler = require("./adminHandler");
const engineerHandler = require("./engineerHandler");

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Public & Citizen Endpoints
app.post("/api/complaints/submit", authenticateUser, complaintsHandler.submitComplaint);
app.get("/api/complaints/my", authenticateUser, complaintsHandler.getUserComplaints);
app.get("/api/complaints/track/:trackingId", complaintsHandler.trackComplaint);

// Department & Engineer Workflow Endpoints
app.get("/api/department/complaints", authenticateUser, requireRole(["department", "admin"]), complaintsHandler.getDepartmentComplaints);
app.post("/api/engineer/work-update", authenticateUser, requireRole(["engineer"]), engineerHandler.postWorkUpdate);

// Admin Control Endpoints
app.get("/api/admin/metrics", authenticateUser, requireRole(["admin"]), adminHandler.getSystemMetrics);
app.post("/api/admin/reassign", authenticateUser, requireRole(["admin"]), adminHandler.reassignComplaint);

module.exports = { app };`;
  addCodeBlock(functionsIndexCode);

  // PAGE 5: DATABASE LAYER & SUPABASE CLIENT
  doc.addPage();
  addHeader('Section 5: Supabase Database Layer');
  addSectionHeading('5', 'Database Client & PostgreSQL Schema (functions/db.js)');
  addParagraph('All persistent business entities (Complaints, Users, Departments, Timeline Events, Audit Logs) are stored in Supabase PostgreSQL with strict relational foreign keys and indices.');

  addSubHeading('Source Code: functions/db.js (Supabase Client & Query Layer)');
  const dbCode = `const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("CRITICAL: Missing Supabase environment credentials");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Database Access Object (DAO)
const db = {
  // Complaints Collection
  async createComplaint(complaintData) {
    const { data, error } = await supabase.from("complaints").insert([complaintData]).select().single();
    if (error) throw error;
    return data;
  },

  async getComplaintById(id) {
    const { data, error } = await supabase.from("complaints").select("*, department:departments(*)").eq("id", id).single();
    if (error) throw error;
    return data;
  },

  async updateComplaintStatus(id, status, metadata = {}) {
    const { data, error } = await supabase.from("complaints").update({ status, updated_at: new Date().toISOString(), ...metadata }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }
};

module.exports = { supabase, db };`;
  addCodeBlock(dbCode);

  // PAGE 6: WORKFLOW STATE MACHINE
  doc.addPage();
  addHeader('Section 6: Workflow & Finite State Machine');
  addSectionHeading('6', 'Workflow State Machine & Constants (src/constants/workflow.js)');
  addParagraph('To guarantee data integrity and SLA adherence, all grievance transitions obey a deterministic Finite State Machine (FSM). Unauthorized skips (e.g., jumping from SUBMITTED directly to RESOLVED without assignment) are blocked at the schema and middleware level.');

  addSubHeading('Source Code: src/constants/workflow.js');
  const workflowCode = `export const ROLES = {
  CITIZEN: "citizen",
  DEPARTMENT: "department",
  ENGINEER: "engineer",
  ADMIN: "admin"
};

export const COMPLAINT_STATUS = {
  SUBMITTED: "SUBMITTED",
  TRIAGED: "TRIAGED",
  ASSIGNED: "ASSIGNED",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
  REJECTED: "REJECTED",
  DUPLICATE: "DUPLICATE"
};

export const VALID_STATUS_TRANSITIONS = {
  SUBMITTED: ["TRIAGED", "REJECTED", "DUPLICATE"],
  TRIAGED: ["ASSIGNED", "REJECTED"],
  ASSIGNED: ["IN_PROGRESS", "TRIAGED"],
  IN_PROGRESS: ["RESOLVED", "ASSIGNED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
  REJECTED: [],
  DUPLICATE: []
};

export const SEVERITY_LEVELS = {
  LOW: { label: "Low", slaHours: 72, color: "#10b981" },
  MEDIUM: { label: "Medium", slaHours: 48, color: "#f59e0b" },
  HIGH: { label: "High", slaHours: 24, color: "#f97316" },
  CRITICAL: { label: "Critical", slaHours: 6, color: "#ef4444" }
};`;
  addCodeBlock(workflowCode);

  // PAGE 7: AI & ML PIPELINE
  doc.addPage();
  addHeader('Section 7: AI/ML Classification & Deduplication');
  addSectionHeading('7', 'AI Categorization & Duplicate Detection (functions/ai.js)');
  addParagraph('CivicConnect utilizes Google Gemini 2.0 to automatically analyze incoming grievance descriptions, classify them into appropriate civic municipal departments, assign urgency levels, and evaluate geospatial proximity against existing complaints.');

  addSubHeading('Source Code: functions/ai.js (Gemini AI Grievance Triage)');
  const aiCode = `const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function categorizeComplaint(title, description, imageUrl = null) {
  const prompt = \`
Analyze this civic issue and return a structured JSON response:
Title: "\${title}"
Description: "\${description}"

Format your response strictly as JSON with the following keys:
- department: "Roads & Transport" | "Water Supply" | "Sanitation" | "Electricity" | "Public Works"
- category: Short category name (e.g., "Pothole", "Pipeline Leak")
- priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
- confidence: number between 0.0 and 1.0
- summary: one-sentence summary
\`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Categorization Fallback:", error.message);
    return {
      department: "Public Works",
      category: "General Grievance",
      priority: "MEDIUM",
      confidence: 0.5,
      summary: title
    };
  }
}

module.exports = { categorizeComplaint };`;
  addCodeBlock(aiCode);

  // PAGE 8: API CONTRACT & SECURITY
  doc.addPage();
  addHeader('Section 8: REST API Contracts & Security');
  addSectionHeading('8', 'REST API Contracts & Production Security');
  addParagraph('Every request is subject to cryptographic validation, SQL injection prevention, rate limiting, and RBAC token evaluation.');

  addSubHeading('Key REST API Endpoints Summary');
  const endpoints = [
    ['POST /api/complaints/submit', 'Bearer JWT (Citizen)', 'Submits new complaint; runs AI triage & duplicate check.'],
    ['GET /api/complaints/track/:id', 'Public / Anonymous', 'Fetches complaint public timeline and real-time status.'],
    ['PATCH /api/complaints/:id/status', 'Bearer JWT (Dept/Admin)', 'Applies state transition obeying FSM constraints.'],
    ['POST /api/engineer/work-update', 'Bearer JWT (Engineer)', 'Submits geolocated photo proof and status update.'],
    ['GET /api/admin/metrics', 'Bearer JWT (Admin)', 'Aggregated municipal performance indicators & SLA compliance.']
  ];

  const tableTop = doc.y;
  doc.rect(45, tableTop, 505, 140).fillAndStroke(BOX_BG, BORDER_CLR);
  doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold');
  doc.text('Endpoint & Method', 55, tableTop + 10);
  doc.text('Authorization', 220, tableTop + 10);
  doc.text('Description', 350, tableTop + 10);
  doc.strokeColor(BORDER_CLR).lineWidth(0.5).moveTo(45, tableTop + 24).lineTo(550, tableTop + 24).stroke();

  endpoints.forEach((ep, idx) => {
    const rowY = tableTop + 32 + (idx * 20);
    doc.fillColor(ACCENT).fontSize(7.5).font('Courier-Bold').text(ep[0], 55, rowY);
    doc.fillColor(SECONDARY).fontSize(7.5).font('Helvetica').text(ep[1], 220, rowY);
    doc.fillColor(MUTED).fontSize(7.5).font('Helvetica').text(ep[2], 350, rowY, { width: 190 });
  });

  doc.y = tableTop + 160;
  addSubHeading('Security and Integrity Protections');
  doc.fillColor(SECONDARY).fontSize(8).font('Helvetica')
    .text('1. Firebase JWT Token Verification: Cryptographic verification of user UID and custom claims on every protected API call.', { lineGap: 2 })
    .text('2. Parameterized SQL Queries: Supabase PostgREST and DAO layer guarantee zero SQL injection vulnerabilities.', { lineGap: 2 })
    .text('3. Input Sanitization & Content Verification: Image uploads and text fields are sanitized and checked against size limits.', { lineGap: 2 })
    .text('4. Immutable Audit Logs: Every status update and re-assignment generates a permanent audit trail entry in the database.', { lineGap: 2 });

  // Add Page Numbers to all pages
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    if (i > 0) {
      doc.fillColor(MUTED).fontSize(7.5).font('Helvetica')
        .text(`Page ${i + 1} of ${totalPages}`, 45, 800, { align: 'center', width: 505 });
    }
  }

  doc.end();
  writeStream.on('finish', () => {
    console.log(`Successfully generated ${OUTPUT_PDF} (${totalPages} pages)`);
  });
}

generateDoc();
