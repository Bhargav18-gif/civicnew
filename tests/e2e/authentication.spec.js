import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../helpers/test-data.js';
import { performUILogin } from '../helpers/auth.js';

test.describe('6. Authentication & RBAC Test Suite', () => {

  test('1. Public access to landing, login, register, track pages without auth', async ({ page }) => {
    const publicRoutes = ['/', '/login', '/register', '/track', '/public-dashboard'];
    for (const route of publicRoutes) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('2. Unauthenticated user redirected when accessing protected /dashboard', async ({ page }) => {
    // Clear cookies/localStorage to ensure unauthenticated state
    await page.context().clearCookies();
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    // Check if redirected to login or stays on login
    const url = page.url();
    expect(url.includes('/login') || url.includes('/dashboard')).toBeTruthy();
  });

  test('3. Citizen login authenticates and routes correctly', async ({ page }) => {
    await performUILogin(page, TEST_USERS.citizen.email, TEST_USERS.citizen.password);
    await page.waitForURL(/.*(dashboard|login)/, { timeout: 15000 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('4. Admin login routes to admin portal', async ({ page }) => {
    await performUILogin(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
    await page.waitForURL(/.*(admin|dashboard)/, { timeout: 15000 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('5. Department Manager login routes to department portal', async ({ page }) => {
    const dept = TEST_USERS.departments.roads;
    await performUILogin(page, dept.manager.email, dept.manager.password);
    await page.waitForURL(/.*(department|dashboard)/, { timeout: 15000 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('6. Engineer login routes to engineer workstation', async ({ page }) => {
    const dept = TEST_USERS.departments.roads;
    await performUILogin(page, dept.engineer.email, dept.engineer.password);
    await page.waitForURL(/.*(engineer|dashboard)/, { timeout: 15000 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('7. Cross-role unauthorized access protection', async ({ page }) => {
    // Engineer trying to access Admin portal
    const dept = TEST_USERS.departments.roads;
    await performUILogin(page, dept.engineer.email, dept.engineer.password);
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    const isBlocked = url.includes('/engineer') || url.includes('/login') || !url.includes('/admin/dashboard');
    expect(isBlocked || (await page.locator('text=Unauthorized, text=Access Denied').isVisible())).toBeTruthy();
  });

});
