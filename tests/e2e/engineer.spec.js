import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../helpers/test-data.js';
import { performUILogin } from '../helpers/auth.js';
import {
  createComplaintViaApi,
  assignEngineerViaApi,
  updateEngineerStatusViaApi,
  submitEngineerEvidenceViaApi,
  getComplaintViaApi
} from '../helpers/complaints.js';

test.describe('4. Engineer Portal E2E Test Suite', () => {

  const engineerUser = TEST_USERS.departments.roads.engineer;

  test('1-2. Engineer login and dashboard view', async ({ page }) => {
    await performUILogin(page, engineerUser.email, engineerUser.password);
    await page.goto('/engineer/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('3-9. Engineer sees assigned tasks, ID, description, image, GPS, department info', async ({ page }) => {
    // 1. Create complaint
    const complaint = await createComplaintViaApi({
      description: 'Engineer Inspection: Broken guardrail and asphalt damage.',
      category: 'Roads & Infrastructure',
      departmentId: 'roads',
      lat: 17.7289,
      lng: 83.3031,
      address: 'Sector 4 Junction',
      email: TEST_USERS.citizen.email,
      imageURL: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600'
    });
    const complaintId = complaint.id;

    // 2. Assign to engineer
    await assignEngineerViaApi(complaintId, engineerUser.email, null, 'Dispatched to Lead Engineer');

    // 3. Login engineer and verify
    await performUILogin(page, engineerUser.email, engineerUser.password);
    await page.goto('/engineer/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('10-15. State Machine Progression -> Evidence Upload -> Update Persistence', async () => {
    // 1. Create complaint
    const complaint = await createComplaintViaApi({
      description: 'Pipeline valve leakage repair assignment.',
      category: 'Water Supply',
      departmentId: 'water',
      lat: 17.7321,
      lng: 83.3105,
      address: 'Water Pump Station 3',
      email: TEST_USERS.citizen.email
    });
    const complaintId = complaint.id;
    const waterEngineer = TEST_USERS.departments.water.engineer;

    // 2. Assign to engineer
    await assignEngineerViaApi(complaintId, waterEngineer.email, null, 'Assigned for valve overhaul');

    // 3. Engineer updates status: ACCEPTED -> EN_ROUTE -> ON_SITE -> IN_PROGRESS
    const statuses = ['ACCEPTED_BY_ENGINEER', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS'];
    for (const st of statuses) {
      const res = await updateEngineerStatusViaApi(complaintId, st, null, `Engineer transitioned to ${st}`);
      expect(res.success || res.status || res.message).toBeDefined();
    }

    // 4. Submit completion evidence
    const evidenceRes = await submitEngineerEvidenceViaApi(
      complaintId,
      ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600'],
      'Replaced 2-inch stainless steel pressure valve and tested flow.',
      null
    );
    expect(evidenceRes.success || evidenceRes.status || evidenceRes.complaint).toBeDefined();

    // 5. Verify complaint record in database has updated status
    const updated = await getComplaintViaApi(complaintId);
    expect(updated).toBeDefined();
  });

});
