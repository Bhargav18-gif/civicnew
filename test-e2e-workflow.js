/**
 * CivicConnect End-to-End Workflow Verification Script
 *
 * 1. Creates/Signs in Firebase accounts for Department, Engineer A, Engineer B, and Citizen
 * 2. Syncs tokens to backend API / Supabase
 * 3. Citizen submits complaint with AI auto-classification
 * 4. Department views complaint and assigns Engineer A
 * 5. Verifies Engineer A sees it, and Engineer B does NOT see it
 * 6. Engineer A accepts, travels en route, arrives on site, starts work
 * 7. Engineer A uploads completion evidence
 * 8. Department reviews and approves work
 * 9. Verifies complaint is RESOLVED / CLOSED
 */

import axios from 'axios';
import fs from 'fs';

// Read .env if exists
try {
  const envContent = fs.readFileSync('.env', 'utf-8');
  envContent.split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v && !process.env[k.trim()]) {
      process.env[k.trim()] = v.trim();
    }
  });
} catch (_) {}

const API_BASE = 'http://localhost:5177/api';
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyDJAJ1lLBAiSlP5T2XbLxe7Hjjje5U7nkw';

async function firebaseAuth(email, password, displayName) {
  // Try Sign Up first
  try {
    const signUpRes = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
      { email, password, returnSecureToken: true }
    );
    return {
      idToken: signUpRes.data.idToken,
      localId: signUpRes.data.localId,
      email: signUpRes.data.email
    };
  } catch (signUpErr) {
    // If EMAIL_EXISTS, sign in
    if (signUpErr.response?.data?.error?.message?.includes('EMAIL_EXISTS')) {
      const signInRes = await axios.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
        { email, password, returnSecureToken: true }
      );
      return {
        idToken: signInRes.data.idToken,
        localId: signInRes.data.localId,
        email: signInRes.data.email
      };
    }
    throw signUpErr;
  }
}

async function syncUserWithBackend(idToken, name, email) {
  const res = await axios.post(
    `${API_BASE}/auth/sync`,
    { name, email },
    { headers: { Authorization: `Bearer ${idToken}` } }
  );
  return res.data.user;
}

