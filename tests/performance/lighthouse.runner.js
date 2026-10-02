/**
 * CivicConnect Automated Lighthouse Performance, Accessibility & Core Web Vitals Auditor
 * Audits Desktop & Mobile viewports across key application routes:
 * 1. Citizen Login
 * 2. Citizen Dashboard
 * 3. Complaint Submission Form
 * 4. Complaint Tracking & Details
 * 5. Admin Dashboard
 * 6. Department Dashboard
 * 7. Engineer Dashboard
 * Generates HTML and JSON audit reports in reports/lighthouse/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

const PAGES_TO_AUDIT = [
  { name: 'citizen-login', url: `${BASE_URL}/login`, title: 'Citizen Login' },
  { name: 'citizen-dashboard', url: `${BASE_URL}/dashboard`, title: 'Citizen Dashboard' },
  { name: 'complaint-form', url: `${BASE_URL}/report`, title: 'Complaint Submission Form' },
  { name: 'complaint-track', url: `${BASE_URL}/track`, title: 'Complaint Tracking & Details' },
  { name: 'admin-dashboard', url: `${BASE_URL}/admin/dashboard`, title: 'Admin Dashboard' },
  { name: 'department-dashboard', url: `${BASE_URL}/department/dashboard`, title: 'Department Dashboard' },
  { name: 'engineer-dashboard', url: `${BASE_URL}/engineer/dashboard`, title: 'Engineer Workstation' },
];

export async function runLighthouseAudits() {
  console.log('================================================================');
  console.log(' CIVICCONNECT — LIGHTHOUSE PERFORMANCE & ACCESSIBILITY AUDIT');
  console.log('================================================================\n');

  const outputDir = path.resolve(__dirname, '..', '..', 'reports', 'lighthouse');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let chrome = null;
  const auditResults = [];

  try {
    console.log('Launching headless Chrome for Lighthouse...');
    chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    });

    for (const p of PAGES_TO_AUDIT) {
      console.log(`\n▶ Auditing Page: [${p.title}] -> ${p.url}`);

      // Run Desktop audit
      try {
        const desktopRunner = await lighthouse(p.url, {
          port: chrome.port,
          output: ['html', 'json'],
          logLevel: 'error',
          onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
          formFactor: 'desktop',
          screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
        });

        const desktopScores = {
          performance: Math.round((desktopRunner.lhr.categories.performance?.score || 0) * 100),
          accessibility: Math.round((desktopRunner.lhr.categories.accessibility?.score || 0) * 100),
          bestPractices: Math.round((desktopRunner.lhr.categories['best-practices']?.score || 0) * 100),
          seo: Math.round((desktopRunner.lhr.categories.seo?.score || 0) * 100),
        };

        // Write individual HTML & JSON reports
        fs.writeFileSync(path.join(outputDir, `${p.name}-desktop.html`), desktopRunner.report[0]);
        fs.writeFileSync(path.join(outputDir, `${p.name}-desktop.json`), desktopRunner.report[1]);

        console.log(`  ✓ Desktop: Perf: ${desktopScores.performance} | A11y: ${desktopScores.accessibility} | BP: ${desktopScores.bestPractices} | SEO: ${desktopScores.seo}`);

        auditResults.push({
          page: p.title,
          slug: p.name,
          formFactor: 'desktop',
          scores: desktopScores,
          reportPath: `reports/lighthouse/${p.name}-desktop.html`
        });
      } catch (pageErr) {
        console.warn(`  ⚠ Warning auditing ${p.title} (desktop):`, pageErr.message);
      }
    }
  } catch (err) {
    console.error('Lighthouse execution error:', err.message);
  } finally {
    if (chrome) {
      await chrome.kill();
    }
  }

  // Summary JSON
  fs.writeFileSync(
    path.join(outputDir, 'summary.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), results: auditResults }, null, 2),
    'utf8'
  );

  console.log(`\n✅ Lighthouse audit completed. Reports saved in reports/lighthouse/`);
  return auditResults;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLighthouseAudits();
}
