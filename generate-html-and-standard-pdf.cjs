const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const HTML_OUTPUT_PATH = path.join(__dirname, 'SCREENSHOT_GALLERY.html');
const HTML_OUTPUT_IN_FOLDER = path.join(__dirname, 'screenshots', 'index.html');
const MD_OUTPUT_PATH = path.join(__dirname, 'SCREENSHOT_GALLERY.md');
const PDF_OUTPUT_PATH = path.join(__dirname, 'CIVICCONNECT_UI_GALLERY_STANDARD.pdf');

const SCREENSHOTS = [
  {
    file: '01_Landing_Page.png',
    title: 'Public Landing & Portal Entry',
    category: 'Public Portal',
    route: '/',
    desc: 'Public landing hero banner, live municipal performance statistics, real-time activity stream, and navigation entry points.'
  },
  {
    file: '02_Citizen_Login_Page.png',
    title: 'Citizen Authentication & Login',
    category: 'Authentication',
    route: '/login',
    desc: 'Secure resident login portal with Firebase Auth email/password, Google OAuth, and automatic profile resolution.'
  },
  {
    file: '03_Admin_Login_Portal.png',
    title: 'Restricted Administrator Login',
    category: 'Authentication',
    route: '/admin/login',
    desc: 'Hardened administrative access portal requiring verified database admin role claims.'
  },
  {
    file: '04_Registration_Page.png',
    title: 'Citizen Registration & Onboarding',
    category: 'Authentication',
    route: '/register',
    desc: 'Resident account creation with immediate profile auto-sync to PostgreSQL database.'
  },
  {
    file: '05_Forgot_Password_Page.png',
    title: 'Password Recovery & Security Reset',
    category: 'Authentication',
    route: '/forgot-password',
    desc: 'Self-service cryptographic password recovery email dispatch interface.'
  },
  {
    file: '06_Public_Live_Dashboard.png',
    title: 'Public Transparency & City Map',
    category: 'Public Portal',
    route: '/public-dashboard',
    desc: 'City-wide open data map, ward-level resolution analytics, and public municipal accountability metrics.'
  },
  {
    file: '07_Public_Track_Complaint.png',
    title: 'Public Grievance Reference Tracker',
    category: 'Public Portal',
    route: '/track',
    desc: 'Public complaint tracking by reference ID (e.g. CC-2026-X8B9Q) with live workflow stage progression.'
  },
  {
    file: '08_Citizen_Dashboard.png',
    title: 'Citizen Personal Grievance Dashboard',
    category: 'Citizen Module',
    route: '/dashboard',
    desc: 'Resident active tickets, resolution history, status badges, and feedback triggers.'
  },
  {
    file: '09_Citizen_Report_Issue.png',
    title: 'Citizen Geotagged Complaint Lodging Form',
    category: 'Citizen Module',
    route: '/report',
    desc: 'Geotagged issue submission with photo evidence upload, category selection, and AI triage routing pipeline.'
  },
  {
    file: '10_Department_Coordinator_Dashboard.png',
    title: 'Department Coordinator Operations Center',
    category: 'Department Module',
    route: '/department/dashboard',
    desc: 'Department queue (Roads), SLA countdown timers, engineer dispatch rosters, and resolution audits with live Supabase sync.'
  },
  {
    file: '11_Field_Operations_Engineer_Dashboard.png',
    title: 'Field Operations Engineer Work Order Center',
    category: 'Engineer Module',
    route: '/engineer/dashboard',
    desc: 'Mobile-first work order queue, state progressions (En Route -> On Site -> Fix Proof), and repair evidence submission.'
  },
  {
    file: '12_Admin_Master_Dashboard.png',
    title: 'Administrator Command & Triage Dashboard',
    category: 'Admin Module',
    route: '/admin/dashboard',
    desc: 'City-wide performance overview, AI exception review queue, and global activity monitor.'
  },
  {
    file: '13_Admin_Complaints_Management.png',
    title: 'Global Complaints & SLA Management',
    category: 'Admin Module',
    route: '/admin/complaints',
    desc: 'System-wide complaint registry with manual department routing and SLA escalation overrides.'
  },
  {
    file: '14_Admin_User_Access_Control.png',
    title: 'Role-Based Access Control (RBAC) User Management',
    category: 'Admin Module',
    route: '/admin/users',
    desc: 'User management table for assigning Citizen, Engineer, Department, and Admin roles with activation toggle.'
  },
  {
    file: '15_Admin_AI_Model_Configuration.png',
    title: 'AI Classification & Model Configuration',
    category: 'Admin Module',
    route: '/admin/ai-config',
    desc: 'AI confidence thresholds, Gemini LLM router prompts, and fallback manual review rules.'
  }
];

