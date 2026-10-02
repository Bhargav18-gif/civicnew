/**
 * Generate CivicConnect 4-Member Project Division & Contributions PDF
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 40, bottom: 40, left: 45, right: 45 },
  info: {
    Title: 'CivicConnect — Project Team Divisions & Individual Contributions',
    Author: 'CivicConnect Engineering Team',
    Subject: '4-Member Engineering Division, Module Architecture & Ownership Matrix'
  }
});

const outputPath = path.join(__dirname, 'CIVICCONNECT_4_MEMBER_DIVISION_AND_CONTRIBUTIONS.pdf');
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

const COLORS = {
  primary: '#1E3A8A',    // Deep Navy Blue
  secondary: '#0D9488',  // Teal Accent
  dark: '#0F172A',       // Charcoal Black
  gray: '#475569',       // Slate Gray
  lightGray: '#F1F5F9',  // Background Light Slate
  border: '#CBD5E1',     // Border Slate
  cardBg: '#F8FAFC',     // Card Background
  member1: '#7C3AED',    // Purple (AI)
  member2: '#0284C7',    // Blue (Backend)
  member3: '#059669',    // Green (Frontend)
  member4: '#EA580C'     // Orange (Operations)
};

function drawHeader(title, subtitle) {
  doc.rect(45, 40, 505, 70).fill(COLORS.primary);
  doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold').text(title, 55, 52);
  doc.fillColor('#93C5FD').fontSize(10).font('Helvetica').text(subtitle, 55, 78);
  doc.y = 125;
}

function drawSectionTitle(text, color = COLORS.primary) {
  if (doc.y > 700) doc.addPage();
  doc.moveDown(0.5);
  doc.fillColor(color).fontSize(14).font('Helvetica-Bold').text(text);
  doc.strokeColor(color).lineWidth(1.5).moveTo(45, doc.y + 2).lineTo(550, doc.y + 2).stroke();
  doc.moveDown(0.6);
}

// ─── COVER / INTRO PAGE ───────────────────────────────────────────────────────
drawHeader('CIVICCONNECT — 4-MEMBER TEAM DIVISIONS', 'Technical Architecture, Module Ownership & Individual Contribution Matrix');

doc.fillColor(COLORS.dark).fontSize(11).font('Helvetica')
   .text('This specification establishes a clean, non-overlapping architectural division of the CivicConnect Municipal Grievance & Triage Platform across 4 specialized engineering roles. Each division encapsulates a complete subsystem with clear code ownership, architectural responsibilities, and presentation deliverables.');

doc.moveDown(0.8);

// Summary Table Box
const summaryBoxY = doc.y;
doc.rect(45, summaryBoxY, 505, 175).fillAndStroke(COLORS.lightGray, COLORS.border);

doc.fillColor(COLORS.primary).fontSize(12).font('Helvetica-Bold').text('EXECUTIVE DIVISION OVERVIEW', 55, summaryBoxY + 10);

const divisionsSummary = [
  { num: 'Division 1', title: 'AI, NLP & Intelligent Triage Lead', lead: 'Artificial Intelligence & Vision Pipeline', color: COLORS.member1 },
  { num: 'Division 2', title: 'Backend API, Database & Security Lead', lead: 'Cloud Infrastructure, PostgreSQL & Auth', color: COLORS.member2 },
  { num: 'Division 3', title: 'Citizen Portal & Public GIS Lead', lead: 'Frontend UI/UX, Spatial Maps & Tracking', color: COLORS.member3 },
  { num: 'Division 4', title: 'Department Ops & Field Mobility Lead', lead: 'Operations Center, Field Mobile & E2E Testing', color: COLORS.member4 }
];

let rowY = summaryBoxY + 32;
divisionsSummary.forEach((d) => {
  doc.rect(55, rowY, 80, 26).fill(d.color);
  doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold').text(d.num, 60, rowY + 8, { width: 70, align: 'center' });
  
  doc.fillColor(COLORS.dark).fontSize(10).font('Helvetica-Bold').text(d.title, 145, rowY + 3);
  doc.fillColor(COLORS.gray).fontSize(8.5).font('Helvetica').text(d.lead, 145, rowY + 15);
  rowY += 34;
});

doc.y = summaryBoxY + 195;

// Architecture Diagram Flowchart
drawSectionTitle('SYSTEM INTERACTION & DATA FLOW');
doc.fillColor(COLORS.dark).fontSize(9.5).font('Helvetica')
   .text('1. Division 3 captures citizen complaint, geocodes coordinates, and submits to Division 2 API.\n' +
         '2. Division 2 validates stateless Firebase JWT, writes complaint to Supabase PostgreSQL, and triggers Division 1 AI pipeline.\n' +
         '3. Division 1 evaluates Gemini 2.5 Flash / NLP classifier, assigns confidence, calculates SLA priority, and routes to department.\n' +
         '4. Division 4 Department Coordinator assigns field engineer; engineer receives real-time mobile notification, confirms GPS on-site arrival, uploads Before/After evidence, and manager approves resolution.');

// ─── DIVISION 1 DETAIL ────────────────────────────────────────────────────────
doc.addPage();
drawSectionTitle('DIVISION 1: AI, NLP & INTELLIGENT TRIAGE LEAD', COLORS.member1);

doc.fillColor(COLORS.dark).fontSize(10).font('Helvetica-Bold').text('Core Specialization: Machine Learning, NLP, Multimodal Vision & Triage Algorithms');
doc.moveDown(0.4);

const d1Points = [
  'Multimodal Vision & NLP: Integrated Google Gemini 2.5 Flash for simultaneous image recognition and text semantics.',
  'Zero-Latency Local Fallback: Built local Naive Bayes / TF-IDF classifier (336 training patterns across 8 departments).',
  'Automated Priority Engine: Deterministic rule engine for instant safety hazard escalation (<5ms response time).',
  'Confidence-Based Routing: Automated auto-assignment for confidence >= 70%; admin review flag for < 70%.',
  'AI Configuration Dashboard: Admin portal to adjust model temperatures, view confusion matrices, and audit logs.'
];

d1Points.forEach(pt => {
  doc.fillColor(COLORS.member1).fontSize(10).text('• ', { continued: true });
  doc.fillColor(COLORS.dark).fontSize(9.5).font('Helvetica').text(pt);
  doc.moveDown(0.2);
});

doc.moveDown(0.5);
doc.rect(45, doc.y, 505, 60).fillAndStroke(COLORS.cardBg, COLORS.border);
doc.fillColor(COLORS.primary).fontSize(9.5).font('Helvetica-Bold').text('Code Files Owned (Division 1):', 55, doc.y + 8);
doc.fillColor(COLORS.dark).fontSize(8.5).font('Courier')
   .text('functions/ai.js, functions/nlpClassifier.js, functions/priority.js, functions/departmentRoutingService.js, src/pages/admin/AIConfig.jsx', 55, doc.y + 22, { width: 485 });

doc.y += 45;

// ─── DIVISION 2 DETAIL ────────────────────────────────────────────────────────
drawSectionTitle('DIVISION 2: BACKEND API, DATABASE & SECURITY LEAD', COLORS.member2);

doc.fillColor(COLORS.dark).fontSize(10).font('Helvetica-Bold').text('Core Specialization: Cloud Infrastructure, PostgreSQL Schema, JWT Auth & Security');
doc.moveDown(0.4);

const d2Points = [
  'Normalized Database Schema: Engineered Supabase PostgreSQL schema with primary/foreign keys and B-Tree indexes.',
  'Stateless JWT Authentication: Bridged Firebase Auth tokens with Supabase PostgreSQL user roles and permissions.',
  'High-Throughput REST API: Engineered modular Express routers with fast-path ingest (<100ms response time).',
  'Immutable Audit Trail: Automated audit logging on every complaint status change with actor ID, role, and timestamps.',
  'Connection Pooling & Scaling: Configured Supavisor connection pooling for handling 10,000+ pooled connections.'
];

d2Points.forEach(pt => {
  doc.fillColor(COLORS.member2).fontSize(10).text('• ', { continued: true });
  doc.fillColor(COLORS.dark).fontSize(9.5).font('Helvetica').text(pt);
  doc.moveDown(0.2);
});

doc.moveDown(0.5);
doc.rect(45, doc.y, 505, 60).fillAndStroke(COLORS.cardBg, COLORS.border);
doc.fillColor(COLORS.primary).fontSize(9.5).font('Helvetica-Bold').text('Code Files Owned (Division 2):', 55, doc.y + 8);
doc.fillColor(COLORS.dark).fontSize(8.5).font('Courier')
   .text('functions/db.js, functions/authMiddleware.js, functions/lib/supabaseAdmin.js, server/index.js, functions/routes/issues.js, functions/routes/departments.js', 55, doc.y + 22, { width: 485 });

// ─── DIVISION 3 DETAIL ────────────────────────────────────────────────────────
doc.addPage();
drawSectionTitle('DIVISION 3: CITIZEN EXPERIENCE & PUBLIC GIS LEAD', COLORS.member3);

doc.fillColor(COLORS.dark).fontSize(10).font('Helvetica-Bold').text('Core Specialization: Frontend UI/UX, Spatial GIS Heatmaps & Citizen Workflows');
doc.moveDown(0.4);

const d3Points = [
  'Multi-Step Grievance Wizard: Built responsive reporting form with GPS coordinate geocoding and image capture.',
  'Interactive GIS Public Heatmap: Developed real-time Leaflet/MapLibre map with category filters and spatial clustering.',
  'Zero-Auth Public Tracking: Created public status lookup portal by Reference ID (CC-YYYY-XXXXXX).',
  'Glassmorphism Design System: Built accessible UI tokens, responsive dark/light theme, and micro-interactions.',
  'Citizen Resolution Feedback: Implemented satisfaction rating (1-5 stars) and repair verification/reopen workflow.'
];

d3Points.forEach(pt => {
  doc.fillColor(COLORS.member3).fontSize(10).text('• ', { continued: true });
  doc.fillColor(COLORS.dark).fontSize(9.5).font('Helvetica').text(pt);
  doc.moveDown(0.2);
});

doc.moveDown(0.5);
doc.rect(45, doc.y, 505, 60).fillAndStroke(COLORS.cardBg, COLORS.border);
doc.fillColor(COLORS.primary).fontSize(9.5).font('Helvetica-Bold').text('Code Files Owned (Division 3):', 55, doc.y + 8);
doc.fillColor(COLORS.dark).fontSize(8.5).font('Courier')
   .text('src/pages/citizen/ReportIssue.jsx, src/pages/citizen/Dashboard.jsx, src/pages/public/PublicMap.jsx, src/pages/public/PublicTrack.jsx, src/context/AuthContext.jsx', 55, doc.y + 22, { width: 485 });

doc.y += 45;

// ─── DIVISION 4 DETAIL ────────────────────────────────────────────────────────
drawSectionTitle('DIVISION 4: DEPARTMENT OPS & FIELD MOBILITY LEAD', COLORS.member4);

doc.fillColor(COLORS.dark).fontSize(10).font('Helvetica-Bold').text('Core Specialization: Department Workflows, Field Mobility, Real-Time State Machine & E2E');
doc.moveDown(0.4);

const d4Points = [
  'Strict Department Isolation: Built Coordinator dashboard with 403 enforcement preventing cross-department leaks.',
  'Field Engineer Mobile Interface: Mobile-first portal for task inspection, route navigation, and work submission.',
  'GPS Check-in & Evidence Proof: Built GPS verification confirming physical on-site presence before repair starts.',
  'Canonical State Machine: Enforced ASSIGNED -> ACCEPTED -> EN_ROUTE -> ON_SITE -> IN_PROGRESS -> CLOSED state machine.',
  'Automated Testing Suites: Created 8-department E2E verification test and high-concurrency traffic load test engine.'
];

d4Points.forEach(pt => {
  doc.fillColor(COLORS.member4).fontSize(10).text('• ', { continued: true });
  doc.fillColor(COLORS.dark).fontSize(9.5).font('Helvetica').text(pt);
  doc.moveDown(0.2);
});

doc.moveDown(0.5);
doc.rect(45, doc.y, 505, 60).fillAndStroke(COLORS.cardBg, COLORS.border);
doc.fillColor(COLORS.primary).fontSize(9.5).font('Helvetica-Bold').text('Code Files Owned (Division 4):', 55, doc.y + 8);
doc.fillColor(COLORS.dark).fontSize(8.5).font('Courier')
   .text('src/pages/department/Dashboard.jsx, src/pages/engineer/Dashboard.jsx, src/services/api/engineerApi.js, test_all_departments_e2e.cjs, load_test_suite.cjs', 55, doc.y + 22, { width: 485 });

// ─── VIVA / PRESENTATION TALKING POINTS ───────────────────────────────────────
doc.addPage();
drawSectionTitle('🎤 INDIVIDUAL VIVA & EVALUATION TALKING POINTS');

const vivaPoints = [
  {
    role: 'Member 1 — AI & Triage Lead',
    color: COLORS.member1,
    quote: '"I developed the intelligent triage engine. I integrated Google Gemini 2.5 Flash for multimodal photo/text analysis, combined with a local Naive Bayes classifier that guarantees zero-latency fallback routing during network disruptions. I also built the deterministic priority algorithm that escalates life hazards instantly."'
  },
  {
    role: 'Member 2 — Backend & Security Lead',
    color: COLORS.member2,
    quote: '"I designed the cloud backend architecture, database schema, and security framework. I engineered the normalized PostgreSQL schema on Supabase, implemented connection pooling to handle high concurrency, and created the stateless JWT authentication layer that enforces Role-Based Access Control."'
  },
  {
    role: 'Member 3 — Citizen Portal & GIS Lead',
    color: COLORS.member3,
    quote: '"I led the citizen-facing web applications, public transparency portal, and spatial GIS integration. I developed the multi-step grievance filing wizard with live GPS geolocation, designed the interactive public heatmap for community awareness, and built the zero-auth public tracking system."'
  },
  {
    role: 'Member 4 — Department Ops & Field Lead',
    color: COLORS.member4,
    quote: '"I developed the department management portal, field engineer mobility system, and real-time lifecycle orchestrator. I enforced strict cross-department data isolation, built the mobile-first field engineer workflow with GPS arrival verification, and created the automated 8-department E2E and load test suites."'
  }
];

vivaPoints.forEach(v => {
  doc.rect(45, doc.y, 505, 75).fillAndStroke(COLORS.lightGray, COLORS.border);
  doc.fillColor(v.color).fontSize(10.5).font('Helvetica-Bold').text(v.role, 55, doc.y + 8);
  doc.fillColor(COLORS.dark).fontSize(9).font('Helvetica-Oblique').text(v.quote, 55, doc.y + 22, { width: 485 });
  doc.y += 65;
});

doc.end();

stream.on('finish', () => {
  console.log(`✅ Generated PDF successfully: ${outputPath}`);
});
