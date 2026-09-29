"""
CivicConnect Admin Task Classifier - Model Training Pipeline
Fine-tunes microsoft/deberta-v3-base for multi-class civic department classification.
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, Any

try:
    from .config import (
        BASE_MODEL_NAME,
        MODEL_DIR,
        CHECKPOINT_DIR,
        ID_TO_LABEL,
        LABEL_TO_ID,
        NUM_LABELS,
        MAX_LENGTH,
        TRAIN_BATCH_SIZE,
        EVAL_BATCH_SIZE,
        LEARNING_RATE,
        NUM_EPOCHS,
        WEIGHT_DECAY,
        WARMUP_RATIO,
        MODEL_VERSION,
    )
    from .dataset import load_datasets_for_training
except ImportError:
    from config import (
        BASE_MODEL_NAME,
        MODEL_DIR,
        CHECKPOINT_DIR,
        ID_TO_LABEL,
        LABEL_TO_ID,
        NUM_LABELS,
        MAX_LENGTH,
        TRAIN_BATCH_SIZE,
        EVAL_BATCH_SIZE,
        LEARNING_RATE,
        NUM_EPOCHS,
        WEIGHT_DECAY,
        WARMUP_RATIO,
        MODEL_VERSION,
    )
    from dataset import load_datasets_for_training


def compute_metrics_fn(eval_pred):
    """
    Computes accuracy, macro precision, macro recall, and macro F1.
    """
    import numpy as np
    from sklearn.metrics import accuracy_score, precision_recall_fscore_support
    
    predictions, labels = eval_pred
    preds = np.argmax(predictions, axis=1)
    
    precision, recall, f1, _ = precision_recall_fscore_support(
        labels, preds, average="macro", zero_division=0
    )
    acc = accuracy_score(labels, preds)
    
    return {
        "accuracy": float(acc),
        "macro_precision": float(precision),
        "macro_recall": float(recall),
        "macro_f1": float(f1),
    }


def train(demo_mode: bool = False):
    """
    Executes model training using Hugging Face Transformers.
    """
    print("\n" + "=" * 70)
    print(f"   CIVICCONNECT ADMIN CLASSIFIER - TRAINING PIPELINE ({MODEL_VERSION})")
    print("=" * 70)

    # 1. Check dependencies
    try:
        import torch
        from transformers import (
            AutoTokenizer,
            AutoModelForSequenceClassification,
            TrainingArguments,
            Trainer,
            DataCollatorWithPadding,
        )
        from datasets import Dataset
    except ImportError as e:
        print(f"\n[ERROR] Missing required ML libraries: {e}")
        print("Please install requirements inside your virtual environment:")
        print("    pip install -r requirements.txt\n")
        sys.exit(1)

    # 2. Detect Device
    if torch.cuda.is_available():
        device_name = torch.cuda.get_device_name(0)
        device = f"GPU: {device_name} (CUDA available)"
    else:
        device = "CPU (No CUDA GPU detected; fine-tuning on CPU)"
    print(f"Device in use: {device}")

    # 3. Load & Validate Datasets
    train_records, val_records, test_records = load_datasets_for_training()
    
    # Convert to list of dicts if needed
    if hasattr(train_records, "to_dict"):
        train_data = train_records.to_dict(orient="records")
        val_data = val_records.to_dict(orient="records")
        test_data = test_records.to_dict(orient="records")
    else:
        train_data = train_records
        val_data = val_records
        test_data = test_records

    print(f"Number of Training Examples  : {len(train_data)}")
    print(f"Number of Validation Examples: {len(val_data)}")
    print(f"Number of Test Examples      : {len(test_data)}")
    print(f"Number of Department Classes : {NUM_LABELS}")

    # Convert to Hugging Face Dataset format
    train_dataset = Dataset.from_list(train_data)
    val_dataset = Dataset.from_list(val_data)
    test_dataset = Dataset.from_list(test_data)

    # 4. Load Base Tokenizer
    model_name = BASE_MODEL_NAME
    if demo_mode:
        print("\n[INFO] Demo Mode requested: using lightweight initialization.")
    print(f"Loading Base Tokenizer: {model_name}...")
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name)
    except Exception as tok_err:
        print(f"[WARNING] Could not load '{model_name}': {tok_err}")
        print("Falling back to 'distilbert-base-uncased' for tokenizer.")
        model_name = "distilbert-base-uncased"
        tokenizer = AutoTokenizer.from_pretrained(model_name)

    # Tokenization function
    def tokenize_batch(batch):
        return tokenizer(
            batch["complaint"],
            padding=False,  # dynamically padded by DataCollator
            truncation=True,
            max_length=MAX_LENGTH,
        )

    print("Tokenizing complaint text...")
    tokenized_train = train_dataset.map(tokenize_batch, batched=True)
    tokenized_val = val_dataset.map(tokenize_batch, batched=True)
    tokenized_test = test_dataset.map(tokenize_batch, batched=True)

    # 5. Load Base Model for Sequence Classification
    print(f"Loading Model Architecture ({model_name}) with {NUM_LABELS} classes...")
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name,
        num_labels=NUM_LABELS,
        id2label={str(k): v for k, v in ID_TO_LABEL.items()},
        label2id={k: int(v) for k, v in LABEL_TO_ID.items()},
    )

    # 6. Training Arguments
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    os.makedirs(MODEL_DIR, exist_ok=True)

    training_args = TrainingArguments(
        output_dir=str(CHECKPOINT_DIR),
        evaluation_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=2,
        learning_rate=LEARNING_RATE,
        per_device_train_batch_size=TRAIN_BATCH_SIZE,
        per_device_eval_batch_size=EVAL_BATCH_SIZE,
        num_train_epochs=NUM_EPOCHS if not demo_mode else 1,
        weight_decay=WEIGHT_DECAY,
        warmup_ratio=WARMUP_RATIO,
        load_best_model_at_end=True,
        metric_for_best_model="macro_f1",
        greater_is_better=True,
        logging_steps=10,
        report_to="none",  # disable wandb etc.
        use_cpu=not torch.cuda.is_available(),
    )

    # 7. Initialize Trainer
    data_collator = DataCollatorWithPadding(tokenizer=tokenizer)
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_train,
        eval_dataset=tokenized_val,
        tokenizer=tokenizer,
        data_collator=data_collator,
        compute_metrics=compute_metrics_fn,
    )

    # 8. Run Fine-Tuning
    print("\nStarting Sequence Classification Fine-Tuning...")
    train_result = trainer.train()
    print("Fine-tuning completed!")
    print(f"Training Loss: {train_result.training_loss:.4f}")

    # 9. Evaluate on Validation Split
    print("\nEvaluating best model on Validation split...")
    val_metrics = trainer.evaluate(eval_dataset=tokenized_val)
    print("\n--- Validation Metrics ---")
    for key, value in val_metrics.items():
        if key.startswith("eval_"):
            print(f"  {key:<20}: {value:.4f}")

    # 10. Save Final Model & Metadata
    print(f"\nSaving final model and artifacts to: {MODEL_DIR}")
    trainer.save_model(str(MODEL_DIR))
    tokenizer.save_pretrained(str(MODEL_DIR))

    # Save additional metadata
    meta = {
        "model_version": MODEL_VERSION,
        "base_model": model_name,
        "num_labels": NUM_LABELS,
        "id2label": ID_TO_LABEL,
        "label2id": LABEL_TO_ID,
        "validation_metrics": val_metrics,
        "device": device,
    }
    with open(MODEL_DIR / "model_meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print("Model, tokenizer, and metadata successfully saved!")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train CivicConnect Admin Classifier")
    parser.add_argument("--demo", action="store_true", help="Run quick 1-epoch demo training")
    args = parser.parse_args()
    train(demo_mode=args.demo)
