"""
CivicConnect Admin Task Classifier - Model Evaluation Pipeline
Evaluates the trained model on test.csv and outputs detailed performance metrics.
"""

import sys
import json
from pathlib import Path
from typing import Dict, Any

try:
    from .config import (
        MODEL_DIR,
        TEST_CSV,
        ID_TO_LABEL,
        LABEL_TO_ID,
        NUM_LABELS,
        MAX_LENGTH,
    )
    from .dataset import load_csv_raw
except ImportError:
    from config import (
        MODEL_DIR,
        TEST_CSV,
        ID_TO_LABEL,
        LABEL_TO_ID,
        NUM_LABELS,
        MAX_LENGTH,
    )
    from dataset import load_csv_raw


def evaluate_model():
    print("\n" + "=" * 70)
    print("      CIVICCONNECT ADMIN TASK CLASSIFIER - MODEL EVALUATION")
    print("=" * 70)

    # 1. Verify Model Artifacts Exist
    if not (MODEL_DIR / "config.json").exists():
        print(f"\n[ERROR] Trained model not found at: {MODEL_DIR}")
        print("Please train the model first by running:")
        print("    python src/train.py\n")
        return None

    # 2. Check Dependencies
    try:
        import torch
        import numpy as np
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        from sklearn.metrics import (
            accuracy_score,
            precision_recall_fscore_support,
            classification_report,
            confusion_matrix,
        )
    except ImportError as e:
        print(f"\n[ERROR] Missing required ML libraries: {e}")
        print("Please install requirements: pip install -r requirements.txt\n")
        return None

    # 3. Load Test Data
    test_raw = load_csv_raw(TEST_CSV)
    test_texts = [r["complaint"] for r in test_raw]
    true_labels = [LABEL_TO_ID[r["department"]] for r in test_raw]
    target_names = [ID_TO_LABEL[i] for i in range(NUM_LABELS)]

    print(f"Loaded Test Dataset: {len(test_texts)} records from {TEST_CSV.name}")

    # 4. Load Model and Tokenizer
    print(f"Loading Model from: {MODEL_DIR}...")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Evaluation Device: {device}")

    tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))
    model = AutoModelForSequenceClassification.from_pretrained(str(MODEL_DIR))
    model.to(device)
    model.eval()

    # 5. Compute Batch Predictions
    predicted_labels = []
    probabilities = []

    print("Running inference across test records...")
    batch_size = 16
    with torch.no_grad():
        for i in range(0, len(test_texts), batch_size):
            batch_texts = test_texts[i : i + batch_size]
            inputs = tokenizer(
                batch_texts,
                padding=True,
                truncation=True,
                max_length=MAX_LENGTH,
                return_tensors="pt",
            ).to(device)

            outputs = model(**inputs)
            logits = outputs.logits
            probs = torch.softmax(logits, dim=-1).cpu().numpy()
            preds = np.argmax(probs, axis=-1)

            predicted_labels.extend(preds)
            probabilities.extend(probs)

    # 6. Compute Metrics
    acc = accuracy_score(true_labels, predicted_labels)
    macro_p, macro_r, macro_f1, _ = precision_recall_fscore_support(
        true_labels, predicted_labels, average="macro", zero_division=0
    )

    print("\n" + "-" * 70)
    print("                    OVERALL EVALUATION METRICS")
    print("-" * 70)
    print(f"Accuracy        : {acc * 100:.2f}%")
    print(f"Macro Precision : {macro_p * 100:.2f}%")
    print(f"Macro Recall    : {macro_r * 100:.2f}%")
    print(f"Macro F1 Score  : {macro_f1 * 100:.2f}%")

    print("\n" + "-" * 70)
    print("                 PER-CLASS PERFORMANCE BREAKDOWN")
    print("-" * 70)
    report = classification_report(
        true_labels,
        predicted_labels,
        target_names=target_names,
        digits=4,
        zero_division=0,
    )
    print(report)

    print("-" * 70)
    print("                        CONFUSION MATRIX")
    print("-" * 70)
    cm = confusion_matrix(true_labels, predicted_labels)
    print(f"{'':<18}" + "".join([f"{ID_TO_LABEL[i][:6]:>8}" for i in range(NUM_LABELS)]))
    for i, row in enumerate(cm):
        row_str = "".join([f"{val:>8}" for val in row])
        print(f"{ID_TO_LABEL[i]:<18}{row_str}")

    print("\n" + "!" * 70)
    print("[CRITICAL DISCLAIMER]:")
    print("The above scores reflect performance on the DEMONSTRATION test set.")
    print("DO NOT cite these demonstration metrics as real-world accuracy.")
    print("Real-world accuracy must be measured on live, verified municipal data.")
    print("!" * 70)
    print("=" * 70 + "\n")

    return {
        "accuracy": acc,
        "macro_precision": macro_p,
        "macro_recall": macro_r,
        "macro_f1": macro_f1,
    }


if __name__ == "__main__":
    evaluate_model()
