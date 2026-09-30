/**
 * CivicConnect — Multi-Department & Engineer Real-Time Isolation Test Suite
 * 
 * Verifies:
 * 1. AI triage to correct Department (ROADS)
 * 2. Strict Department Isolation (Roads sees it; Water/Sanitation do NOT)
 * 3. Security Enforcement: Department user cannot query another department's endpoint (403 Forbidden)
 * 4. Department -> Engineer Assignment
 * 5. Strict Engineer Isolation (Assigned engineer sees it; unassigned engineer does NOT)
 * 6. Security Enforcement: Unassigned engineer cannot access task detail or update status (403 Forbidden)
 * 7. Real-Time Status Transitions (ASSIGNED -> ACCEPTED -> EN_ROUTE -> ON_SITE -> IN_PROGRESS -> VERIFICATION_PENDING)
 * 8. Department Verification & Approval (VERIFICATION_PENDING -> CLOSED)
 * 9. Status Transition Security (Engineer cannot approve own work / jump directly to CLOSED)
 */

const axios = require('axios');

const API_BASE = 'http://127.0.0.1:5177/api';
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyDJAJ1lLBAiSlP5T2XbLxe7Hjjje5U7nkw';

async function firebaseAuth(email, password, displayName) {
  try {
    const signUpRes = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
      { email, password, returnSecureToken: true }
    );
    return signUpRes.data.idToken;
  } catch (signUpErr) {
    if (signUpErr.response?.data?.error?.message?.includes('EMAIL_EXISTS')) {
      const signInRes = await axios.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
        { email, password, returnSecureToken: true }
      );
      return signInRes.data.idToken;
    }
    console.error(`Auth failed for ${email}:`, signUpErr.response?.data || signUpErr.message);
    throw signUpErr;
  }
}

