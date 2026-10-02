import { test, expect } from '@playwright/test';
import axios from 'axios';
import { TEST_USERS } from '../helpers/test-data.js';
import { getFirebaseAuthToken } from '../helpers/auth.js';

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:5177/api';

test.describe('4. API / Backend Comprehensive Verification Suite', () => {

  let citizenToken = null;
  let adminToken = null;
  let roadsMgrToken = null;
  let roadsEngToken = null;

  test.beforeAll(async () => {
    try {
      const cit = await getFirebaseAuthToken(TEST_USERS.citizen.email, TEST_USERS.citizen.password);
      citizenToken = cit.idToken;

      const adm = await getFirebaseAuthToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
      adminToken = adm.idToken;

      const mgr = await getFirebaseAuthToken(TEST_USERS.departments.roads.manager.email, TEST_USERS.departments.roads.manager.password);
      roadsMgrToken = mgr.idToken;

      const eng = await getFirebaseAuthToken(TEST_USERS.departments.roads.engineer.email, TEST_USERS.departments.roads.engineer.password);
      roadsEngToken = eng.idToken;
    } catch (e) {
      console.warn('Token initialization notice:', e.message);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // HEALTH & DISCOVERY
  // ─────────────────────────────────────────────────────────────────────────
  test('GET /api/health - Returns 200 with service health status', async () => {
    const res = await axios.get(`${API_BASE}/health`, { validateStatus: () => true });
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('ok');
    expect(res.data.service).toContain('CivicConnect');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AUTH SYNC & PROFILE
  // ─────────────────────────────────────────────────────────────────────────
  test('POST /api/auth/sync - Valid token synchronizes user and returns role', async () => {
    if (!citizenToken) test.skip();
    const res = await axios.post(`${API_BASE}/auth/sync`, {
      name: 'Sanjay Citizen',
      email: TEST_USERS.citizen.email
    }, {
      headers: { Authorization: `Bearer ${citizenToken}` },
      validateStatus: () => true
    });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.user.role).toBe('CITIZEN');
  });

  test('POST /api/auth/sync - 401 on unauthenticated request', async () => {
    const res = await axios.post(`${API_BASE}/auth/sync`, {
      name: 'Unauth User'
    }, { validateStatus: () => true });
    expect(res.status).toBe(401);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // COMPLAINTS LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────
  let createdComplaintId = null;
  let createdRefId = null;

  test('POST /api/complaints - 201 Created on valid complaint submission', async () => {
    const res = await axios.post(`${API_BASE}/complaints`, {
      description: 'API Test: Hazardous deep pothole on Ring Road Service Lane.',
      category: 'Roads & Infrastructure',
      lat: 17.7289,
      lng: 83.3031,
      address: 'Ring Road Pillar 12',
      email: TEST_USERS.citizen.email,
      imageURL: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600'
    }, { validateStatus: () => true });

    expect([200, 201]).toContain(res.status);
    const complaint = res.data.complaint || res.data;
    expect(complaint.id).toBeDefined();
    createdComplaintId = complaint.id;
    createdRefId = complaint.reference_id || complaint.referenceId;
    expect(createdRefId).toMatch(/^CC-/);
  });

  test('POST /api/complaints - 400 Bad Request on empty/missing description', async () => {
    const res = await axios.post(`${API_BASE}/complaints`, {
      description: '',
      email: TEST_USERS.citizen.email
    }, { validateStatus: () => true });
    expect([400, 422]).toContain(res.status);
  });

  test('GET /api/complaints/:id - 200 Returns complaint by valid ID', async () => {
    if (!createdComplaintId) test.skip();
    const res = await axios.get(`${API_BASE}/complaints/${createdComplaintId}`, { validateStatus: () => true });
    expect(res.status).toBe(200);
    const c = res.data.complaint || res.data;
    expect(c.id).toBe(createdComplaintId);
  });

  test('GET /api/complaints/nonexistent-id-999 - 404 Not Found', async () => {
    const res = await axios.get(`${API_BASE}/complaints/nonexistent-id-999`, { validateStatus: () => true });
    expect([404, 400]).toContain(res.status);
  });

  test('GET /api/public/track/:refId - 200 Sanitized tracking without PII', async () => {
    if (!createdRefId) test.skip();
    const res = await axios.get(`${API_BASE}/public/track/${createdRefId}`, { validateStatus: () => true });
    expect(res.status).toBe(200);
    expect(res.data.referenceId || res.data.reference_id).toBe(createdRefId);
    expect(res.data.email).toBeUndefined();
    expect(res.data.citizen?.email).toBeUndefined();
  });

  test('GET /api/public/map-complaints - 200 Returns public geospatial complaints', async () => {
    const res = await axios.get(`${API_BASE}/public/map-complaints`, { validateStatus: () => true });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.complaints || res.data)).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AI TRIAGE & ROUTING
  // ─────────────────────────────────────────────────────────────────────────
  test('POST /api/ai/classify - Returns deterministic classification schema', async () => {
    const res = await axios.post(`${API_BASE}/ai/classify`, {
      text: 'Water pipe burst leaking drinking water onto road',
      description: 'Water pipe burst leaking drinking water onto road'
    }, { validateStatus: () => true });

    expect(res.status).toBe(200);
    expect(res.data.category || res.data.department).toBeDefined();
    expect(res.data.confidence).toBeGreaterThan(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DEPARTMENT & ENGINEER OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────
  test('GET /api/departments/roads/complaints - 200 for Roads Manager', async () => {
    if (!roadsMgrToken) test.skip();
    const res = await axios.get(`${API_BASE}/departments/roads/complaints`, {
      headers: { Authorization: `Bearer ${roadsMgrToken}` },
      validateStatus: () => true
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/departments/assign - 200 Assigns engineer', async () => {
    if (!createdComplaintId) test.skip();
    
    // Fetch real engineer UUID
    let targetEngId = TEST_USERS.departments.roads.engineer.email;
    if (roadsMgrToken) {
      const engRes = await axios.get(`${API_BASE}/departments/roads/engineers`, {
        headers: { Authorization: `Bearer ${roadsMgrToken}` },
        validateStatus: () => true
      });
      if (engRes.data?.engineers?.length > 0) {
        targetEngId = engRes.data.engineers[0].id;
      }
    }

    const res = await axios.post(`${API_BASE}/departments/assign`, {
      complaintId: createdComplaintId,
      engineerId: targetEngId,
      notes: 'Dispatched for repair'
    }, {
      headers: roadsMgrToken ? { Authorization: `Bearer ${roadsMgrToken}` } : {},
      validateStatus: () => true
    });
    expect([200, 201]).toContain(res.status);
  });

  test('POST /api/engineer/status - 200 Progresses state', async () => {
    if (!createdComplaintId) test.skip();
    
    // Progress through state machine
    const states = ['ACCEPTED_BY_ENGINEER', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS'];
    for (const st of states) {
      const res = await axios.post(`${API_BASE}/engineer/status`, {
        complaintId: createdComplaintId,
        status: st,
        notes: `Progressed to ${st}`
      }, {
        headers: roadsEngToken ? { Authorization: `Bearer ${roadsEngToken}` } : {},
        validateStatus: () => true
      });
      expect(res.status).toBe(200);
    }
  });

  test('POST /api/engineer/evidence - 400 when complaintId is missing', async () => {
    const res = await axios.post(`${API_BASE}/engineer/evidence`, {
      complaintId: '',
      afterMedia: [],
      notes: ''
    }, {
      headers: roadsEngToken ? { Authorization: `Bearer ${roadsEngToken}` } : {},
      validateStatus: () => true
    });
    expect([400, 422]).toContain(res.status);
  });

  test('POST /api/engineer/evidence - 200 with valid completion evidence', async () => {
    if (!createdComplaintId) test.skip();
    const res = await axios.post(`${API_BASE}/engineer/evidence`, {
      complaintId: createdComplaintId,
      afterMedia: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600'],
      notes: 'Asphalt resurfacing complete.'
    }, {
      headers: roadsEngToken ? { Authorization: `Bearer ${roadsEngToken}` } : {},
      validateStatus: () => true
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/departments/verify-work - 200 Department verifies resolution', async () => {
    if (!createdComplaintId) test.skip();
    const res = await axios.post(`${API_BASE}/departments/verify-work`, {
      complaintId: createdComplaintId,
      decision: 'ACCEPT',
      remarks: 'Verified road repaired.'
    }, {
      headers: roadsMgrToken ? { Authorization: `Bearer ${roadsMgrToken}` } : {},
      validateStatus: () => true
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/complaints/:id/citizen-verify - 200 Citizen closes ticket', async () => {
    if (!createdComplaintId) test.skip();
    const res = await axios.post(`${API_BASE}/complaints/${createdComplaintId}/citizen-verify`, {
      decision: 'APPROVE',
      feedback: 'Good repair work.'
    }, {
      headers: citizenToken ? { Authorization: `Bearer ${citizenToken}` } : {},
      validateStatus: () => true
    });
    expect(res.status).toBe(200);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN ANALYTICS & CONFIG
  // ─────────────────────────────────────────────────────────────────────────
  test('GET /api/admin/automation-config - 200 for Admin', async () => {
    if (!adminToken) test.skip();
    const res = await axios.get(`${API_BASE}/admin/automation-config`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      validateStatus: () => true
    });
    expect(res.status).toBe(200);
    expect(res.data.highConfidenceThreshold).toBeDefined();
  });

});
