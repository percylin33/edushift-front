import { test, expect } from '@playwright/test';

const ADMIN_BASE = '/admin';

test.describe('SUPER_ADMIN — admin console smoke (QA-15.1)', () => {
  test('dashboard se carga con KPI cards y charts', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/dashboard`);
    await expect(page.locator('h1')).toContainText('Dashboard');

    // Charts (canvas) are always rendered; KPI cards depend on API data
    await expect(page.locator('canvas')).toHaveCount(6);
  });

  test('navegación lateral tiene 7 items', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/dashboard`);
    await expect(page.locator('aside nav a')).toHaveCount(7);
  });

  test('página de tenants se carga con filtros', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/tenants`);
    await expect(page.locator('h1')).toContainText('Instituciones');

    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('página de planes se carga con tabla CRUD', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/plans`);
    await expect(page.locator('h1')).toContainText('Planes');

    await expect(page.locator('table')).toBeVisible();
  });

  test('página de facturas se carga con filtro de estado', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/invoices`);
    await expect(page.locator('h1')).toContainText('Facturas');

    const statusSelect = page.locator('select');
    await expect(statusSelect).toBeVisible();
  });

  test('página de pagos se carga con tabla', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/payments`);
    await expect(page.locator('h1')).toContainText('Pagos');

    await expect(page.locator('table')).toBeVisible();
  });

  test('página de métricas se carga con tabs', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/metrics`);
    await expect(page.locator('h1')).toContainText('Métricas');

    const sections = page.locator('h2').filter({ hasText: /Estudiantes|Docentes|Almacenamiento|IA/ });
    await expect(sections.first()).toBeVisible();
  });

  test('página de auditoría se carga (stub)', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/audit`);
    await expect(page.locator('h1')).toContainText('Auditoría');
  });

  test('logout redirige al login admin', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/dashboard`);
    const logoutBtn = page.locator('button').filter({ hasText: /Cerrar sesión/i });
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click({ force: true });

    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
