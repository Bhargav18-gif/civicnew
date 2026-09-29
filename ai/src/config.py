import os
from pathlib import Path

# ==============================================================================
# Paths Configuration
# ==============================================================================
BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_DIR = BASE_DIR / "dataset"
MODEL_DIR = BASE_DIR / "model" / "civicconnect-admin-classifier"
CHECKPOINT_DIR = BASE_DIR / "model" / "checkpoints"
FEEDBACK_LOG_PATH = DATASET_DIR / "admin_feedback.jsonl"

TRAIN_CSV = DATASET_DIR / "train.csv"
VALIDATION_CSV = DATASET_DIR / "validation.csv"
TEST_CSV = DATASET_DIR / "test.csv"

# ==============================================================================
# Model & Architecture Configuration
# ==============================================================================
MODEL_VERSION = "civicconnect-admin-v1"
BASE_MODEL_NAME = os.getenv("BASE_MODEL_NAME", "distilbert-base-uncased")
FALLBACK_MODEL_NAME = "distilbert-base-uncased"

# ==============================================================================
# Label Mappings (Department Classifier Head)
# ==============================================================================
# 0 = Roads, 1 = Water, 2 = Electricity, 3 = Sanitation,
# 4 = Drainage, 5 = Traffic, 6 = Public Health, 7 = Municipal Services
ID_TO_LABEL = {
    0: "Roads",
    1: "Water",
    2: "Electricity",
    3: "Sanitation",
    4: "Drainage",
    5: "Traffic",
    6: "Public Health",
    7: "Municipal Services",
}

LABEL_TO_ID = {v: k for k, v in ID_TO_LABEL.items()}
NUM_LABELS = len(ID_TO_LABEL)

# ==============================================================================
# Administrative Action & Work Type Guidance
# (Designed for modular multi-head expansion: Work Type, Priority, Action)
# ==============================================================================
DEPARTMENT_ACTION_MAP = {
    "Roads": {
        "work_type": "Road & Pavement Repair",
        "default_priority": "High",
        "recommended_action": "Assign Road Maintenance Team for inspection and pothole/pavement restoration.",
    },
    "Water": {
        "work_type": "Water Supply & Pipeline Restoration",
        "default_priority": "High",
        "recommended_action": "Dispatch Water Works Plumbing Crew to halt leakage and test pressure.",
    },
    "Electricity": {
        "work_type": "Electrical Infrastructure & Lighting",
        "default_priority": "High",
        "recommended_action": "Deploy Electrical Maintenance Squad to repair lines/transformers/streetlights.",
    },
    "Sanitation": {
        "work_type": "Waste Collection & Clearance",
        "default_priority": "Medium",
        "recommended_action": "Route Municipal Sanitation Truck for garbage pickup and site disinfection.",
    },
    "Drainage": {
        "work_type": "Stormwater Drainage & Desilting",
        "default_priority": "High",
        "recommended_action": "Dispatch Stormwater Drainage Unit to clear blockages and pump stagnant water.",
    },
    "Traffic": {
        "work_type": "Traffic Signal & Signage Maintenance",
        "default_priority": "Medium",
        "recommended_action": "Alert Traffic Management Cell to fix broken signal/road markings.",
    },
    "Public Health": {
        "work_type": "Vector Control & Public Hygiene",
        "default_priority": "High",
        "recommended_action": "Notify Public Health Inspector for fumigation and sanitary inspection.",
    },
    "Municipal Services": {
        "work_type": "Public Facility & Park Maintenance",
        "default_priority": "Low",
        "recommended_action": "Notify Civic Services Ward Officer to inspect and schedule municipal repair.",
    },
}

# ==============================================================================
# Confidence Thresholds
# ==============================================================================
# >= 0.90 -> High-confidence recommendation
# 0.70 - 0.89 -> Requires admin review
# < 0.70 -> Low-confidence prediction / manual classification recommended
CONFIDENCE_HIGH_THRESHOLD = float(os.getenv("CONFIDENCE_HIGH_THRESHOLD", "0.90"))
CONFIDENCE_MEDIUM_THRESHOLD = float(os.getenv("CONFIDENCE_MEDIUM_THRESHOLD", "0.70"))

# ==============================================================================
# Training Hyperparameters
# ==============================================================================
MAX_LENGTH = 128
TRAIN_BATCH_SIZE = int(os.getenv("TRAIN_BATCH_SIZE", "8"))
EVAL_BATCH_SIZE = int(os.getenv("EVAL_BATCH_SIZE", "16"))
LEARNING_RATE = float(os.getenv("LEARNING_RATE", "2e-5"))
NUM_EPOCHS = int(os.getenv("NUM_EPOCHS", "3"))
WEIGHT_DECAY = 0.01
WARMUP_RATIO = 0.1

# ==============================================================================
# FastAPI Service Configuration
# ==============================================================================
API_HOST = os.getenv("API_HOST", "127.0.0.1")
API_PORT = int(os.getenv("API_PORT", "8000"))
API_DEBUG = os.getenv("API_DEBUG", "false").lower() == "true"
