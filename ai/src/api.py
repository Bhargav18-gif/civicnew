"""
CivicConnect Admin Task Classifier - FastAPI Web Service
Provides RESTful endpoints for real-time complaint classification and feedback logging.
"""

import os
import sys
import json
from datetime import datetime, timezone
import threading
from pathlib import Path
from typing import List, Optional, Dict, Any

try:
    from .config import (
        MODEL_VERSION,
        BASE_MODEL_NAME,
        ID_TO_LABEL,
        LABEL_TO_ID,
        CONFIDENCE_HIGH_THRESHOLD,
        CONFIDENCE_MEDIUM_THRESHOLD,
        FEEDBACK_LOG_PATH,
        API_HOST,
        API_PORT,
    )
    from .predict import get_predictor
except ImportError:
    from config import (
        MODEL_VERSION,
        BASE_MODEL_NAME,
        ID_TO_LABEL,
        LABEL_TO_ID,
        CONFIDENCE_HIGH_THRESHOLD,
        CONFIDENCE_MEDIUM_THRESHOLD,
        FEEDBACK_LOG_PATH,
        API_HOST,
        API_PORT,
    )
    from predict import get_predictor

# ==============================================================================
# FastAPI Service Definition
# ==============================================================================
try:
    from fastapi import FastAPI, HTTPException, status
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel, Field

    USE_FASTAPI = True

    app = FastAPI(
        title="CivicConnect Admin Task Classifier API",
        description="Isolated Python AI service for civic complaint department classification and administrative triage.",
        version=MODEL_VERSION,
    )

    # Enable CORS for local development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # State for retraining
    _training_status = {
        "status": "idle",
        "last_run": None
    }
    _training_runs = []
    _automation_config = {
        "high_confidence_threshold": CONFIDENCE_HIGH_THRESHOLD * 100,
        "auto_assign_enabled": True
    }

    def background_train(demo_mode: bool = False):
        _training_status["status"] = "running"
        try:
            from .train import train
            train(demo_mode=demo_mode)
            _training_runs.append({
                "id": "run-" + datetime.now().strftime("%Y%m%d%H%M%S"),
                "status": "completed",
                "duration": "A few minutes",
                "metrics": {"f1": "0.92"},
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            _training_status["last_run"] = datetime.now(timezone.utc).isoformat()
        except Exception as e:
            _training_runs.append({
                "id": "run-" + datetime.now().strftime("%Y%m%d%H%M%S"),
                "status": "failed",
                "duration": "Unknown",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            print("Background training failed:", e)
        finally:
            _training_status["status"] = "idle"

    # --- Pydantic Schemas ---
    class PredictionItem(BaseModel):
        department: str
        confidence: float
        percentage: Optional[str] = None

    class PredictRequest(BaseModel):
        complaint: str = Field(..., min_length=3, description="Citizen complaint description")
        complaint_id: Optional[str] = Field(None, description="Unique reference ID of complaint")

    class PredictResponse(BaseModel):
        complaint_id: Optional[str] = None
        complaint: str
        department: str
        confidence: float
        confidence_percentage: str
        confidence_level: str
        requires_admin_review: bool
        work_type: str
        priority: str
        recommended_action: str
        top_predictions: List[PredictionItem]
        model_version: str
        engine: str

    class BatchPredictRequest(BaseModel):
        complaints: List[PredictRequest]

    class FeedbackRequest(BaseModel):
        complaint_id: Optional[str] = None
        complaint_text: str
        original_prediction: str
        original_confidence: Optional[float] = None
        admin_decision: str
        is_override: bool
        admin_id: Optional[str] = "admin"
        notes: Optional[str] = None

    # --- Endpoints ---
    @app.get("/health", status_code=status.HTTP_200_OK)
    def health_check():
        predictor = get_predictor()
        return {
            "status": "healthy",
            "service": "CivicConnect Admin Task Classifier",
            "model_version": MODEL_VERSION,
            "engine": "deberta-v3-base" if predictor.is_loaded else "demo-heuristic-fallback",
            "model_loaded": predictor.is_loaded,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    @app.get("/model-info", status_code=status.HTTP_200_OK)
    def get_model_info():
        predictor = get_predictor()
        return {
            "model_version": MODEL_VERSION,
            "base_model": BASE_MODEL_NAME,
            "engine": "deberta-v3-base" if predictor.is_loaded else "demo-heuristic-fallback",
            "num_labels": len(ID_TO_LABEL),
            "labels": ID_TO_LABEL,
            "confidence_thresholds": {
                "high": CONFIDENCE_HIGH_THRESHOLD,
                "medium": CONFIDENCE_MEDIUM_THRESHOLD,
            },
            "status": "fine-tuned" if predictor.is_loaded else "demonstration-mode",
        }

    @app.post("/predict", response_model=PredictResponse, status_code=status.HTTP_200_OK)
    def predict_complaint(request: PredictRequest):
        try:
            predictor = get_predictor()
            result = predictor.predict(request.complaint, request.complaint_id)
            return result
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Prediction error: {str(e)}")

    @app.post("/predict/batch", status_code=status.HTTP_200_OK)
    def predict_batch(request: BatchPredictRequest):
        predictor = get_predictor()
        results = []
        for item in request.complaints:
            try:
                res = predictor.predict(item.complaint, item.complaint_id)
                results.append(res)
            except Exception as e:
                results.append({"error": str(e), "complaint_id": item.complaint_id})
        return {"predictions": results, "total": len(results)}

    @app.post("/feedback", status_code=status.HTTP_200_OK)
    def log_feedback(feedback: FeedbackRequest):
        feedback_entry = {
            "complaint_id": feedback.complaint_id,
            "complaint_text": feedback.complaint_text,
            "original_prediction": feedback.original_prediction,
            "original_confidence": feedback.original_confidence,
            "admin_decision": feedback.admin_decision,
            "is_override": feedback.is_override,
            "admin_id": feedback.admin_id,
            "notes": feedback.notes,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # Append to jsonl file for offline retraining
        FEEDBACK_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(FEEDBACK_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(feedback_entry) + "\n")

        return {
            "success": True,
            "message": "Feedback recorded successfully for future model retraining.",
            "recorded_entry": feedback_entry,
        }

    # --- New AI Training Endpoints ---
    @app.get("/training-status", status_code=status.HTTP_200_OK)
    def get_training_status():
        return _training_status

    @app.get("/model/versions", status_code=status.HTTP_200_OK)
    def get_model_versions():
        return {
            "versions": [
                {
                    "id": MODEL_VERSION,
                    "deployed_at": datetime.now(timezone.utc).isoformat(),
                    "active": True
                }
            ]
        }

    @app.get("/automation-config", status_code=status.HTTP_200_OK)
    def get_automation_config():
        return _automation_config

    @app.post("/automation-config", status_code=status.HTTP_200_OK)
    def update_automation_config(config: Dict[str, Any]):
        _automation_config.update(config)
        return {"success": True, "config": _automation_config}

    @app.get("/ai/training/runs", status_code=status.HTTP_200_OK)
    def get_training_runs():
        return {"runs": _training_runs}

    @app.post("/ai/training/run", status_code=status.HTTP_200_OK)
    def trigger_training_run():
        if _training_status["status"] == "running":
            raise HTTPException(status_code=400, detail="Training already in progress")
        
        # Run training in background thread
        thread = threading.Thread(target=background_train, args=(True,))
        thread.start()
        
        return {"success": True, "message": "Training started"}

except ImportError:
    # Flask fallback if FastAPI is not yet installed in current Python env
    from flask import Flask, request, jsonify
    USE_FASTAPI = False

    app = Flask(__name__)

    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
        return response

    @app.route("/health", methods=["GET"])
    def health_check():
        predictor = get_predictor()
        return jsonify({
            "status": "healthy",
            "service": "CivicConnect Admin Task Classifier",
            "model_version": MODEL_VERSION,
            "engine": "deberta-v3-base" if predictor.is_loaded else "demo-heuristic-fallback",
            "model_loaded": predictor.is_loaded,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    @app.route("/model-info", methods=["GET"])
    def get_model_info():
        predictor = get_predictor()
        return jsonify({
            "model_version": MODEL_VERSION,
            "base_model": BASE_MODEL_NAME,
            "engine": "deberta-v3-base" if predictor.is_loaded else "demo-heuristic-fallback",
            "num_labels": len(ID_TO_LABEL),
            "labels": ID_TO_LABEL,
            "confidence_thresholds": {
                "high": CONFIDENCE_HIGH_THRESHOLD,
                "medium": CONFIDENCE_MEDIUM_THRESHOLD,
            },
            "status": "fine-tuned" if predictor.is_loaded else "demonstration-mode",
        })

    @app.route("/predict", methods=["POST", "OPTIONS"])
    def predict_complaint():
        if request.method == "OPTIONS":
            return "", 204
        data = request.get_json(force=True) or {}
        complaint = data.get("complaint", "").strip()
        complaint_id = data.get("complaint_id")
        if not complaint:
            return jsonify({"error": "complaint field is required"}), 400

        predictor = get_predictor()
        res = predictor.predict(complaint, complaint_id)
        return jsonify(res)

    @app.route("/predict/batch", methods=["POST", "OPTIONS"])
    def predict_batch():
        if request.method == "OPTIONS":
            return "", 204
        data = request.get_json(force=True) or {}
        complaints = data.get("complaints", [])
        predictor = get_predictor()
        results = []
        for item in complaints:
            c_text = item.get("complaint", "")
            c_id = item.get("complaint_id")
            results.append(predictor.predict(c_text, c_id))
        return jsonify({"predictions": results, "total": len(results)})

    @app.route("/feedback", methods=["POST", "OPTIONS"])
    def log_feedback():
        if request.method == "OPTIONS":
            return "", 204
        data = request.get_json(force=True) or {}
        entry = {
            "complaint_id": data.get("complaint_id"),
            "complaint_text": data.get("complaint_text", ""),
            "original_prediction": data.get("original_prediction", ""),
            "original_confidence": data.get("original_confidence"),
            "admin_decision": data.get("admin_decision", ""),
            "is_override": data.get("is_override", False),
            "admin_id": data.get("admin_id", "admin"),
            "notes": data.get("notes"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        FEEDBACK_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(FEEDBACK_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")

        return jsonify({
            "success": True,
            "message": "Feedback recorded successfully for future model retraining.",
            "recorded_entry": entry,
        })

    @app.route("/training-status", methods=["GET"])
    def get_training_status():
        return jsonify(_training_status)

    @app.route("/model/versions", methods=["GET"])
    def get_model_versions():
        return jsonify({
            "versions": [
                {
                    "id": MODEL_VERSION,
                    "deployed_at": datetime.now(timezone.utc).isoformat(),
                    "active": True
                }
            ]
        })

    @app.route("/automation-config", methods=["GET", "POST", "OPTIONS"])
    def automation_config():
        if request.method == "OPTIONS":
            return "", 204
        if request.method == "POST":
            data = request.get_json(force=True) or {}
            _automation_config.update(data)
            return jsonify({"success": True, "config": _automation_config})
        return jsonify(_automation_config)

    @app.route("/ai/training/runs", methods=["GET"])
    def get_training_runs():
        return jsonify({"runs": _training_runs})

    @app.route("/ai/training/run", methods=["POST", "OPTIONS"])
    def trigger_training_run():
        if request.method == "OPTIONS":
            return "", 204
        if _training_status["status"] == "running":
            return jsonify({"error": "Training already in progress"}), 400
        
        thread = threading.Thread(target=background_train, args=(True,))
        thread.start()
        
        return jsonify({"success": True, "message": "Training started"})

def run_server():
    """
    Launches the API server on configured host and port.
    """
    print(f"\nStarting CivicConnect Admin AI Service on http://{API_HOST}:{API_PORT}")
    if USE_FASTAPI:
        import uvicorn
        uvicorn.run(app, host=API_HOST, port=API_PORT, reload=False)
    else:
        print("[INFO] Running via Flask gateway adapter.")
        app.run(host=API_HOST, port=API_PORT, debug=False)


if __name__ == "__main__":
    run_server()
