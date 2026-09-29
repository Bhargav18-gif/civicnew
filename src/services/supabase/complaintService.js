/**
 * CivicConnect — Complaint Service (Supabase Architecture)
 * 
 * Provides clean application data access for complaints.
 * Sensitive operations and business logic route through the backend API
 * which interacts with Supabase PostgreSQL using the service-role key.
 */

import { complaintApi } from '../api/complaintApi.js';

export const complaintService = {
  createComplaint: (payload) => complaintApi.createComplaint(payload),
  getComplaint: (id) => complaintApi.getComplaint(id),
  trackComplaint: (refId) => complaintApi.trackComplaint(refId),
  getCitizenComplaints: () => complaintApi.getCitizenComplaints(),
  approveResolution: (id, feedback) => complaintApi.approveResolution(id, feedback),
  reopenComplaint: (id, reason) => complaintApi.reopenComplaint(id, reason),
};

export default complaintService;
