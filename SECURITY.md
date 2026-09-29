# CivicConnect Security & Access Control Model

---

## 1. Authentication & Identity Architecture

1. **Identity Provider**: Firebase Authentication.
2. **Session Verification**:
   Every API request transmits an ID token in the `Authorization: Bearer <token>` header.
   The backend verifies signature, expiration, and user UID via `admin.auth().verifyIdToken()`.
3. **Role Determination**:
   Roles are determined strictly by verified custom claims or server-side user documents (`users/{uid}`). Client-supplied role parameters in request payloads are ignored.

---

## 2. Role-Based Access Control (RBAC)

| Role | Scope | Permitted Read | Permitted Write |
|---|---|---|---|
| **Citizen** | Personal | Own complaints & public tracking summaries | Submit complaints, approve resolution, reopen complaint |
| **Department** | Municipal Department | Complaints routed to their `departmentId`, departmental engineers | Accept complaints, assign engineers, verify engineer evidence |
| **Engineer** | Assigned Tasks | Complaints where `assignment.engineerId == user.uid` | Advance task state (`ACCEPTED` $\rightarrow$ `IN_PROGRESS`), upload repair evidence |
| **Admin** | System-Wide | All complaints, AI queues, audit logs, user directory | Override AI decisions, configure thresholds, manage users & models |

---

## 3. Cloud Firestore Security Rules (`firestore.rules`)

Key protections enforced in database rules:
- **Zero Wildcard Public Access**: `allow read, write: if true;` has been removed.
- **Private Complaint Protection**:
  - Citizens can only read complaints where `resource.data.citizen.userId == request.auth.uid`.
  - Engineers can only read complaints where `resource.data.assignment.engineerId == request.auth.uid`.
  - Department users can only read complaints where `resource.data.routing.departmentId == request.auth.token.departmentId`.
- **Public Tracking Sanitization**:
  The public tracking endpoint extracts a sanitized subset (`referenceId`, `category`, `status`, `createdAt`, `timeline`), excluding citizen email, telephone, UID, and internal notes.
- **Immutable Audit Ledger**:
  The `audit_events` collection is read-only for Admin and write-only via backend service accounts; client writes are strictly blocked.

---

## 4. File & Evidence Upload Security

- **Supported MIME Types**: `image/jpeg`, `image/png`, `image/webp`.
- **Max File Size**: 10 MB per image.
- **Storage Segregation**:
  - Before photos: `citizens/{uid}/complaints/{complaintId}/before/`
  - Repair evidence: `engineers/{uid}/complaints/{complaintId}/after/`
- **Authentic Verification**:
  Repair evidence requires real upload URLs; mock placeholder URLs or unverified Unsplash links are rejected during evidence submission.
