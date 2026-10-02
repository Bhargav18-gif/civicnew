/**
 * CivicConnect — Screenshot Gallery PDF Generator
 * Compiles all captured UI pages and dashboards into a beautifully formatted PDF document.
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUTPUT_PDF_PATH = path.join(__dirname, 'CIVICCONNECT_UI_PAGES_AND_DASHBOARDS_GALLERY.pdf');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

const SCREENSHOT_MANIFEST = [
  { file: '01_Landing_Page.png', title: 'Public Landing & Portal Entry', module: 'Public / Citizen Entry', desc: 'Landing hero banner, live municipal stats, real-time activity feed, and primary navigation.' },
  { file: '02_Citizen_Login_Page.png', title: 'Citizen Authentication Portal', module: 'Citizen Module', desc: 'Secure Firebase email/password and Google OAuth sign-in interface.' },
  { file: '03_Admin_Login_Portal.png', title: 'Restricted Administrator Login', module: 'Admin Module', desc: 'Hardened administrative access portal requiring verified database admin claims.' },
  { file: '04_Registration_Page.png', title: 'Citizen Registration & Onboarding', module: 'Citizen Module', desc: 'Resident account creation with immediate profile auto-sync to PostgreSQL.' },
  { file: '05_Forgot_Password_Page.png', title: 'Password Recovery & Security', module: 'Auth Module', desc: 'Self-service cryptographic password reset email dispatch interface.' },
  { file: '06_Public_Live_Dashboard.png', title: 'Public Transparency & City Map', module: 'Public Analytics', desc: 'City-wide open data map, ward-level heatmaps, and resolved issue transparency stats.' },
  { file: '07_Public_Track_Complaint.png', title: 'Public Grievance Tracker', module: 'Public / Citizen Tracker', desc: 'Real-time complaint tracking via public reference ID (e.g. CC-2026-X8B9Q).' },
  { file: '08_Citizen_Dashboard.png', title: 'Citizen Personal Grievance Dashboard', module: 'Citizen Module', desc: 'Resident active tickets, resolution history, status badges, and feedback triggers.' },
  { file: '09_Citizen_Report_Issue.png', title: 'Citizen Complaint Submission Form', module: 'Citizen Module', desc: 'Geotagged issue form with camera photo upload, category selector, and AI routing pipeline.' },
  { file: '10_Department_Coordinator_Dashboard.png', title: 'Department Coordinator Dashboard', module: 'Department Module', desc: 'Department queue (Roads), SLA countdown timers, engineer dispatch rosters, and resolution audits.' },
  { file: '11_Field_Operations_Engineer_Dashboard.png', title: 'Field Operations Engineer Dashboard', module: 'Engineer Module', desc: 'Mobile-first work order queue, state progressions (En Route -> On Site -> Fix Proof), and task details.' },
  { file: '12_Admin_Master_Dashboard.png', title: 'Administrator Command Dashboard', module: 'Admin Module', desc: 'City-wide performance overview, AI exception review queue, and global activity monitor.' },
  { file: '13_Admin_Complaints_Management.png', title: 'Global Complaints & SLA Management', module: 'Admin Module', desc: 'System-wide complaint registry with manual department routing and SLA escalation overrides.' },
  { file: '14_Admin_User_Access_Control.png', title: 'RBAC User Management & Role Control', module: 'Admin Module', desc: 'User management table for assigning Citizen, Engineer, Department, and Admin roles.' },
  { file: '15_Admin_AI_Model_Configuration.png', title: 'AI Classification & System Config', module: 'Admin Module', desc: 'AI confidence thresholds, Gemini LLM router prompts, and fallback manual review rules.' }
];

function generateGalleryPDF() {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape', // Landscape for widescreen UI screenshots
    margins: { top: 30, bottom: 25, left: 35, right: 35 },
    autoFirstPage: false
  });

  const writeStream = fs.createWriteStream(OUTPUT_PDF_PATH);
  doc.pipe(writeStream);

  // Cover Page
  doc.addPage();
  doc.rect(0, 0, 842, 595).fill('#0f172a');
  doc.fillColor('#38bdf8').fontSize(14).font('Helvetica-Bold').text('CIVICCONNECT VISUAL UI SPECIFICATION', 50, 180, { characterSpacing: 2 });
  doc.fillColor('#ffffff').fontSize(28).font('Helvetica-Bold').text('Every Page & Dashboard Screenshot Gallery', 50, 210);
  doc.fillColor('#94a3b8').fontSize(12).font('Helvetica').text('Complete visual catalog of all 15 public pages, authenticated portals, and role dashboards', 50, 255);

  doc.rect(50, 310, 742, 1).fill('#334155');
  doc.fillColor('#38bdf8').fontSize(10).font('Helvetica-Bold').text('INCLUDED MODULES IN THIS DOCUMENT:', 50, 335);
  doc.fillColor('#cbd5e1').fontSize(9.5).font('Helvetica').lineGap(4).text(
    '• Public & Landing: Landing Page, Public Transparency Map, Complaint Reference Tracker\n' +
    '• Authentication: Citizen Login, Admin Restricted Login, Registration, Forgot Password\n' +
    '• Citizen Module: Personal Dashboard, Geotagged Issue Lodging Form\n' +
    '• Department Module: Department Coordinator Dashboard & SLA Triage Roster\n' +
    '• Field Engineer Module: Mobile Work Order Queue & On-Site Evidence Progression\n' +
    '• Administrator Module: Command Dashboard, Global Complaints, User RBAC Control, AI Model Tuning',
    50, 355
  );

  // Each screenshot on its own landscape page
  SCREENSHOT_MANIFEST.forEach((item, index) => {
    const imgPath = path.join(SCREENSHOT_DIR, item.file);
    if (!fs.existsSync(imgPath)) return;

    doc.addPage();

    // Header bar
    doc.rect(0, 0, 842, 52).fill('#0f172a');
    doc.fillColor('#38bdf8').fontSize(8).font('Helvetica-Bold').text(`CIVICCONNECT UI GALLERY • SCREENSHOT ${index + 1} OF ${SCREENSHOT_MANIFEST.length}`, 35, 14);
    doc.fillColor('#ffffff').fontSize(13).font('Helvetica-Bold').text(item.title, 35, 26);
    
    doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica-Bold').text(`MODULE: ${item.module.toUpperCase()}`, 500, 20, { width: 305, align: 'right' });
    doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text(item.desc, 500, 33, { width: 305, align: 'right' });

    // Render image
    const imgX = 35;
    const imgY = 62;
    const imgWidth = 772;
    const imgHeight = 500;

    doc.rect(imgX - 1, imgY - 1, imgWidth + 2, imgHeight + 2).stroke('#cbd5e1');
    doc.image(imgPath, imgX, imgY, { fit: [imgWidth, imgHeight], align: 'center', valign: 'center' });

    // Footer
    doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
      .text(`File: ${item.file} • CivicConnect Enterprise Autonomous Municipal System`, 35, 575);
    doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
      .text(`Page ${index + 2} of ${SCREENSHOT_MANIFEST.length + 1}`, 700, 575, { width: 105, align: 'right' });
  });

  doc.end();

  writeStream.on('finish', () => {
    console.log(`\n================================================================`);
    console.log(`✅ CivicConnect UI Screenshot Gallery PDF Created:`);
    console.log(`   ${OUTPUT_PDF_PATH}`);
    console.log(`================================================================\n`);
  });
}

generateGalleryPDF();
