# CivicConnect Admin Task Classifier — AI Service

An isolated, modular Python AI service for **CivicConnect** that uses Hugging Face Transformers (`microsoft/deberta-v3-base`) to classify citizen civic complaints, calculate confidence scores, recommend administrative action, and capture administrator decisions for continuous model improvement.

---

## 1. Overview & Purpose

When a citizen submits a report (e.g., *"There is a huge pothole near the school and several people have fallen"*), the **CivicConnect Admin Task Classifier**:
1. Analyzes the natural language description.
2. Predicts the responsible **Department** (Roads, Water, Electricity, Sanitation, Drainage, Traffic, Public Health, Municipal Services).
3. Computes a **Confidence Score** and **Confidence Level** (`high`, `medium`, `low`).
4. Recommends the corresponding **Work Type** and **Administrative Action**.
5. Displays candidate recommendations in the Admin Dashboard with top-3 alternative choices.
6. **Preserves Human Authority**: The municipal administrator can accept the recommendation or override it. Overrides are recorded to an audit feedback log for offline retraining.

---

## 2. System Architecture

```mermaid
graph TD
    subgraph Frontend [React Admin Interface]
        AdminUI[Admin Complaint Modal] -->|Complaint Text| RecComponent[AI Admin Recommendation Card]
        RecComponent -->|Accept or Override| Firestore[(Firebase Firestore)]
        RecComponent -->|POST /api/admin/ai/classify| NodeProxy[Existing Node.js Backend :5177]
        RecComponent -->|POST /api/admin/ai/feedback| NodeProxy
    end

    subgraph Backend [Node.js Proxy Gateway]
        NodeProxy -->|HTTP Forward| FastAPIService[Python AI Service :8000]
    end

    subgraph AIService [Isolated Python AI Service (/ai)]
        FastAPIService --> InferenceEngine[src/predict.py]
        InferenceEngine --> DeBERTaModel[DeBERTa-v3-base Classifier]
        FastAPIService --> FeedbackStore[(dataset/admin_feedback.jsonl)]
    end

    subgraph OfflineTraining [Training & Evaluation Pipeline]
        CSVData[dataset/train.csv, val.csv, test.csv] --> DataVal[src/dataset.py Quality Checks]
        DataVal --> TrainLoop[src/train.py Fine-Tuner]
        TrainLoop --> ModelCheckpoints[model/civicconnect-admin-classifier/]
        ModelCheckpoints --> EvalEngine[src/evaluate.py Metrics & Confusion Matrix]
    end
```

---

## 3. Why DeBERTa-v3?

`microsoft/deberta-v3-base` (Decoding-enhanced BERT with Disentangled Attention) is chosen because:
- **Disentangled Attention**: Handles positional and content encodings separately, significantly improving understanding of relative spatial contexts in text.
- **Enhanced Masked Language Modeling (RTD)**: Trained with replaced token detection rather than traditional MLM, resulting in state-of-the-art token representations.
- **Superior Natural Language Understanding**: Excels at ambiguous, citizen-worded problem statements (e.g. distinguishing a "water drain burst" between Water and Drainage).

---

## 4. Directory Structure

```
ai/
├── dataset/
│   ├── train.csv                # Demonstration training set (240 records, 30 per class)
│   ├── validation.csv           # Demonstration validation set (48 records)
│   ├── test.csv                 # Demonstration test set (48 records)
│   └── admin_feedback.jsonl     # Persistent store for admin overrides and decisions
│
├── model/
│   ├── checkpoints/             # Hugging Face trainer epoch checkpoints
│   └── civicconnect-admin-classifier/  # Exported model weights, tokenizer & config
│
├── src/
│   ├── __init__.py
│   ├── config.py                # Model paths, label mappings, thresholds & hyperparameters
│   ├── dataset.py               # Data loading, validation, and quality auditing
│   ├── train.py                 # Hugging Face sequence classification fine-tuning script
│   ├── evaluate.py              # Test set evaluation: Macro F1, precision, recall & confusion matrix
│   ├── predict.py               # CLI inference and prediction engine
│   └── api.py                   # FastAPI / REST API service on port 8000
│
├── requirements.txt             # Pinned Python package dependencies
├── README.md                    # System documentation
└── .gitignore                   # Excludes venv, weights, caches, and secrets
```

---

## 5. Label Mappings & Departments

The classifier maps 8 municipal departments:

| Label ID | Department Name | Sample Issue | Default Work Type |
| :---: | :--- | :--- | :--- |
| `0` | **Roads** | Pothole, asphalt damage, road cave-in | Road & Pavement Repair |
| `1` | **Water** | Pipe leakage, contaminated water, low pressure | Water Supply & Pipeline Restoration |
| `2` | **Electricity** | Broken streetlight, sparking transformer, hanging wire | Electrical Infrastructure & Lighting |
| `3` | **Sanitation** | Overflowing dumpster, dead animal, garbage dumping | Waste Collection & Clearance |
| `4` | **Drainage** | Blocked sewer, stormwater overflow, flooded basement | Stormwater Drainage & Desilting |
| `5` | **Traffic** | Stuck traffic light, faded zebra crossing, missing sign | Traffic Signal & Signage Maintenance |
| `6` | **Public Health** | Mosquito breeding, stray dogs, dengue fogging | Vector Control & Public Hygiene |
| `7` | **Municipal Services** | Broken park swings, cemetery issues, tree branch on roof | Public Facility & Park Maintenance |

---

## 6. Confidence Handling & Thresholds

