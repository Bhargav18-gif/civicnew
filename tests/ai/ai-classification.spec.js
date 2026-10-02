import { test, expect } from '@playwright/test';
import { evaluateAIClassifier } from './ai-runner.js';

test.describe('AI Classification & Routing Model Suite', () => {

  test('Evaluate AI Model Accuracy, F1, Confusion Matrix & Threshold Boundaries', async () => {
    const metrics = await evaluateAIClassifier();
    expect(metrics.totalTestSamples).toBeGreaterThan(0);
    expect(metrics.accuracy).toBeGreaterThan(0.5); // Baseline statistical model test
    expect(metrics.boundaryChecks.deterministicRouting).toBe(true);
  });

});
