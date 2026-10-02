const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const PAGES_TO_CAPTURE = [
  {
    name: '01_Landing_Page',
    title: 'CivicConnect Public Landing Page',
    url: 'http://localhost:5173/',
    mockUser: null
  },
  {
    name: '02_Citizen_Login_Page',
    title: 'Citizen Authentication & Login Portal',
    url: 'http://localhost:5173/login',
    mockUser: null
  },
  {
    name: '03_Admin_Login_Portal',
    title: 'Restricted Administrator Login Portal',
    url: 'http://localhost:5173/admin/login',
    mockUser: null
  },
  {
    name: '04_Registration_Page',
    title: 'New Citizen Registration & Onboarding',
    url: 'http://localhost:5173/register',
    mockUser: null
  },
  {
    name: '05_Forgot_Password_Page',
    title: 'Password Recovery & Security Reset',
    url: 'http://localhost:5173/forgot-password',
    mockUser: null
  },
  {
    name: '06_Public_Live_Dashboard',
    title: 'Public Transparency & City Map Overview',
    url: 'http://localhost:5173/public-dashboard',
    mockUser: null
  },
  {
    name: '07_Public_Track_Complaint',
    title: 'Public Complaint Tracking by Reference ID',
    url: 'http://localhost:5173/track',
    mockUser: null
  },
  {
    name: '08_Citizen_Dashboard',
    title: 'Citizen Personal Grievance Dashboard',
    url: 'http://localhost:5173/dashboard',
    mockUser: {
      id: 'mock-citizen-uid',
      uid: 'mock-citizen-uid',
      supabaseId: 'mock-citizen-supa-id',
      name: 'Sanjay Citizen',
      email: 'citizen.test@civicconnect.com',
      role: 'citizen',
      departmentId: null,
      isActive: true
    }
  },
  {
    name: '09_Citizen_Report_Issue',
    title: 'Citizen Geotagged Complaint Lodging Form',
    url: 'http://localhost:5173/report',
    mockUser: {
      id: 'mock-citizen-uid',
      uid: 'mock-citizen-uid',
      supabaseId: 'mock-citizen-supa-id',
      name: 'Sanjay Citizen',
      email: 'citizen.test@civicconnect.com',
      role: 'citizen',
      departmentId: null,
      isActive: true
    }
  },
  {
    name: '10_Department_Coordinator_Dashboard',
    title: 'Roads & Infrastructure Department Dashboard',
    url: 'http://localhost:5173/department/dashboard',
    mockUser: {
      id: 'mock-dept-uid',
      uid: 'mock-dept-uid',
      supabaseId: 'mock-dept-supa-id',
      name: 'Roads Department Manager',
      email: 'roads.dept@civicconnect.com',
      role: 'department',
      departmentId: 'roads',
      isActive: true
    }
  },
  {
    name: '11_Field_Operations_Engineer_Dashboard',
    title: 'Field Operations Engineer Work Order Dashboard',
    url: 'http://localhost:5173/engineer/dashboard',
    mockUser: {
      id: 'mock-eng-uid',
      uid: 'mock-eng-uid',
      supabaseId: 'mock-eng-supa-id',
      name: 'Engineer Ravi Kumar',
      email: 'roads.eng1@civicconnect.com',
      role: 'engineer',
      departmentId: 'roads',
      isActive: true
    }
  },
  {
    name: '12_Admin_Master_Dashboard',
    title: 'Administrator Master Command & Triage Dashboard',
    url: 'http://localhost:5173/admin/dashboard',
    mockUser: {
      id: 'mock-admin-uid',
      uid: 'mock-admin-uid',
      supabaseId: 'mock-admin-supa-id',
      name: 'System Administrator',
      email: 'admin@civicconnect.com',
      role: 'admin',
      departmentId: null,
      isActive: true
    }
  },
  {
    name: '13_Admin_Complaints_Management',
    title: 'Administrator Global Complaints & SLA Oversight',
    url: 'http://localhost:5173/admin/complaints',
    mockUser: {
      id: 'mock-admin-uid',
      uid: 'mock-admin-uid',
      supabaseId: 'mock-admin-supa-id',
      name: 'System Administrator',
      email: 'admin@civicconnect.com',
      role: 'admin',
      departmentId: null,
      isActive: true
    }
  },
  {
    name: '14_Admin_User_Access_Control',
    title: 'Administrator Role-Based User Management',
    url: 'http://localhost:5173/admin/users',
    mockUser: {
      id: 'mock-admin-uid',
      uid: 'mock-admin-uid',
      supabaseId: 'mock-admin-supa-id',
      name: 'System Administrator',
      email: 'admin@civicconnect.com',
      role: 'admin',
      departmentId: null,
      isActive: true
    }
  },
  {
    name: '15_Admin_AI_Model_Configuration',
    title: 'Administrator AI Classification & Model Tuner',
    url: 'http://localhost:5173/admin/ai-config',
    mockUser: {
      id: 'mock-admin-uid',
      uid: 'mock-admin-uid',
      supabaseId: 'mock-admin-supa-id',
      name: 'System Administrator',
      email: 'admin@civicconnect.com',
      role: 'admin',
      departmentId: null,
      isActive: true
    }
  }
];

async function captureScreenshots() {
  console.log('🚀 Launching Puppeteer Headless Browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });

  for (let i = 0; i < PAGES_TO_CAPTURE.length; i++) {
    const item = PAGES_TO_CAPTURE[i];
    console.log(`[${i + 1}/${PAGES_TO_CAPTURE.length}] Capturing: ${item.name} (${item.title})...`);

    try {
      // First go to base to configure localStorage
      await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.evaluate((mockUser) => {
        if (mockUser) {
          localStorage.setItem('cc_mock_user', JSON.stringify(mockUser));
        } else {
          localStorage.removeItem('cc_mock_user');
        }
      }, item.mockUser);

      // Navigate to target URL
      await page.goto(item.url, { waitUntil: 'networkidle2', timeout: 20000 });
      // Allow animations and charts to render
      await new Promise(r => setTimeout(r, 2000));

      const screenshotPath = path.join(SCREENSHOT_DIR, `${item.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`   ✅ Saved: ${screenshotPath}`);
    } catch (err) {
      console.error(`   ❌ Failed to capture ${item.name}:`, err.message);
    }
  }

  await browser.close();
  console.log('\n🎉 All screenshots captured successfully in /screenshots directory!\n');
}

captureScreenshots();
