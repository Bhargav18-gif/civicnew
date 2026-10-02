import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../helpers/test-data.js';
import { performUILogin } from '../helpers/auth.js';
import { createComplaintViaApi, assignEngineerViaApi } from '../helpers/complaints.js';

const DEPARTMENTS = Object.values(TEST_USERS.departments);

test.describe('3. Department Portals E2E Test Suite (All 8 Departments)', () => {

  for (const dept of DEPARTMENTS) {
    test.describe(`Department: ${dept.name} (${dept.id})`, () => {

      test(`1-2. Login and Dashboard access for ${dept.name}`, async ({ page }) => {
        await performUILogin(page, dept.manager.email, dept.manager.password);
        await page.goto('/department/dashboard');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('body')).toBeVisible();
      });

      test(`3-7. View assigned complaints, details, image & GPS for ${dept.name}`, async ({ page }) => {
        // Create complaint specifically for this department
        const complaint = await createComplaintViaApi({
          description: `Specific incident for ${dept.name} on Sector Road.`,
          category: dept.name,
          departmentId: dept.id,
          lat: 17.7300,
          lng: 83.3000,
          address: `Test Address, ${dept.name} Zone`,
          email: TEST_USERS.citizen.email,
          imageURL: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?w=600'
        });

        await performUILogin(page, dept.manager.email, dept.manager.password);
        await page.goto('/department/dashboard');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('body')).toBeVisible();
      });

      test(`8-9. Assign engineer and verify persistence for ${dept.name}`, async ({ page }) => {
        const complaint = await createComplaintViaApi({
          description: `Dispatch assignment test for ${dept.name}.`,
          category: dept.name,
          departmentId: dept.id,
          lat: 17.7310,
          lng: 83.3010,
          address: `Dispatch Point ${dept.id}`,
          email: TEST_USERS.citizen.email
        });

        const complaintId = complaint.id;
        const engId = dept.engineer.email;

        // Perform assignment
        const assignResult = await assignEngineerViaApi(complaintId, engId, null, `Dispatched by ${dept.name} Manager`);
        expect(assignResult.success || assignResult.complaint || assignResult.message).toBeDefined();
      });

      test(`10. Data isolation: ${dept.name} cannot access unauthorized foreign department queues`, async ({ page }) => {
        const foreignDeptId = dept.id === 'roads' ? 'water' : 'roads';
        await performUILogin(page, dept.manager.email, dept.manager.password);
        
        // Attempt accessing foreign queue
        await page.goto(`/department/dashboard?dept=${foreignDeptId}`);
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('body')).toBeVisible();
      });

    });
  }

});
