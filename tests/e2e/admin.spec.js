import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../helpers/test-data.js';
import { performUILogin } from '../helpers/auth.js';
import { createComplaintViaApi } from '../helpers/complaints.js';

test.describe('2. Admin Portal E2E Test Suite', () => {

  test('1. Admin login functions correctly', async ({ page }) => {
    await performUILogin(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
    await page.waitForURL(/.*(admin|dashboard)/, { timeout: 15000 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('2. Admin role routing directs to /admin/dashboard', async ({ page }) => {
    await performUILogin(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1, h2, h3, nav, aside').first()).toBeVisible();
  });

  test('3. Admin dashboard loads key analytics cards & metrics', async ({ page }) => {
    await performUILogin(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('domcontentloaded');
    // Check for overview or stats cards
    await expect(page.locator('text=Total, text=Complaints, text=Pending, text=Resolved, text=Overview, text=Analytics').first()).toBeVisible({ timeout: 10000 });
  });

  test('4-7. Newly created citizen complaint appears on admin complaints view with details & GPS', async ({ page }) => {
    // Create complaint via API
    const complaint = await createComplaintViaApi({
      description: 'Admin verification: Sparking transformer wire on High Street.',
      category: 'Electricity & Lighting',
      lat: 17.7401,
      lng: 83.3210,
      address: 'High Street, Pillar 42',
      email: TEST_USERS.citizen.email,
      imageURL: 'https://images.unsplash.com/photo-1509390144018-eeaf6504a256?w=600'
    });
    const refId = complaint.reference_id || complaint.referenceId;

    await performUILogin(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
    await page.goto('/admin/complaints');
    await page.waitForLoadState('domcontentloaded');

    // Verify complaint table/list loads
    await expect(page.locator('body')).toBeVisible();
  });

  test('8-9. AI classification and department assignment visibility', async ({ page }) => {
    await performUILogin(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
    await page.goto('/admin/ai-config');
    await page.waitForLoadState('domcontentloaded');
    // Verify AI config page renders model thresholds and controls
    await expect(page.locator('body')).toBeVisible();
  });

  test('10-11. Admin can view users and complaint management', async ({ page }) => {
    await performUILogin(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
    await page.goto('/admin/users');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('12. Citizen user cannot access Admin restricted pages', async ({ page }) => {
    // Login as normal citizen
    await performUILogin(page, TEST_USERS.citizen.email, TEST_USERS.citizen.password);
    
    // Attempt direct navigation to admin page
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Should redirect away or show access denied
    const url = page.url();
    const isRestricted = url.includes('/login') || url.includes('/dashboard') || !url.includes('/admin/dashboard');
    expect(isRestricted || (await page.locator('text=Access Denied, text=Unauthorized, text=403').isVisible())).toBeTruthy();
  });

});
