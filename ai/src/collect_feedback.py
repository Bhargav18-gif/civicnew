"""
CivicConnect Admin Task Classifier - Feedback & Data Collection Module
Collects finalized admin decisions, validates records, performs PII privacy sanitization,
and builds ground-truth training records from human-in-the-loop decisions.
"""

import os
import re
import sys
import json
from pathlib import Path
from typing import Dict, Any, List, Tuple

try:
    from .config import (
        FEEDBACK_LOG_PATH,
        LABEL_TO_ID,
        ID_TO_LABEL,
    )
except ImportError:
    from config import (
        FEEDBACK_LOG_PATH,
        LABEL_TO_ID,
        ID_TO_LABEL,
    )


def sanitize_pii(text: str) -> str:
    """
    Removes personally identifiable information (PII) like emails, phone numbers,
    and street/house numbers before complaint text enters training datasets.
    """
    if not text:
        return ""
    
    sanitized = text

    # Remove email addresses
    sanitized = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '[EMAIL_REDACTED]', sanitized)

    # Remove phone numbers (10+ digits or international format)
    sanitized = re.sub(r'\+?\d{1,3}?[-.\s]?\(?\d{2,4}?\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}', '[PHONE_REDACTED]', sanitized)

    # Remove house numbers/door numbers (e.g. #40-A, Flat 302, Door 12/B)
    sanitized = re.sub(r'(?i)\b(flat|house|door|building|apartment|plot)\s*#?\s*\d+[a-z]?', '[ADDRESS_REDACTED]', sanitized)

    # Strip excess whitespace
    sanitized = re.sub(r'\s+', ' ', sanitized).strip()
    return sanitized


def load_raw_feedback_entries() -> List[Dict[str, Any]]:
    """
    Loads raw admin decision feedback entries from admin_feedback.jsonl.
    """
    if not FEEDBACK_LOG_PATH.exists():
        return []

    entries = []
    with open(FEEDBACK_LOG_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line_str = line.strip()
            if not line_str or line_str.startswith("#"):
                continue
            try:
                entry = json.loads(line_str)
                entries.append(entry)
            except Exception as e:
                print(f"[WARNING] Skipping malformed feedback line: {e}")
    return entries


def process_and_validate_feedback() -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Validates admin feedback entries, enforces ground-truth labels from admin decisions,
    applies PII sanitization, and returns eligible training records alongside a quality report.
    """
    raw_entries = load_raw_feedback_entries()

    total_collected = len(raw_entries)
    eligible_records = []
    rejection_reasons = {
        "missing_admin_decision": 0,
        "invalid_department": 0,
        "too_short_or_empty": 0,
        "duplicate_complaint_id": 0,
        "duplicate_text": 0
    }

    seen_ids = set()
    seen_texts = set()

    for idx, entry in enumerate(raw_entries):
        complaint_id = entry.get("complaint_id")
        raw_text = entry.get("complaint_text") or entry.get("complaint") or ""
        admin_decision = entry.get("admin_decision")

        # 1. Check admin decision existence
        if not admin_decision:
            rejection_reasons["missing_admin_decision"] += 1
            continue

        # 2. Check valid department label
        if admin_decision not in LABEL_TO_ID:
            rejection_reasons["invalid_department"] += 1
            continue

        # 3. Check complaint text length and quality
        clean_text = raw_text.strip()
        if len(clean_text) < 5 or len(clean_text.split()) < 2:
            rejection_reasons["too_short_or_empty"] += 1
            continue

        # 4. Check duplicate complaintId
        if complaint_id and complaint_id in seen_ids:
            rejection_reasons["duplicate_complaint_id"] += 1
            continue

        # 5. Apply PII Sanitization
        sanitized_text = sanitize_pii(clean_text)

        # 6. Check duplicate sanitized text
        norm_text = sanitized_text.lower()
        if norm_text in seen_texts:
            rejection_reasons["duplicate_text"] += 1
            continue

        if complaint_id:
            seen_ids.add(complaint_id)
        seen_texts.add(norm_text)

        record = {
            "complaint": sanitized_text,
            "department": admin_decision,
            "source": "real_civicconnect",
            "complaintId": complaint_id,
            "labelSource": "admin",
            "is_override": entry.get("is_override", False),
            "original_prediction": entry.get("original_prediction"),
            "createdAt": entry.get("timestamp", ""),
            "usedForTraining": False,
        }
        eligible_records.append(record)

    report = {
        "total_collected": total_collected,
        "eligible_count": len(eligible_records),
        "rejected_count": total_collected - len(eligible_records),
        "rejection_reasons": rejection_reasons,
    }

    return eligible_records, report


if __name__ == "__main__":
    records, report = process_and_validate_feedback()
    print("\n" + "=" * 65)
    print("      CIVICCONNECT FEEDBACK COLLECTION & DATA QUALITY REPORT")
    print("=" * 65)
    print(f"Total Logged Admin Feedback Entries: {report['total_collected']}")
    print(f"Eligible Verified Training Records : {report['eligible_count']}")
    print(f"Rejected Records                   : {report['rejected_count']}")
    print("\nRejection Breakdown:")
    for reason, count in report["rejection_reasons"].items():
        print(f"  - {reason:<25}: {count}")
    print("=" * 65 + "\n")