async function syncUser(token, name, email) {
  const res = await axios.post(
    `${API_BASE}/auth/sync`,
    { name, email },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data.user || res.data;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let passedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log(' CIVICCONNECT MULTI-DEPARTMENT & REAL-TIME ISOLATION TEST SUITE');
  console.log('================================================================\n');

  try {
    // ─── AUTHENTICATE ALL ROLES ─────────────────────────────────────────────
    console.log('1. Authenticating Roads Department User...');
    const roadsDeptToken = await firebaseAuth('roads.dept@civicconnect.com', 'Dept@Roads123');
    const roadsDeptUser = await syncUser(roadsDeptToken, 'Roads Department Manager', 'roads.dept@civicconnect.com');
    console.log(`   ✅ Roads Dept: ${roadsDeptUser.name} (${roadsDeptUser.role}) -> Dept: ${roadsDeptUser.department_id}`);

    console.log('2. Authenticating Water Department User...');
    const waterDeptToken = await firebaseAuth('water.dept@civicconnect.com', 'Dept@Water123');
    const waterDeptUser = await syncUser(waterDeptToken, 'Water Department Manager', 'water.dept@civicconnect.com');
    console.log(`   ✅ Water Dept: ${waterDeptUser.name} (${waterDeptUser.role}) -> Dept: ${waterDeptUser.department_id}`);

    console.log('3. Authenticating Roads Engineer...');
    const roadsEngToken = await firebaseAuth('roads.eng1@civicconnect.com', 'Eng@Roads1234');
    const roadsEngUser = await syncUser(roadsEngToken, 'Engineer Ravi Kumar', 'roads.eng1@civicconnect.com');
    console.log(`   ✅ Roads Eng:  ${roadsEngUser.name} (${roadsEngUser.role}) -> Dept: ${roadsEngUser.department_id}`);

    console.log('4. Authenticating Water Engineer...');
    const waterEngToken = await firebaseAuth('water.eng1@civicconnect.com', 'Eng@Water1234');
    const waterEngUser = await syncUser(waterEngToken, 'Engineer Priya Nair', 'water.eng1@civicconnect.com');
    console.log(`   ✅ Water Eng:  ${waterEngUser.name} (${waterEngUser.role}) -> Dept: ${waterEngUser.department_id}`);

    console.log('5. Authenticating Citizen User...');
    const citizenToken = await firebaseAuth('citizen.test@civicconnect.com', 'Citizen@12345');
    const citizenUser = await syncUser(citizenToken, 'Sanjay Citizen', 'citizen.test@civicconnect.com');
    console.log(`   ✅ Citizen:    ${citizenUser.name} (${citizenUser.role})\n`);

    // ─── STAGE 1: Citizen creates a road complaint ───────────────────────────
    console.log('--- STAGE 1: Citizen creates a road damage complaint ---');
    const createRes = await axios.post(`${API_BASE}/complaints`, {
      title: 'Massive Pothole on Sector 4 Main Road',
      description: 'Severe road surface depression causing vehicular disruption and safety hazard near junction.',
      latitude: 12.9716,
      longitude: 77.5946,
      address: 'Sector 4 Main Road, Central Ward',
      priority: 'HIGH'
    }, { headers: { Authorization: `Bearer ${citizenToken}` } });

    const complaintObj = createRes.data.complaint || createRes.data.data || createRes.data;
    const complaintId = complaintObj.id;
    const refId = complaintObj.referenceId || complaintObj.reference_id || complaintObj.trackingNumber || complaintId;
    assert(Boolean(complaintId), `Complaint created in Supabase PostgreSQL (ID: ${complaintId})`);

    // Wait for AI background pipeline to classify to ROADS
    console.log('\n--- Waiting for Gemini AI background classification to route to ROADS... ---');
    let complaint = null;
    for (let i = 0; i < 25; i++) {
      await sleep(1000);
      const trackRes = await axios.get(`${API_BASE}/complaints/${complaintId}`);
      complaint = trackRes.data.complaint || trackRes.data;
      if (complaint.status !== 'SUBMITTED' && complaint.status !== 'AI_PROCESSING') {
        break;
      }
    }

    assert(complaint.department_id === 'roads' || complaint.departmentId === 'roads', `AI correctly classified and routed to ROADS department (dept: ${complaint.department_id})`);
    assert(complaint.status === 'ROUTED', `Status transitioned to ROUTED (status: ${complaint.status})`);

    // ─── STAGE 2: Department Isolation Verification ──────────────────────────
    console.log('\n--- STAGE 2: Department Isolation Verification ---');
    
    // 2A: Roads department MUST see this complaint
    const roadsDeptRes = await axios.get(`${API_BASE}/departments/roads/complaints`, {
      headers: { Authorization: `Bearer ${roadsDeptToken}` }
    });
    const roadsComplaints = roadsDeptRes.data.complaints || [];
    const foundInRoads = roadsComplaints.some(c => c.id === complaintId);
    assert(foundInRoads, 'Roads Department CAN see the road complaint in its work queue');

    // 2B: Water department MUST NOT see this complaint
    const waterDeptRes = await axios.get(`${API_BASE}/departments/water/complaints`, {
      headers: { Authorization: `Bearer ${waterDeptToken}` }
    });
    const waterComplaints = waterDeptRes.data.complaints || [];
    const foundInWater = waterComplaints.some(c => c.id === complaintId);
    assert(!foundInWater, 'Water Department CANNOT see the road complaint (Multi-Department Isolation verified)');

    // 2C: Security: Water Department user CANNOT query roads department endpoint
    let securityCheckPassed = false;
    try {
      await axios.get(`${API_BASE}/departments/roads/complaints`, {
        headers: { Authorization: `Bearer ${waterDeptToken}` }
      });
    } catch (err) {
      if (err.response?.status === 403) {
        securityCheckPassed = true;
      }
    }
    assert(securityCheckPassed, 'Department Access Control: Water Dept user receives 403 Forbidden when accessing /departments/roads/complaints');

    // ─── STAGE 3: Department assigns Engineer ─────────────────────────────────
    console.log('\n--- STAGE 3: Department -> Engineer Assignment ---');
    const assignRes = await axios.post(`${API_BASE}/departments/assign`, {
      complaintId,
      engineerId: roadsEngUser.id
    }, { headers: { Authorization: `Bearer ${roadsDeptToken}` } });

    assert(assignRes.data.success, 'Roads Department successfully assigned task to Roads Engineer');

    const checkAssigned = await axios.get(`${API_BASE}/complaints/${complaintId}`);
    const assignedComplaint = checkAssigned.data.complaint || checkAssigned.data;
    assert(assignedComplaint.status === 'ASSIGNED', `Status transitioned to ASSIGNED (status: ${assignedComplaint.status})`);
    assert(assignedComplaint.assigned_engineer_id === roadsEngUser.id, 'Assigned engineer ID set in database');

    // ─── STAGE 4: Engineer Isolation Verification ────────────────────────────
    console.log('\n--- STAGE 4: Engineer Isolation Verification ---');
    
    // 4A: Roads Engineer MUST see this task
    const roadsEngTasks = await axios.get(`${API_BASE}/engineer/tasks`, {
      headers: { Authorization: `Bearer ${roadsEngToken}` }
    });
    const eng1Tasks = roadsEngTasks.data.tasks || [];
    const foundInEng1 = eng1Tasks.some(t => t.id === complaintId);
    assert(foundInEng1, 'Roads Engineer CAN see the assigned task in their personal work queue');

    // 4B: Water Engineer MUST NOT see this task
    const waterEngTasks = await axios.get(`${API_BASE}/engineer/tasks`, {
      headers: { Authorization: `Bearer ${waterEngToken}` }
    });
    const eng2Tasks = waterEngTasks.data.tasks || [];
    const foundInEng2 = eng2Tasks.some(t => t.id === complaintId);
    assert(!foundInEng2, 'Water Engineer CANNOT see the road task (Engineer Isolation verified)');

    // 4C: Security: Water Engineer cannot fetch detail of Roads Engineer task
    let engSecurityPassed = false;
    try {
      await axios.get(`${API_BASE}/engineer/tasks/${complaintId}`, {
        headers: { Authorization: `Bearer ${waterEngToken}` }
      });
    } catch (err) {
      if (err.response?.status === 403) {
        engSecurityPassed = true;
      }
    }
    assert(engSecurityPassed, 'Engineer Access Control: Unassigned engineer receives 403 Forbidden when requesting /engineer/tasks/:id');

    // ─── STAGE 5: Engineer Lifecycle Transitions ─────────────────────────────
    console.log('\n--- STAGE 5: Engineer Lifecycle Workflow Execution ---');

    // 5A: Accept task
    const acceptRes = await axios.post(`${API_BASE}/engineer/status`, {
      complaintId,
      status: 'ACCEPTED_BY_ENGINEER',
      notes: 'Acknowledged assignment. Preparing materials and equipment.'
    }, { headers: { Authorization: `Bearer ${roadsEngToken}` } });
    assert(acceptRes.data.status === 'ACCEPTED_BY_ENGINEER', 'Engineer status -> ACCEPTED_BY_ENGINEER');

    // 5B: En Route
    const enRouteRes = await axios.post(`${API_BASE}/engineer/status`, {
      complaintId,
      status: 'EN_ROUTE',
      notes: 'Departed base with repair crew and asphalt mix.'
    }, { headers: { Authorization: `Bearer ${roadsEngToken}` } });
    assert(enRouteRes.data.status === 'EN_ROUTE', 'Engineer status -> EN_ROUTE');

    // 5C: GPS Arrival Confirmation
    const arrivalRes = await axios.post(`${API_BASE}/engineer/arrival`, {
      complaintId,
      gps: { latitude: 12.9716, longitude: 77.5946, accuracyMeters: 5.2 }
    }, { headers: { Authorization: `Bearer ${roadsEngToken}` } });
    assert(arrivalRes.data.success, 'Engineer confirmed GPS arrival at site');

    // 5D: On Site
    const onSiteRes = await axios.post(`${API_BASE}/engineer/status`, {
      complaintId,
      status: 'ON_SITE',
      notes: 'Arrived at site. Traffic cones placed.'
    }, { headers: { Authorization: `Bearer ${roadsEngToken}` } });
    assert(onSiteRes.data.status === 'ON_SITE', 'Engineer status -> ON_SITE');

    // 5E: In Progress
    const inProgressRes = await axios.post(`${API_BASE}/engineer/status`, {
      complaintId,
      status: 'IN_PROGRESS',
      notes: 'Surface cleaning and asphalt compaction underway.'
    }, { headers: { Authorization: `Bearer ${roadsEngToken}` } });
    assert(inProgressRes.data.status === 'IN_PROGRESS', 'Engineer status -> IN_PROGRESS');

    // 5F: Submit Completion Work Report & Photos -> VERIFICATION_PENDING
    const evidenceRes = await axios.post(`${API_BASE}/engineer/evidence`, {
      complaintId,
      workDescription: 'Excavated damaged road layer, refilled with bitumen aggregate, compacted with roller.',
      findings: 'Sub-base soil erosion was present, fully stabilized.',
      actionTaken: 'Completed asphalt resurfacing and level alignment.',
      materialsUsed: ['Asphalt Cold Mix 50kg', 'Bitumen Emulsion Tack Coat', 'Gravel Aggregate'],
      additionalNotes: 'Road reopened for full traffic circulation.',
      beforeMedia: ['https://placehold.co/800x600/png?text=Before+Repair+Pothole'],
      afterMedia: ['https://placehold.co/800x600/png?text=After+Repair+Pothole+Fixed'],
      gpsConfirmation: { latitude: 12.9716, longitude: 77.5946, verified: true }
    }, { headers: { Authorization: `Bearer ${roadsEngToken}` } });
    assert(evidenceRes.data.status === 'VERIFICATION_PENDING', 'Work report submitted with evidence -> VERIFICATION_PENDING');

    // ─── STAGE 6: Status Transition Security Violation Check ─────────────────
    console.log('\n--- STAGE 6: Workflow Security Violation Checks ---');
    
    // 6A: Engineer CANNOT jump directly to CLOSED or approve own work
    let engineerIllegalApproveFailed = false;
    try {
      await axios.post(`${API_BASE}/engineer/status`, {
        complaintId,
        status: 'CLOSED',
        notes: 'Trying to close own task without department verification'
      }, { headers: { Authorization: `Bearer ${roadsEngToken}` } });
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 403) {
        engineerIllegalApproveFailed = true;
      }
    }
    assert(engineerIllegalApproveFailed, 'Security Rule: Engineer CANNOT mark own work directly as CLOSED (Requires Department Verification)');

    // ─── STAGE 7: Department Verification & Approval ─────────────────────────
    console.log('\n--- STAGE 7: Department Verification & Final Resolution ---');
    const verifyRes = await axios.post(`${API_BASE}/departments/verify-work`, {
      complaintId,
      decision: 'ACCEPT',
      remarks: 'After-repair photos and GPS coordinates inspected. Work conforms to municipal standards.'
    }, { headers: { Authorization: `Bearer ${roadsDeptToken}` } });

    assert(verifyRes.data.success, 'Department successfully verified and approved repair work');
    assert(
      verifyRes.data.status === 'CLOSED' || verifyRes.data.status === 'CITIZEN_VERIFICATION',
      `Final resolution status: ${verifyRes.data.status}`
    );

    // ─── STAGE 8: Verify Final State in DB ────────────────────────────────────
    console.log('\n--- STAGE 8: Database Integrity & Audit Verification ---');
    const finalCheck = await axios.get(`${API_BASE}/complaints/${complaintId}`);
    const finalComplaint = finalCheck.data.complaint || finalCheck.data;
    assert(finalComplaint.status === 'CLOSED' || finalComplaint.status === 'CITIZEN_VERIFICATION', `Database state confirmed: ${finalComplaint.status}`);
    assert(finalComplaint.assigned_engineer_id === roadsEngUser.id, 'Assigned engineer accurately recorded in Supabase PostgreSQL');
    assert(finalComplaint.department_id === 'roads', 'Department association accurately maintained throughout lifecycle');

    console.log('\n================================================================');
    console.log(` ALL ${passedCount} MULTI-DEPARTMENT REAL-TIME TESTS PASSED WITH 0 FAILURES!`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ Test execution failed with error:', err);
    if (err?.response?.data) {
      console.error('API Error Response:', JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

runTests();
