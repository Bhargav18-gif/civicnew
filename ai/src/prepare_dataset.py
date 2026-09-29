"""
CivicConnect Admin Classifier - Dataset Versioning & Incremental Preparation
Combines base verified training data with newly collected administrator decision records
to prevent catastrophic forgetting and output versioned datasets.
"""

import os
import csv
import sys
import json
from pathlib import Path
from typing import Dict, Any, List, Tuple

try:
    from .config import (
        DATASET_DIR,
        DATASET_VERSIONS_DIR,
        TRAIN_CSV,
        VALIDATION_CSV,
        TEST_CSV,
        ID_TO_LABEL,
        LABEL_TO_ID,
        NUM_LABELS,
        MIN_CLASS_EXAMPLES,
    )
    from .dataset import load_csv_raw
    from .collect_feedback import process_and_validate_feedback
except ImportError:
    from config import (
        DATASET_DIR,
        DATASET_VERSIONS_DIR,
        TRAIN_CSV,
        VALIDATION_CSV,
        TEST_CSV,
        ID_TO_LABEL,
        LABEL_TO_ID,
        NUM_LABELS,
        MIN_CLASS_EXAMPLES,
    )
    from dataset import load_csv_raw
    from collect_feedback import process_and_validate_feedback


def build_incremental_dataset(version_tag: str = None) -> Tuple[str, Path, Dict[str, Any]]:
    """
    Combines base verified training dataset with newly validated administrative feedback.
    Saves the versioned CSV dataset to dataset/versions/<version_tag>/.
    """
    DATASET_VERSIONS_DIR.mkdir(parents=True, exist_ok=True)

    # Load base dataset records
    base_train = load_csv_raw(TRAIN_CSV)
    base_val = load_csv_raw(VALIDATION_CSV)
    base_test = load_csv_raw(TEST_CSV)

    # Collect newly validated admin decision records
    new_records, feedback_report = process_and_validate_feedback()

    # Deduplicate against base records
    seen_texts = set(r["complaint"].strip().lower() for r in base_train + base_val + base_test)
    added_records = []
    for rec in new_records:
        norm = rec["complaint"].strip().lower()
        if norm not in seen_texts:
            added_records.append({"complaint": rec["complaint"], "department": rec["department"]})
            seen_texts.add(norm)

    # Combine old verified data + new verified data
    full_train = base_train + added_records

    # Generate version tag if not supplied
    if not version_tag:
        existing_versions = list(DATASET_VERSIONS_DIR.glob("dataset_v*"))
        version_num = len(existing_versions) + 1
        version_tag = f"dataset_v1.{version_num}"

    version_dir = DATASET_VERSIONS_DIR / version_tag
    version_dir.mkdir(parents=True, exist_ok=True)

    # Save versioned CSV files
    train_file = version_dir / "train.csv"
    val_file = version_dir / "validation.csv"
    test_file = version_dir / "test.csv"

    for file_path, data in [(train_file, full_train), (val_file, base_val), (test_file, base_test)]:
        with open(file_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["complaint", "department"])
            for row in data:
                writer.writerow([row["complaint"], row["department"]])

    # Class balance statistics
    class_dist = {dept: 0 for dept in ID_TO_LABEL.values()}
    for r in full_train:
        class_dist[r["department"]] = class_dist.get(r["department"], 0) + 1

    # Check for imbalanced classes
    imbalanced_classes = [
        dept for dept, count in class_dist.items() if count < MIN_CLASS_EXAMPLES
    ]

    meta = {
        "dataset_version": version_tag,
        "base_examples": len(base_train),
        "new_examples_added": len(added_records),
        "total_train_examples": len(full_train),
        "validation_examples": len(base_val),
        "test_examples": len(base_test),
        "class_distribution": class_dist,
        "imbalanced_classes": imbalanced_classes,
        "created_at": version_dir.stat().st_ctime,
    }

    with open(version_dir / "dataset_meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    return version_tag, version_dir, meta


if __name__ == "__main__":
    version_tag, version_dir, meta = build_incremental_dataset()
    print("\n" + "=" * 65)
    print(f"   CIVICCONNECT INCREMENTAL DATASET PREPARATION ({version_tag})")
    print("=" * 65)
    print(f"Version Folder        : {version_dir}")
    print(f"Base Training Records : {meta['base_examples']}")
    print(f"New Feedback Added    : {meta['new_examples_added']}")
    print(f"Total Training Pool   : {meta['total_train_examples']}")
    print("\nClass Distribution:")
    for dept, count in meta["class_distribution"].items():
        print(f"  - {dept:<20}: {count} samples")
    if meta["imbalanced_classes"]:
        print(f"\n[WARNING] Imbalanced classes (< {MIN_CLASS_EXAMPLES} samples): {meta['imbalanced_classes']}")
    print("=" * 65 + "\n")
