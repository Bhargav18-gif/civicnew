"""
CivicConnect Admin Task Classifier - Inference Engine & CLI
Accepts a civic complaint string and returns:
- Department prediction
- Softmax confidence score
- Confidence level (high, medium, low)
- Top-3 candidate departments
- Recommended administrative action & work type
- Review flag for administrator oversight
"""

import sys
import json
import argparse
from pathlib import Path
from typing import Dict, Any, List

try:
    from .config import (
        MODEL_DIR,
        ID_TO_LABEL,
        LABEL_TO_ID,
        NUM_LABELS,
        MAX_LENGTH,
        CONFIDENCE_HIGH_THRESHOLD,
        CONFIDENCE_MEDIUM_THRESHOLD,
        DEPARTMENT_ACTION_MAP,
        MODEL_VERSION,
    )
except ImportError:
    from config import (
        MODEL_DIR,
        ID_TO_LABEL,
        LABEL_TO_ID,
        NUM_LABELS,
        MAX_LENGTH,
        CONFIDENCE_HIGH_THRESHOLD,
        CONFIDENCE_MEDIUM_THRESHOLD,
        DEPARTMENT_ACTION_MAP,
        MODEL_VERSION,
    )


class AdminClassifierPredictor:
    """
    Singleton-style predictor class that caches model and tokenizer.
    """
    def __init__(self, model_dir: Path = MODEL_DIR):
        self.model_dir = model_dir
        self.tokenizer = None
        self.model = None
        self.device = None
        self.is_loaded = False
        self._load_model()

    def _load_model(self):
        """
        Attempts to load fine-tuned model; flags fallback if not yet trained.
        """
        config_path = self.model_dir / "config.json"
        if not config_path.exists():
            # Model not trained yet - will use demonstration heuristic fallback
            self.is_loaded = False
            return

        try:
            import torch
            from transformers import AutoTokenizer, AutoModelForSequenceClassification

            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            self.tokenizer = AutoTokenizer.from_pretrained(str(self.model_dir))
            self.model = AutoModelForSequenceClassification.from_pretrained(str(self.model_dir))
            self.model.to(self.device)
            self.model.eval()
            self.is_loaded = True
        except Exception as e:
            print(f"[WARNING] Could not load model from {self.model_dir}: {e}")
            self.is_loaded = False

    def _fallback_heuristic_predict(self, text: str) -> List[float]:
        """
        Heuristic keyword scoring used only if model weights are not yet generated.
        Ensures the system and API are immediately runnable and testable.
        """
        text_lower = text.lower()
        scores = [0.05] * NUM_LABELS  # base smoothing

        # Keywords per class
        keywords = {
            0: ["pothole", "road", "asphalt", "crater", "footpath", "curb", "speed breaker", "trench", "tar", "pavement"],
            1: ["water", "pipe", "drinking", "leak", "tap", "pressure", "tanker", "borewell", "reservoir", "muddy"],
            2: ["streetlight", "electric", "power", "transformer", "wire", "voltage", "blackout", "pole", "spark", "cable"],
            3: ["garbage", "waste", "dustbin", "trash", "carcass", "dump", "rubble", "sweeping", "debris", "compost"],
            4: ["drain", "drainage", "sewage", "gutter", "manhole", "sewer", "flood", "overflow", "culvert", "sludge"],
            5: ["traffic", "signal", "zebra", "sign", "junction", "parking", "one-way", "u-turn", "divider", "speed limit"],
            6: ["mosquito", "dengue", "dog", "food", "stray", "fumes", "malaria", "hygiene", "toilet", "rabies", "larvae"],
            7: ["park", "tree", "playground", "swing", "hall", "bench", "library", "crematorium", "statue", "cemetery", "garden"],
        }

        for label_id, kw_list in keywords.items():
            for kw in kw_list:
                if kw in text_lower:
                    scores[label_id] += 1.2

        # Softmax normalization
        import math
        exp_scores = [math.exp(s) for s in scores]
        total_exp = sum(exp_scores)
        return [s / total_exp for s in exp_scores]

    def predict(self, complaint: str, complaint_id: str = None) -> Dict[str, Any]:
        """
        Generates classification, confidence, top 3 predictions, and recommended actions.
        """
        complaint_clean = complaint.strip()
        if not complaint_clean:
            raise ValueError("Complaint description cannot be empty.")

        if self.is_loaded and self.model is not None:
            import torch
            with torch.no_grad():
                inputs = self.tokenizer(
                    complaint_clean,
                    padding=True,
                    truncation=True,
                    max_length=MAX_LENGTH,
                    return_tensors="pt",
                ).to(self.device)

                outputs = self.model(**inputs)
                logits = outputs.logits
                probs = torch.softmax(logits, dim=-1)[0].cpu().numpy().tolist()
        else:
            allow_heuristic = os.getenv("ALLOW_HEURISTIC_FALLBACK", "false").lower() == "true"
            if not allow_heuristic:
                raise RuntimeError("MODEL_ARTIFACT_MISSING: Trained model weights are missing. Heuristic fallback is disabled in production.")
            probs = self._fallback_heuristic_predict(complaint_clean)

        # Ranked predictions
        indexed_probs = [(idx, float(prob)) for idx, prob in enumerate(probs)]
        indexed_probs.sort(key=lambda x: x[1], reverse=True)

        top_id, top_prob = indexed_probs[0]
        top_department = ID_TO_LABEL[top_id]

        # Determine confidence level & review requirement
        if top_prob >= CONFIDENCE_HIGH_THRESHOLD:
            confidence_level = "high"
            requires_admin_review = False
        elif top_prob >= CONFIDENCE_MEDIUM_THRESHOLD:
            confidence_level = "medium"
            requires_admin_review = True
        else:
            confidence_level = "low"
            requires_admin_review = True

        # Top 3 candidate departments
        top_predictions = [
            {
                "department": ID_TO_LABEL[idx],
                "confidence": round(prob, 4),
                "percentage": f"{prob * 100:.1f}%",
            }
            for idx, prob in indexed_probs[:3]
        ]

        # Action guidance
        guidance = DEPARTMENT_ACTION_MAP.get(top_department, {
            "work_type": "Municipal Action",
            "default_priority": "Medium",
            "recommended_action": "Review and assign to responsible department.",
        })

        return {
            "complaint_id": complaint_id,
            "complaint": complaint_clean,
            "department": top_department,
            "confidence": round(top_prob, 4),
            "confidence_percentage": f"{top_prob * 100:.1f}%",
            "confidence_level": confidence_level,
            "requires_admin_review": requires_admin_review,
            "work_type": guidance["work_type"],
            "priority": guidance["default_priority"],
            "recommended_action": guidance["recommended_action"],
            "top_predictions": top_predictions,
            "model_version": MODEL_VERSION,
            "engine": "distilbert-base-uncased" if self.is_loaded else "MODEL_ARTIFACT_MISSING",
        }


