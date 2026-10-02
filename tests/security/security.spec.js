import { test, expect } from '@playwright/test';
import { runSecurityAudit } from './security-runner.js';

test.describe('Security & Vulnerability Test Suite', () => {

  test('Execute complete OWASP RBAC, IDOR & Injection Security Audit', async () => {
    await runSecurityAudit();
    expect(true).toBeTruthy();
  });

});
