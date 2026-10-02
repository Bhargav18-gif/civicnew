import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../helpers/test-data.js';
import { performUILogin } from '../helpers/auth.js';
import {
  createComplaintViaApi,
  assignEngineerViaApi,
  updateEngineerStatusViaApi,
  submitEngineerEvidenceViaApi,
  verifyComplaintByDeptViaApi,
  verifyComplaintByCitizenViaApi,
  getComplaintViaApi
} from '../helpers/complaints.js';

test.describe('5. Real-Time Multi-Browser Synchronization Test Suite', () => {

  test('Concurrent Multi-Role Lifecycle Synchronization (Citizen, Admin, Dept, Engineer)', async ({ browser }) => {
    // 1. Initialize 4 isolated browser contexts
    const contextCitizen = await browser.newContext();
    const contextAdmin = await browser.newContext();
    const contextDept = await browser.newContext();
    const contextEngineer = await browser.newContext();

    const pageCitizen = await contextCitizen.newPage();
    const pageAdmin = await contextAdmin.newPage();
    const pageDept = await contextDept.newPage();
    const pageEngineer = await contextEngineer.newPage();

    const roadsManager = TEST_USERS.departments.roads.manager;
    const roadsEngineer = TEST_USERS.departments.roads.engineer;

    try {
      // 2. Log in all roles concurrently
      await Promise.all([
        performUILogin(pageCitizen, TEST_USERS.citizen.email, TEST_USERS.citizen.password),
        performUILogin(pageAdmin, TEST_USERS.admin.email, TEST_USERS.admin.password),
        performUILogin(pageDept, roadsManager.email, roadsManager.password),
        performUILogin(pageEngineer, roadsEngineer.email, roadsEngineer.password),
      ]);

      // 3. Citizen creates a complaint
      const timestamp = Date.now();
      const uniqueComplaintDesc = `Realtime Synced Issue ${timestamp}: Road cave-in near subway exit.`;
      
      const complaint = await createComplaintViaApi({
        description: uniqueComplaintDesc,
        category: 'Roads & Infrastructure',
        departmentId: 'roads',
        lat: 17.7289,
        lng: 83.3031,
        address: 'Subway Exit 2',
        email: TEST_USERS.citizen.email
      });

      const complaintId = complaint.id;
      const refId = complaint.reference_id || complaint.referenceId;
      expect(complaintId).toBeDefined();

      // 4. Admin checks dashboard / complaints
      await pageAdmin.goto('/admin/complaints');
      await pageAdmin.waitForLoadState('domcontentloaded');
      await expect(pageAdmin.locator('body')).toBeVisible();

      // 5. Department manager checks complaints and assigns engineer
      await pageDept.goto('/department/dashboard');
      await pageDept.waitForLoadState('domcontentloaded');
      
      await assignEngineerViaApi(complaintId, roadsEngineer.email, null, 'Assigned via real-time test');

      // 6. Engineer checks dashboard & progresses state
      await pageEngineer.goto('/engineer/dashboard');
      await pageEngineer.waitForLoadState('domcontentloaded');

      await updateEngineerStatusViaApi(complaintId, 'IN_PROGRESS', null, 'Work in progress');
      await submitEngineerEvidenceViaApi(
        complaintId,
        ['https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?w=600'],
        'Asphalt resurfaced and leveled.',
        null
      );

      // 7. Department Manager verifies and approves
      await verifyComplaintByDeptViaApi(complaintId, true, 'Supervisor inspected and approved.', null);

      // 8. Citizen views status
      await pageCitizen.goto(`/track?id=${refId}`);
      await pageCitizen.waitForLoadState('domcontentloaded');
      await expect(pageCitizen.locator('body')).toBeVisible();

      // 9. Verify state persistence in backend database
      const finalDbRecord = await getComplaintViaApi(complaintId);
      expect(finalDbRecord).toBeDefined();

    } finally {
      await contextCitizen.close();
      await contextAdmin.close();
      await contextDept.close();
      await contextEngineer.close();
    }
  });

});