# Global predictor instance
_predictor = None


def get_predictor() -> AdminClassifierPredictor:
    global _predictor
    if _predictor is None:
        _predictor = AdminClassifierPredictor()
    return _predictor


def main():
    parser = argparse.ArgumentParser(description="Classify civic complaint using CivicConnect AI")
    parser.add_argument("complaint", type=str, nargs="?", help="Complaint text description")
    args = parser.parse_args()

    if not args.complaint:
        sample_text = "There is a huge pothole near the school and several people have fallen."
        print(f"[INFO] No input provided. Using sample complaint:\n'{sample_text}'\n")
        complaint_text = sample_text
    else:
        complaint_text = args.complaint

    predictor = get_predictor()
    result = predictor.predict(complaint_text)

    print("-" * 60)
    print("CIVICCONNECT ADMIN TASK CLASSIFICATION")
    print("-" * 60)
    print(f"Complaint         : {result['complaint']}")
    print(f"Predicted Dept    : {result['department']}")
    print(f"Confidence        : {result['confidence_percentage']} ({result['confidence_level'].upper()})")
    print(f"Requires Review   : {'YES' if result['requires_admin_review'] else 'NO (High Confidence)'}")
    print(f"Work Type         : {result['work_type']}")
    print(f"Priority          : {result['priority']}")
    print(f"Recommended Action: {result['recommended_action']}")
    print("\nTop 3 Candidate Departments:")
    for p in result["top_predictions"]:
        print(f"  - {p['department']:<20}: {p['percentage']}")
    print("-" * 60)


if __name__ == "__main__":
    main()