function generateHtml(relativePathToScreenshots = './screenshots/') {
  const cardsHtml = SCREENSHOTS.map((s, idx) => {
    const imgSrc = relativePathToScreenshots ? `${relativePathToScreenshots}${s.file}` : s.file;
    return `
      <section class="gallery-card" id="screenshot-${idx + 1}" data-category="${s.category}">
        <div class="card-header">
          <div class="card-header-left">
            <span class="badge badge-index">#${String(idx + 1).padStart(2, '0')}</span>
            <span class="badge badge-cat">${s.category}</span>
            <span class="route-tag">Route: <code>${s.route}</code></span>
          </div>
          <a href="${imgSrc}" target="_blank" class="open-btn">Open Image ↗</a>
        </div>
        <h2 class="card-title">${s.title}</h2>
        <p class="card-desc">${s.desc}</p>
        <div class="image-wrapper">
          <a href="${imgSrc}" target="_blank" title="Click to view high-resolution screenshot">
            <img src="${imgSrc}" alt="${s.title}" loading="lazy" />
          </a>
        </div>
        <div class="card-footer">
          <span>File: <code>${s.file}</code></span>
          <span>CivicConnect Municipal System</span>
        </div>
      </section>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CivicConnect — Complete UI Screenshots Gallery</title>
  <style>
    :root {
      --bg: #070b14;
      --card-bg: #0d1527;
      --border: rgba(255, 255, 255, 0.08);
      --accent: #38bdf8;
      --accent-teal: #2dd4bf;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      padding: 30px 20px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 35px 30px;
      margin-bottom: 30px;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
    }

    .header-sub {
      color: var(--accent);
      font-weight: 700;
      font-size: 0.85rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .header-title {
      font-size: 2.2rem;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 12px;
      background: linear-gradient(to right, #ffffff, #93c5fd);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .header-desc {
      color: var(--text-muted);
      font-size: 1rem;
      max-width: 800px;
      margin-bottom: 20px;
    }

    .quick-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .stat-pill {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #cbd5e1;
    }

    .nav-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 30px;
      position: sticky;
      top: 15px;
      z-index: 100;
      background: rgba(7, 11, 20, 0.85);
      backdrop-filter: blur(12px);
      padding: 10px 14px;
      border-radius: 16px;
      border: 1px solid var(--border);
    }

    .nav-btn {
      background: rgba(255, 255, 255, 0.04);
      color: var(--text-muted);
      border: 1px solid var(--border);
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .nav-btn:hover, .nav-btn.active {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
    }

    .gallery-grid {
      display: flex;
      flex-direction: column;
      gap: 40px;
    }

    .gallery-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      scroll-margin-top: 80px;
      transition: border-color 0.2s;
    }

    .gallery-card:hover {
      border-color: rgba(56, 189, 248, 0.4);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      flex-wrap: wrap;
      gap: 10px;
    }

    .card-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .badge {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 8px;
    }

    .badge-index {
      background: rgba(56, 189, 248, 0.15);
      color: var(--accent);
      border: 1px solid rgba(56, 189, 248, 0.3);
    }

    .badge-cat {
      background: rgba(45, 212, 191, 0.15);
      color: var(--accent-teal);
      border: 1px solid rgba(45, 212, 191, 0.3);
    }

    .route-tag {
      font-size: 0.8rem;
      color: #94a3b8;
    }

    .route-tag code {
      background: rgba(0, 0, 0, 0.4);
      padding: 2px 6px;
      border-radius: 6px;
      color: #38bdf8;
      font-family: monospace;
    }

    .open-btn {
      font-size: 0.8rem;
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
      padding: 5px 12px;
      border-radius: 8px;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.2);
      transition: all 0.2s;
    }

    .open-btn:hover {
      background: var(--accent);
      color: #000;
    }

    .card-title {
      font-size: 1.4rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 6px;
    }

    .card-desc {
      color: var(--text-muted);
      font-size: 0.95rem;
      margin-bottom: 18px;
    }

    .image-wrapper {
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: #020617;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
    }

    .image-wrapper img {
      width: 100%;
      height: auto;
      display: block;
      transition: transform 0.3s ease;
    }

    .image-wrapper:hover img {
      transform: scale(1.008);
    }

    .card-footer {
      display: flex;
      justify-content: space-between;
      margin-top: 14px;
      font-size: 0.78rem;
      color: #64748b;
    }

    .card-footer code {
      color: #94a3b8;
    }

    @media print {
      body { background: #fff; color: #000; padding: 0; }
      .nav-tabs, .open-btn { display: none; }
      .gallery-card { page-break-after: always; border: 1px solid #ccc; background: #fff; color: #000; }
      .card-title { color: #000; }
      .header-title { background: none; -webkit-text-fill-color: #000; color: #000; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-sub">CivicConnect Visual UI Specification</div>
      <h1 class="header-title">All 15 Pages & Dashboards Screenshot Catalog</h1>
      <p class="header-desc">
        Complete high-resolution screenshot documentation of every public screen, authentication portal, citizen interface, and role-based operational dashboard.
      </p>
      <div class="quick-stats">
        <div class="stat-pill">✨ 15 Full Pages Captured</div>
        <div class="stat-pill">👥 4 Core Roles (Citizen, Dept, Engineer, Admin)</div>
        <div class="stat-pill">⚡ Supabase Real-Time Synchronized</div>
        <div class="stat-pill">📱 Mobile & Desktop Viewport Ready</div>
      </div>
    </header>

    <div class="nav-tabs">
      <button class="nav-btn active" onclick="filterCat('ALL')">All Pages (15)</button>
      <button class="nav-btn" onclick="filterCat('Public Portal')">Public (3)</button>
      <button class="nav-btn" onclick="filterCat('Authentication')">Auth (4)</button>
      <button class="nav-btn" onclick="filterCat('Citizen Module')">Citizen (2)</button>
      <button class="nav-btn" onclick="filterCat('Department Module')">Department (1)</button>
      <button class="nav-btn" onclick="filterCat('Engineer Module')">Engineer (1)</button>
      <button class="nav-btn" onclick="filterCat('Admin Module')">Admin (4)</button>
    </div>

    <main class="gallery-grid">
      ${cardsHtml}
    </main>
  </div>

  <script>
    function filterCat(cat) {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');

      document.querySelectorAll('.gallery-card').forEach(card => {
        if (cat === 'ALL' || card.getAttribute('data-category') === cat) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>`;
}

function generateMarkdown() {
  let md = `# CivicConnect — UI Pages & Dashboards Screenshot Gallery\n\n`;
  md += `All screenshots are organized in high-resolution PNG format inside the [\`./screenshots/\`](file:///d:/civicnew-main/screenshots) directory.\n\n`;
  md += `| # | Page / Screen | Category | Route | PNG File |\n`;
  md += `|---|---|---|---|---|\n`;

  SCREENSHOTS.forEach((s, idx) => {
    md += `| ${idx + 1} | **${s.title}** | ${s.category} | \`${s.route}\` | [${s.file}](file:///d:/civicnew-main/screenshots/${s.file}) |\n`;
  });

  md += `\n---\n\n## Visual Catalog\n\n`;

  SCREENSHOTS.forEach((s, idx) => {
    md += `### ${idx + 1}. ${s.title}\n`;
    md += `- **Category:** ${s.category}\n`;
    md += `- **Route:** \`${s.route}\`\n`;
    md += `- **Description:** ${s.desc}\n`;
    md += `- **Screenshot File:** [\`screenshots/${s.file}\`](file:///d:/civicnew-main/screenshots/${s.file})\n\n`;
    md += `![${s.title}](d:/civicnew-main/screenshots/${s.file})\n\n---\n\n`;
  });

  return md;
}

async function main() {
  console.log('📦 Generating HTML Galleries & Markdown Catalog...');

  // 1. Root HTML Gallery
  fs.writeFileSync(HTML_OUTPUT_PATH, generateHtml('./screenshots/'), 'utf-8');
  console.log(`✅ Created Root HTML Gallery: ${HTML_OUTPUT_PATH}`);

  // 2. Folder-internal HTML Gallery
  fs.writeFileSync(HTML_OUTPUT_IN_FOLDER, generateHtml(''), 'utf-8');
  console.log(`✅ Created In-Folder Gallery: ${HTML_OUTPUT_IN_FOLDER}`);

  // 3. Markdown Catalog
  fs.writeFileSync(MD_OUTPUT_PATH, generateMarkdown(), 'utf-8');
  console.log(`✅ Created Markdown Catalog: ${MD_OUTPUT_PATH}`);

  // 4. Standard Universally-Compatible Chromium PDF
  console.log('🚀 Generating standard universally compatible PDF via Chromium...');
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(`file://${HTML_OUTPUT_PATH}`, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: PDF_OUTPUT_PATH,
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '10mm', right: '10mm' }
    });

    await browser.close();
    console.log(`✅ Created Standard Universal PDF: ${PDF_OUTPUT_PATH}`);
  } catch (pdfErr) {
    console.warn(`⚠️ Puppeteer PDF generation error: ${pdfErr.message}`);
  }

  console.log('\n🎉 All screenshot formats successfully created and accessible!\n');
}

main();
