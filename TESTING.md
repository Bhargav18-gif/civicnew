# CivicConnect Testing Suite & Verification Guide

CivicConnect includes comprehensive automated testing covering authentication, the 17-state finite state machine, deterministic priority evaluation, duplicate detection, role-based access restrictions, and model registries.

---

## 1. Running the Automated Test Suite

Execute the canonical end-to-end integration and workflow test suite:

```bash
node test_canonical_workflow.mjs
```

### Expected Output:
```text
================================================================
CIVICCONNECT — FULL CANONICAL END-TO-END WORKFLOW TEST SUITE
================================================================
--- TEST 1: Server Health Check ---
  ✓ PASS: Server responds with status 200 OK

--- TEST 2: Priority Engine Verification ---
  ✓ PASS: Exposed wire is escalated deterministically to CRITICAL
  ✓ PASS: Cosmetic paint issue is categorized as LOW

--- TEST 3: Duplicate Detection Mathematical Distance & Token Overlap ---
  ✓ PASS: Calculated accurate distance of ~154m between nearby coordinates
  ✓ PASS: Calculated text similarity score of 0.57 on overlapping descriptions

--- TEST 4: Citizen Complaint Registration ---
  ✓ PASS: Complaint created successfully with HTTP 201
  ✓ PASS: Valid canonical reference ID assigned: CC-2026-...
  ✓ PASS: Citizen profile recorded correctly in canonical model
  ✓ PASS: Before media photo registered
  ✓ PASS: Priority engine correctly set priority: HIGH

--- TEST 5: Public Tracking Sanitization ---
  ✓ PASS: Public tracking lookup succeeds
  ✓ PASS: Tracking returns complaint reference ID
  ✓ PASS: Citizen email is strictly stripped from public tracking
  ✓ PASS: Citizen UID is strictly stripped from public tracking

--- TEST 6: Department Workflow & Engineer Assignment ---
  ✓ PASS: Department complaints endpoint responds with status 200
  ✓ PASS: Department assignment endpoint enforces validation contract

--- TEST 7: Engineer Explicit State Machine Transitions ---
  ✓ PASS: Engineer can transition ASSIGNED -> ACCEPTED_BY_ENGINEER
  ✓ PASS: Engineer can transition ACCEPTED_BY_ENGINEER -> EN_ROUTE
  ✓ PASS: Engineer can transition EN_ROUTE -> ON_SITE
  ✓ PASS: Engineer can transition ON_SITE -> IN_PROGRESS
  ✓ PASS: Engineer can transition IN_PROGRESS -> VERIFICATION_PENDING
  ✓ PASS: Engineer CANNOT directly close complaint (forbidden transition)

--- TEST 8: Engineer Evidence Upload Validation ---
  ✓ PASS: Rejects empty evidence upload without authentic repair photos

--- TEST 9: Department Verification Rules ---
  ✓ PASS: Department approval routes to CITIZEN_VERIFICATION
  ✓ PASS: Department rejection routes back to IN_PROGRESS for rework

--- TEST 10: Citizen Verification Approval & Reopen ---
  ✓ PASS: Citizen approval transitions to CLOSED
  ✓ PASS: Citizen rejection transitions to REOPENED

--- TEST 11: Admin Automation Config ---
  ✓ PASS: Admin can retrieve dynamic AI routing thresholds

--- TEST 12: AI Model Registry ---
  ✓ PASS: Admin model registry returns active model candidates

================================================================
TEST SUMMARY: 29 PASSED, 0 FAILED
================================================================
```

---

## 2. Static Analysis & Build Verification

```bash
# 1. Linting Verification (Zero Errors)
npm run lint -- --quiet

# 2. Vite Production Build (Zero Compilation Errors)
npm run build
```

---

## 3. Coverage Matrix

| Test Domain | Target Code | Verified Behaviors |
|---|---|---|
| Priority Engine | `functions/priority.js` | Severity keyword matching, auto-escalation to `CRITICAL` for life-safety hazards. |
| Duplicate Detection | `functions/duplicates.js` | Haversine distance thresholding and Jaccard token overlap calculation. |
| Canonical Schema | `src/utils/complaintSchema.js` | Generation of structured schema, rejection of top-level legacy mutations. |
| Public Privacy | `functions/complaintsHandler.js` | Stripping of PII (emails, UIDs, phones) on public `/api/public/track/:refId`. |
| Role Boundaries | `functions/authMiddleware.js` | Enforcement of role permissions; blocking unauthorized transitions. |
| Evidence Guard | `functions/engineerHandler.js` | Mandatory non-empty `afterMedia` array and notes before verification request. |
| Citizen Closure | `src/pages/TrackComplaintPage.jsx` | Explicit citizen confirmation for `CLOSED` vs `REOPENED`. |
| Admin Config | `functions/adminHandler.js` | Fetching and updating AI dynamic routing thresholds. |