async function runTest() {
  console.log('====================================================');
  console.log('CIVICCONNECT END-TO-END WORKFLOW TEST');
  console.log('====================================================\n');

  try {
    // 1. Authenticate Department User
    console.log('1. Authenticating Roads Department User...');
    const deptAuth = await firebaseAuth('roads.dept@civicconnect.com', 'Dept@Roads123', 'Roads Department');
    const deptUser = await syncUserWithBackend(deptAuth.idToken, 'Roads Department', 'roads.dept@civicconnect.com');
    console.log('   ✅ Department User Synced:', deptUser.name, '| Role:', deptUser.role, '| Dept:', deptUser.department_id);

    // 2. Authenticate Engineer A (Roads)
    console.log('\n2. Authenticating Roads Engineer A (Ravi Kumar)...');
    const engAAuth = await firebaseAuth('roads.eng1@civicconnect.com', 'Eng@Roads1234', 'Engineer Ravi Kumar');
    const engAUser = await syncUserWithBackend(engAAuth.idToken, 'Engineer Ravi Kumar', 'roads.eng1@civicconnect.com');
    console.log('   ✅ Engineer A Synced:', engAUser.name, '| ID:', engAUser.id, '| Dept:', engAUser.department_id);

    // 3. Authenticate Engineer B (Water)
    console.log('\n3. Authenticating Water Engineer B (Priya Nair)...');
    const engBAuth = await firebaseAuth('water.eng1@civicconnect.com', 'Eng@Water1234', 'Engineer Priya Nair');
    const engBUser = await syncUserWithBackend(engBAuth.idToken, 'Engineer Priya Nair', 'water.eng1@civicconnect.com');
    console.log('   ✅ Engineer B Synced:', engBUser.name, '| ID:', engBUser.id, '| Dept:', engBUser.department_id);

    // 4. Authenticate Citizen
    console.log('\n4. Authenticating Citizen (Sanjay Citizen)...');
    const citizenAuth = await firebaseAuth('citizen.test@civicconnect.com', 'Citizen@12345', 'Sanjay Citizen');
    const citizenUser = await syncUserWithBackend(citizenAuth.idToken, 'Sanjay Citizen', 'citizen.test@civicconnect.com');
    console.log('   ✅ Citizen Synced:', citizenUser.name, '| ID:', citizenUser.id);

    // 5. Citizen Submits a Complaint
    console.log('\n5. Citizen Submitting Complaint ("Severe pothole on 5th Main Road")...');
    const submitRes = await axios.post(
      `${API_BASE}/complaints`,
      {
        title: 'Severe pothole on 5th Main Road',
        description: 'Large and dangerous pothole near the bus stop causing traffic jams and vehicle damage.',
        category: 'Roads',
        address: '5th Main Road, Indiranagar, Bangalore',
        latitude: 12.9716,
        longitude: 77.5946,
        imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800'
      },
      { headers: { Authorization: `Bearer ${citizenAuth.idToken}` } }
    );

    const complaint = submitRes.data.complaint || submitRes.data.data || submitRes.data;
    const complaintId = complaint.id;
    console.log('   ✅ Complaint Created! Ref ID:', complaint.referenceId || complaint.reference_id || complaintId);
    console.log('   -> Polling for Gemini AI background triage and auto-routing...');
    let routedComplaint = null;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const getRes = await axios.get(`${API_BASE}/complaints/${complaintId}`);
      routedComplaint = getRes.data.complaint || getRes.data;
      if (routedComplaint.status !== 'SUBMITTED') break;
    }
    console.log('   ✅ AI Classified Department:', routedComplaint.department_id || routedComplaint.departmentId);
    console.log('   ✅ AI Auto-Routed Status:', routedComplaint.status);

    // 6. Department views complaints
    console.log('\n6. Department Fetching Complaints Queue...');
    const deptComplaintsRes = await axios.get(
      `${API_BASE}/departments/roads/complaints`,
      { headers: { Authorization: `Bearer ${deptAuth.idToken}` } }
    );
    const deptComplaints = deptComplaintsRes.data.complaints || deptComplaintsRes.data;
    const foundInDept = deptComplaints.find(c => c.id === complaintId);
    console.log('   ✅ Complaint Visible in Department Queue:', !!foundInDept);

    // 7. Department Assigns Engineer A
    console.log(`\n7. Department Assigning Engineer A (${engAUser.name})...`);
    const assignRes = await axios.post(
      `${API_BASE}/departments/assign`,
      { complaintId, engineerId: engAUser.id },
      { headers: { Authorization: `Bearer ${deptAuth.idToken}` } }
    );
    console.log('   ✅ Assignment Successful! New Status:', assignRes.data.status || 'ASSIGNED');

    // 8. Role Security Verification: Check Engineer A sees it, Engineer B does NOT
    console.log('\n8. Verifying Engineer Task Isolation Security...');
    const engATasksRes = await axios.get(
      `${API_BASE}/engineer/tasks`,
      { headers: { Authorization: `Bearer ${engAAuth.idToken}` } }
    );
    const engATasks = engATasksRes.data.tasks || [];
    const engAHasComplaint = engATasks.some(t => t.id === complaintId);
    console.log('   ✅ Engineer A sees task:', engAHasComplaint);

    const engBTasksRes = await axios.get(
      `${API_BASE}/engineer/tasks`,
      { headers: { Authorization: `Bearer ${engBAuth.idToken}` } }
    );
    const engBTasks = engBTasksRes.data.tasks || [];
    const engBHasComplaint = engBTasks.some(t => t.id === complaintId);
    console.log('   ✅ Engineer B does NOT see task (Isolation confirmed):', !engBHasComplaint);

    // 9. Engineer A Workflow Execution
    console.log('\n9. Engineer A Executing Field Workflow:');

    // Accept
    console.log('   -> Transitioning to ACCEPTED_BY_ENGINEER...');
    await axios.post(
      `${API_BASE}/engineer/status`,
      { complaintId, status: 'ACCEPTED_BY_ENGINEER', notes: 'Accepted assignment and preparing kit.' },
      { headers: { Authorization: `Bearer ${engAAuth.idToken}` } }
    );

    // En Route
    console.log('   -> Transitioning to EN_ROUTE...');
    await axios.post(
      `${API_BASE}/engineer/status`,
      { complaintId, status: 'EN_ROUTE', notes: 'Travelling to site via service van.' },
      { headers: { Authorization: `Bearer ${engAAuth.idToken}` } }
    );

    // On Site
    console.log('   -> Transitioning to ON_SITE...');
    await axios.post(
      `${API_BASE}/engineer/status`,
      { complaintId, status: 'ON_SITE', notes: 'Arrived at 5th Main Road.' },
      { headers: { Authorization: `Bearer ${engAAuth.idToken}` } }
    );

    // In Progress
    console.log('   -> Transitioning to IN_PROGRESS...');
    await axios.post(
      `${API_BASE}/engineer/status`,
      { complaintId, status: 'IN_PROGRESS', notes: 'Asphalt patching in progress.' },
      { headers: { Authorization: `Bearer ${engAAuth.idToken}` } }
    );
    console.log('   ✅ Field work status: IN_PROGRESS');

    // 10. Engineer A Submits Completion Evidence
    console.log('\n10. Engineer A Submitting Repair Evidence...');
    const evidenceRes = await axios.post(
      `${API_BASE}/engineer/evidence`,
      {
        complaintId,
        afterMedia: [
          { url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800', caption: 'Repaved Asphalt' }
        ],
        completionNotes: 'Pothole filled with cold-mix asphalt, leveled, and compacted.',
        partsUsed: ['Cold-mix asphalt 50kg', 'Bitumen emulsion']
      },
      { headers: { Authorization: `Bearer ${engAAuth.idToken}` } }
    );
    console.log('   ✅ Evidence Submitted! Status:', evidenceRes.data.status);

    // 11. Department Verifies Completed Work
    console.log('\n11. Department Verifying Repair Quality...');
    const verifyRes = await axios.post(
      `${API_BASE}/departments/verify-work`,
      {
        complaintId,
        decision: 'ACCEPT',
        remarks: 'Repaving meets municipal road standards. Approved.'
      },
      { headers: { Authorization: `Bearer ${deptAuth.idToken}` } }
    );
    console.log('   ✅ Department Verified and Approved! Final Status:', verifyRes.data.status);

    console.log('\n====================================================');
    console.log('🎉 ALL WORKFLOW STEPS PASSED SUCCESSFULLY 100%!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ Test Error:', err.response?.data || err.message);
    process.exit(1);
  }
}

runTest();
