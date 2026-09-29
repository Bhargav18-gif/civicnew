# CivicConnect API Contract Specification

All CivicConnect backend endpoints run on `/api/*` and require standard JSON payloads and responses.

---

## 1. Authentication & Headers

| Header | Description |
|---|---|
| `Authorization` | `Bearer <Firebase_ID_Token>` |
| `Content-Type` | `application/json` |

---

## 2. Standard Error Format

```json
{
  "error": "Error message explanation",
  "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | INVALID_TRANSITION | AI_UNAVAILABLE",
  "details": {}
}
```

---

## 3. Core API Endpoints

### 3.1 Complaints Service

#### `POST /api/complaints`
- **Role**: Citizen, Admin
- **Payload**:
```json
{
  "title": "Broken streetlight outside hospital",
  "description": "Streetlight pole dangling dangerously.",
  "category": "Electricity & Lighting",
  "location": {
    "lat": 37.7749,
    "lng": -122.4194,
    "address": "123 Market St"
  },
  "media": {
    "before": ["https://res.cloudinary.com/.../img1.jpg"]
  }
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "complaintId": "doc_id_xyz",
  "referenceId": "CC-2026-B8D9E1",
  "status": "ROUTED"
}
```

#### `GET /api/complaints/user`
- **Role**: Authenticated User
- **Response (200 OK)**:
```json
[
  {
    "id": "doc_id_xyz",
    "referenceId": "CC-2026-B8D9E1",
    "workflow": { "status": "ASSIGNED" },
    "issue": { "title": "Broken streetlight" }
  }
]
```

#### `GET /api/public/track/:refId`
- **Role**: Public (No Auth Required)
- **Sanitized Response (200 OK)**:
```json
{
  "referenceId": "CC-2026-B8D9E1",
  "category": "Electricity & Lighting",
  "status": "ASSIGNED",
  "createdAt": "2026-09-28T16:00:00.000Z",
  "timeline": [
    { "status": "SUBMITTED", "timestamp": "..." },
    { "status": "ROUTED", "timestamp": "..." },
    { "status": "ASSIGNED", "timestamp": "..." }
  ]
}
```
*Note: Citizen email, phone, UID, and internal notes are stripped from public tracking.*

---

### 3.2 Department Operations

#### `GET /api/department/complaints`
- **Role**: Department (`role == "department"`), Admin
- **Response**: List of complaints where `routing.departmentId == user.departmentId`.

#### `GET /api/department/engineers`
- **Role**: Department, Admin
- **Response**: List of active engineers belonging to this department with current active task count.

#### `POST /api/department/assign`
- **Role**: Department, Admin
- **Payload**:
```json
{
  "complaintId": "doc_id_xyz",
  "engineerId": "uid_eng_456"
}
```
- **Validation**: Enforces Firestore transaction, checks engineer department match and active status, transitions workflow to `ASSIGNED`.

#### `POST /api/department/verify`
- **Role**: Department, Admin
- **Payload**:
```json
{
  "complaintId": "doc_id_xyz",
  "approved": true,
  "notes": "Verified road resurfacing complete"
}
```
- **Effect**: If approved, transitions to `CITIZEN_VERIFICATION`. If rejected, transitions back to `IN_PROGRESS` for rework.

---

### 3.3 Engineer Workstation

#### `GET /api/engineer/tasks`
- **Role**: Engineer (`role == "engineer"`)
- **Query Filter**: `assignment.engineerId == user.uid` strictly enforced.

#### `POST /api/engineer/status`
- **Role**: Engineer
- **Payload**:
```json
{
  "complaintId": "doc_id_xyz",
  "status": "EN_ROUTE | ON_SITE | IN_PROGRESS"
}
```
- **Validation**: Validates permitted step in state machine.

#### `POST /api/engineer/evidence`
- **Role**: Engineer
- **Payload**:
```json
{
  "complaintId": "doc_id_xyz",
  "afterMedia": ["https://res.cloudinary.com/.../repair_done.jpg"],
  "notes": "Replaced ballast and bulb on pole 42."
}
```
- **Validation**: Enforces non-empty `afterMedia` array and notes; transitions complaint to `VERIFICATION_PENDING`.

---

### 3.4 AI Gateway

#### `POST /api/ai/classify`
- **Role**: Authenticated Citizen / Internal
- **Payload**:
```json
{
  "title": "Deep pothole",
  "description": "Exposed asphalt cavity on expressway",
  "imageUrls": ["..."]
}
```
- **Response**:
```json
{
  "category": "Roads & Infrastructure",
  "department": "roads",
  "priority": "HIGH",
  "confidence": 0.94,
  "requiresHumanReview": false,
  "modelVersion": "gemini-2.5-flash-v1"
}
```

#### `POST /api/ai/verify`
- **Role**: Internal / Department
- **Payload**: `{ "complaintId": "...", "beforeUrls": [...], "afterUrls": [...] }`
- **Response**:
```json
{
  "match": true,
  "confidence": 0.89,
  "notes": "Visual evidence indicates issue was repaired."
}
```

---

### 3.5 Administration

#### `GET /api/admin/config/ai`
- **Role**: Admin
- **Response**: Auto-routing thresholds, duplicate radius, and model versions.

#### `POST /api/admin/config/ai`
- **Role**: Admin
- **Payload**: `{ "highConfidenceThreshold": 0.85, "adminReviewThreshold": 0.65 }`

#### `GET /api/admin/models`
- **Role**: Admin
- **Response**: List of candidate, shadow, and production model versions.