Configured in [src/config.py](file:///c:/Users/gowth/Downloads/CivicConnect-master/CivicConnect-master/ai/src/config.py):
- **$\ge 0.90$ (High Confidence)**: Recommended directly to the administrator (`requires_admin_review = false`).
- **$0.70 - 0.89$ (Requires Review)**: Flags for review; presents top-3 alternative departments (`requires_admin_review = true`).
- **$< 0.70$ (Low Confidence)**: Flags for manual triage; highlights ambiguity in citizen description.

---

## 7. Setup & Installation (Windows)

### Step 1: Create Virtual Environment
Open PowerShell inside `CivicConnect-master/ai`:
```powershell
cd ai
python -m venv .venv
```

### Step 2: Activate Virtual Environment
```powershell
.\.venv\Scripts\Activate.ps1
```

*(If PowerShell script execution is restricted, run: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`)*

### Step 3: Install Requirements
```powershell
pip install -r requirements.txt
```

---

## 8. Training & Evaluation

### Validate Dataset Quality
```powershell
python src/dataset.py
```
Checks for missing values, short strings, duplicate complaints, and class balance.

### Fine-Tune Model
```powershell
# Standard training (3 epochs, auto GPU/CPU detection):
python src/train.py

# Or run quick demo mode (1 epoch):
python src/train.py --demo
```
The trained model, tokenizer, and label mappings are saved to `model/civicconnect-admin-classifier/`.

### Evaluate on Test Data
```powershell
python src/evaluate.py
```
Outputs Accuracy, Macro Precision, Macro Recall, Macro F1, classification report, and confusion matrix.

---

## 9. CLI Inference

Run predictions directly from the command line:
```powershell
python src/predict.py "There is a huge pothole near the school and several people have fallen."
```

Example Output:
```text
------------------------------------------------------------
CIVICCONNECT ADMIN TASK CLASSIFICATION
------------------------------------------------------------
Complaint         : There is a huge pothole near the school and several people have fallen.
Predicted Dept    : Roads
Confidence        : 95.4% (HIGH)
Requires Review   : NO (High Confidence)
Work Type         : Road & Pavement Repair
Priority          : High
Recommended Action: Assign Road Maintenance Team for inspection and pothole/pavement restoration.

Top 3 Candidate Departments:
  - Roads               : 95.4%
  - Traffic             : 2.8%
  - Municipal Services  : 0.9%
------------------------------------------------------------
```

---

## 10. Running the API Service

Start the REST API service (binds to `http://127.0.0.1:8000`):
```powershell
python src/api.py
```

### API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service status, model version, and loaded device |
| `GET` | `/model-info` | Label map, confidence thresholds, and model metadata |
| `POST` | `/predict` | Classify a single complaint string |
| `POST` | `/predict/batch` | Classify an array of complaints |
| `POST` | `/feedback` | Ingest administrator accept/override feedback |

#### Sample Prediction Request (`POST /predict`):
```json
{
  "complaint": "Water pipeline is leaking outside my house and clean drinking water is wasting",
  "complaint_id": "CC-WAT202"
}
```

#### Sample Prediction Response:
```json
{
  "complaint_id": "CC-WAT202",
  "complaint": "Water pipeline is leaking outside my house and clean drinking water is wasting",
  "department": "Water",
  "confidence": 0.962,
  "confidence_percentage": "96.2%",
  "confidence_level": "high",
  "requires_admin_review": false,
  "work_type": "Water Supply & Pipeline Restoration",
  "priority": "High",
  "recommended_action": "Dispatch Water Works Plumbing Crew to halt leakage and test pressure.",
  "top_predictions": [
    { "department": "Water", "confidence": 0.962, "percentage": "96.2%" },
    { "department": "Drainage", "confidence": 0.024, "percentage": "2.4%" },
    { "department": "Municipal Services", "confidence": 0.007, "percentage": "0.7%" }
  ],
  "model_version": "deberta-v3-base-cc-v1.0",
  "engine": "deberta-v3-base"
}
```

#### Sample Feedback Request (`POST /feedback`):
```json
{
  "complaint_id": "CC-WAT202",
  "complaint_text": "Water pipeline is leaking...",
  "original_prediction": "Drainage",
  "original_confidence": 0.62,
  "admin_decision": "Water",
  "is_override": true,
  "admin_id": "admin-01"
}
```

---

## 11. CivicConnect Integration & Admin Overrides

1. **Node.js Proxy**: The existing Node backend (`server/index.js`) exposes `/api/admin/ai/classify` and `/api/admin/ai/feedback`, forwarding calls securely to the Python AI service.
2. **Admin UI Component**: `<AIAdminRecommendation />` is embedded in the admin [ComplaintDetailsModal.jsx](file:///c:/Users/gowth/Downloads/CivicConnect-master/CivicConnect-master/src/components/admin/ComplaintDetailsModal.jsx).
3. **Audit Trail**: When the administrator accepts or overrides a recommendation, Firestore records:
   - `aiPrediction`
   - `aiConfidence`
   - `aiModelVersion`
   - `adminDecision`
   - `adminOverride` (`true` / `false`)
   - `predictionTimestamp`

---

## 12. Future Multi-Task Architecture

The current architecture establishes the **Department Head**. The model can be extended to predict all four administrative facets simultaneously:

```text
               DeBERTa-v3 Backbone
                        |
       +----------------+----------------+----------------+
       |                |                |                |
Department Head   Work Type Head   Priority Head    Action Head
(8 classes)       (Multi-class)    (Low/Med/High)   (Sequence Gen)
```

---

## 13. Limitations & Data Disclaimer

- **Demonstration Dataset**: The included datasets are synthetic demonstration samples curated to test and verify the machine learning pipeline and user interface.
- **Production Retraining**: Real-world deployment requires training on thousands of authentic, verified municipal complaint records collected via the feedback loop.
