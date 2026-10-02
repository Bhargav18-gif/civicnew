/**
 * CivicConnect Autonomous AI Triage Evaluation & ML Metrics Engine
 * Evaluates the real classification engine against the labeled test dataset (ai/dataset/test.csv).
 * Computes Genuine Accuracy, Precision, Recall, Macro-F1, and Confusion Matrix.
 * Tests confidence threshold boundaries and deterministic department routing.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { classifyComplaintText, CANONICAL_DEPARTMENTS } = require('../../functions/ai.js');
const { resolveCanonicalDepartment } = require('../../functions/departmentRoutingService.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRAIN_DEPT_TO_ID = {
  'roads':              'roads',
  'water':              'water',
  'electricity':        'electricity',
  'sanitation':         'garbage',
  'drainage':           'drainage',
  'traffic':            'transport',
  'public health':      'health',
  'municipal services': 'public_safety'
};

export async function evaluateAIClassifier() {
  console.log('================================================================');
  console.log(' CIVICCONNECT — AI/ML MODEL ACCURACY & ROUTING EVALUATION');
  console.log('================================================================\n');

  const testCsvPath = path.resolve(__dirname, '..', '..', 'ai', 'dataset', 'test.csv');
  let testSamples = [];

  if (fs.existsSync(testCsvPath)) {
    const raw = fs.readFileSync(testCsvPath, 'utf8');
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('complaint,')) continue;

      const lastComma = trimmed.lastIndexOf(',');
      if (lastComma === -1) continue;

      const text = trimmed.slice(0, lastComma).replace(/^"|"$/g, '').trim();
      const deptRaw = trimmed.slice(lastComma + 1).replace(/^"|"$/g, '').trim().toLowerCase();
      const expectedDept = TRAIN_DEPT_TO_ID[deptRaw] || deptRaw;

      if (text && expectedDept) {
        testSamples.push({ text, expectedDept });
      }
    }
  }

  console.log(`Loaded ${testSamples.length} labeled test samples from ai/dataset/test.csv.`);

  const classes = Object.keys(CANONICAL_DEPARTMENTS);
  const confusionMatrix = {};
  for (const r of classes) {
    confusionMatrix[r] = {};
    for (const c of classes) {
      confusionMatrix[r][c] = 0;
    }
  }

  let totalCorrect = 0;
  let totalEvaluated = 0;

  for (const sample of testSamples) {
    try {
      const result = await classifyComplaintText(sample.text);
      const predictedDept = result.departmentId || result.departmentCode?.toLowerCase();

      if (confusionMatrix[sample.expectedDept] && confusionMatrix[sample.expectedDept][predictedDept] !== undefined) {
        confusionMatrix[sample.expectedDept][predictedDept]++;
        if (sample.expectedDept === predictedDept) {
          totalCorrect++;
        }
        totalEvaluated++;
      }
    } catch (e) {
      console.warn('Evaluation sample skipped:', e.message);
    }
  }

  const accuracy = totalEvaluated > 0 ? (totalCorrect / totalEvaluated) : 0;

  // Calculate Precision, Recall, F1 per class
  const classMetrics = {};
  let macroF1Sum = 0;
  let validClasses = 0;

  for (const c of classes) {
    let tp = confusionMatrix[c][c] || 0;
    let fp = 0;
    let fn = 0;

    for (const r of classes) {
      if (r !== c) fp += confusionMatrix[r][c] || 0;
      if (r !== c) fn += confusionMatrix[c][r] || 0;
    }

    const precision = (tp + fp) > 0 ? (tp / (tp + fp)) : 0;
    const recall = (tp + fn) > 0 ? (tp / (tp + fn)) : 0;
    const f1 = (precision + recall) > 0 ? (2 * precision * recall / (precision + recall)) : 0;

    classMetrics[c] = {
      name: CANONICAL_DEPARTMENTS[c].name,
      precision: Number(precision.toFixed(3)),
      recall: Number(recall.toFixed(3)),
      f1: Number(f1.toFixed(3)),
      support: tp + fn
    };

    if (tp + fn > 0) {
      macroF1Sum += f1;
      validClasses++;
    }
  }

  const macroF1 = validClasses > 0 ? (macroF1Sum / validClasses) : 0;

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIDENCE BOUNDARY TESTS
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nTesting AI Confidence Boundary Conditions...');
  const highConfSample = await classifyComplaintText('Massive pothole and broken road asphalt on highway');
  const lowConfSample = await classifyComplaintText('Something looks a bit strange near the tree');

  const boundaryChecks = {
    highConfidenceDetermined: highConfSample.confidence >= 0.70,
    lowConfidenceFlagsReview: lowConfSample.requiresHumanReview === true,
    deterministicRouting: resolveCanonicalDepartment('ROADS').id === 'roads'
  };

  const finalMetrics = {
    totalTestSamples: totalEvaluated,
    accuracy: Number(accuracy.toFixed(3)),
    macroF1: Number(macroF1.toFixed(3)),
    classMetrics,
    confusionMatrix,
    boundaryChecks,
    timestamp: new Date().toISOString()
  };

  console.log(`\n📊 AI Evaluation Results:`);
  console.log(`  Accuracy: ${(accuracy * 100).toFixed(1)}% | Macro-F1: ${(macroF1 * 100).toFixed(1)}%`);
  console.log(`  Boundary Checks: HighConf=${boundaryChecks.highConfidenceDetermined}, LowConfReview=${boundaryChecks.lowConfidenceFlagsReview}, Deterministic=${boundaryChecks.deterministicRouting}\n`);

  // Save to reports
  const reportsDir = path.resolve(__dirname, '..', '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, 'ai-metrics.json'), JSON.stringify(finalMetrics, null, 2), 'utf8');

  return finalMetrics;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  evaluateAIClassifier();
}
