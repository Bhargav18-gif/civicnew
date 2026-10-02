/**
 * Complaints Helper for CivicConnect Tests
 * Programmatic creation, fetching, updating, and verification of complaints.
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:5177/api';

/**
 * Creates a complaint via backend API.
 */
export async function createComplaintViaApi(complaintData, userToken = null) {
  const headers = userToken ? { Authorization: `Bearer ${userToken}` } : {};
  const res = await axios.post(
    `${API_BASE_URL}/complaints`,
    complaintData,
    { headers, timeout: 10000 }
  );
  return res.data.complaint || res.data;
}

/**
 * Retrieves a complaint by ID or Reference ID.
 */
export async function getComplaintViaApi(idOrRef, userToken = null) {
  const headers = userToken ? { Authorization: `Bearer ${userToken}` } : {};
  const res = await axios.get(
    `${API_BASE_URL}/complaints/${idOrRef}`,
    { headers, timeout: 10000 }
  );
  return res.data.complaint || res.data;
}

/**
 * Fetches public tracking details (sanitized, PII stripped).
 */
export async function getPublicTrackingViaApi(refId) {
  const res = await axios.get(
    `${API_BASE_URL}/public/track/${refId}`,
    { timeout: 10000 }
  );
  return res.data;
}

/**
 * Assigns complaint to an engineer (Department/Admin only).
 */
export async function assignEngineerViaApi(complaintId, engineerId, deptToken, notes = '') {
  let targetEngId = engineerId;
  if (deptToken && (!targetEngId || targetEngId.includes('@'))) {
    try {
      const engRes = await axios.get(`${API_BASE_URL}/departments/roads/engineers`, {
        headers: { Authorization: `Bearer ${deptToken}` },
        timeout: 5000
      });
      if (engRes.data?.engineers?.length > 0) {
        targetEngId = engRes.data.engineers[0].id;
      }
    } catch (_) {}
  }

  const headers = deptToken ? { Authorization: `Bearer ${deptToken}` } : {};
  const res = await axios.post(
    `${API_BASE_URL}/departments/assign`,
    { complaintId, engineerId: targetEngId, notes },
    { headers, timeout: 10000, validateStatus: () => true }
  );
  return res.data;
}

/**
 * Updates engineer status.
 */
export async function updateEngineerStatusViaApi(complaintId, status, engToken, notes = '') {
  const res = await axios.post(
    `${API_BASE_URL}/engineer/status`,
    { complaintId, status, notes },
    { headers: { Authorization: `Bearer ${engToken}` }, timeout: 10000 }
  );
  return res.data;
}

/**
 * Submits completion evidence by engineer.
 */
export async function submitEngineerEvidenceViaApi(complaintId, afterMedia, notes, engToken) {
  const res = await axios.post(
    `${API_BASE_URL}/engineer/evidence`,
    { complaintId, afterMedia, notes },
    { headers: { Authorization: `Bearer ${engToken}` }, timeout: 10000 }
  );
  return res.data;
}

/**
 * Verifies complaint by department manager.
 */
export async function verifyComplaintByDeptViaApi(complaintId, approved, notes, deptToken) {
  const res = await axios.post(
    `${API_BASE_URL}/departments/verify-work`,
    { complaintId, decision: approved ? 'ACCEPT' : 'REJECT_FOR_REWORK', remarks: notes },
    { headers: { Authorization: `Bearer ${deptToken}` }, timeout: 10000 }
  );
  return res.data;
}

/**
 * Verifies complaint by citizen.
 */
export async function verifyComplaintByCitizenViaApi(complaintId, decision, feedback, citizenToken) {
  const res = await axios.post(
    `${API_BASE_URL}/complaints/${complaintId}/citizen-verify`,
    { decision: decision ? 'APPROVE' : 'REOPEN', feedback },
    { headers: { Authorization: `Bearer ${citizenToken}` }, timeout: 10000 }
  );
  return res.data;
}
