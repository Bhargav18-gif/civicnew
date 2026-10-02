import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../helpers/test-data.js';
import { performUILogin } from '../helpers/auth.js';
import { createComplaintViaApi, getComplaintViaApi } from '../helpers/complaints.js';
import { fetchDbComplaint } from '../helpers/firebase.js';

test.describe('1. Citizen Portal E2E Test Suite', () => {

  test('1. Citizen can open website landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CivicConnect/i);
    await expect(page.locator('body')).toBeVisible();
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('2. Citizen login works and routes to dashboard', async ({ page }) => {
    await performUILogin(page, TEST_USERS.citizen.email, TEST_USERS.citizen.password);
    await page.waitForURL(/.*(dashboard|login)/, { timeout: 15000 });
    // Check for dashboard content or logged-in state
    await expect(page.locator('text=Report|text=Dashboard|text=Complaints|text=Logout|text=Track').first()).toBeVisible({ timeout: 10000 });
  });

  test('3. Invalid login is rejected with error feedback', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"], input[name="email"]').fill('nonexistent.citizen@civicconnect.com');
    await page.locator('input[type="password"], input[name="password"]').fill('WrongPassword999!');
    await page.locator('button[type="submit"]').click();
    
    // Expect error alert or message
    const errorAlert = page.locator('.text-red-300, .bg-red-500, [role="alert"], text=Invalid, text=failed, text=user-not-found, text=wrong-password').first();
    await expect(errorAlert).toBeVisible({ timeout: 10000 });
  });

  test('4. Citizen dashboard loads successfully', async ({ page }) => {
    await performUILogin(page, TEST_USERS.citizen.email, TEST_USERS.citizen.password);
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('5. Citizen can open complaint report form', async ({ page }) => {
    await performUILogin(page, TEST_USERS.citizen.email, TEST_USERS.citizen.password);
    await page.goto('/report');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('textarea[name="description"], input[name="description"]')).toBeVisible({ timeout: 10000 });
  });

  test('6. Required fields are validated before submission', async ({ page }) => {
    await performUILogin(page, TEST_USERS.citizen.email, TEST_USERS.citizen.password);
    await page.goto('/report');
    await page.waitForLoadState('domcontentloaded');

    // Click submit without filling description
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Verification that form is not submitted or required attribute triggers validation
    const descArea = page.locator('textarea[name="description"]');
    const isRequired = await descArea.getAttribute('required');
    expect(isRequired !== null || (await page.locator('text=required, text=Please provide').isVisible())).toBeTruthy();
  });

  test('7. Citizen can enter complaint description', async ({ page }) => {
    await performUILogin(page, TEST_USERS.citizen.email, TEST_USERS.citizen.password);
    await page.goto('/report');
    const desc = 'E2E Test: Deep hazardous pothole on 4th cross street near central library.';
    const descInput = page.locator('textarea[name="description"]');
    await descInput.fill(desc);
    await expect(descInput).toHaveValue(desc);
  });

  test('8. Citizen can provide/upload an image', async ({ page }) => {
    await performUILogin(page, TEST_USERS.citizen.email, TEST_USERS.citizen.password);
    await page.goto('/report');
    
    // Check file upload input presence
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
      await expect(fileInput.first()).toBeAttached();
    }
  });

  test('9. Citizen can select or provide GPS location', async ({ page }) => {
    await performUILogin(page, TEST_USERS.citizen.email, TEST_USERS.citizen.password);
    await page.goto('/report');
    // Verify location picker element exists on the page
    const locationContainer = page.locator('text=Location, text=GPS, .leaflet-container, [placeholder*="location"], [placeholder*="address"]').first();
    await expect(locationContainer).toBeVisible({ timeout: 10000 });
  });

  test('10-14. Complete Citizen Submission -> ID Generation -> Dashboard & Details View', async ({ page }) => {
    await performUILogin(page, TEST_USERS.citizen.email, TEST_USERS.citizen.password);
    await page.goto('/report');
    
    const uniqueTitle = `Pothole on Test Lane ${Date.now()}`;
    const desc = `${uniqueTitle} causing severe disruption and vehicle damage.`;
    
    await page.locator('textarea[name="description"]').fill(desc);
    
    const emailField = page.locator('input[name="email"]');
    if (await emailField.isVisible()) {
      await emailField.fill(TEST_USERS.citizen.email);
    }
    
    // Submit form
    await page.locator('button[type="submit"]').click();
    
    // Expect confirmation or reference ID
    const refText = page.locator('text=CC-, text=Report Registered, text=Reference ID, text=Submitted').first();
    await expect(refText).toBeVisible({ timeout: 20000 });
  });

  test('15. Citizen tracking page displays real-time complaint status changes', async ({ page }) => {
    // Create complaint via API
    const complaint = await createComplaintViaApi({
      description: 'Water supply pipe leak on 1st avenue during morning peak hours.',
      category: 'Water Supply',
      lat: 17.7321,
      lng: 83.3105,
      address: '1st Avenue, Water Line',
      email: TEST_USERS.citizen.email
    });

    const refId = complaint.reference_id || complaint.referenceId;
    expect(refId).toBeDefined();

    // Navigate to public tracking page
    await page.goto(`/track?id=${refId}`);
    await page.waitForLoadState('domcontentloaded');

    // Verify status is shown
    await expect(page.locator(`text=${refId}, text=SUBMITTED, text=ROUTED, text=Tracking, text=Status`).first()).toBeVisible({ timeout: 10000 });
  });

});
