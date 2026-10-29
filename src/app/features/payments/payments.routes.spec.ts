import { PAYMENTS_ROUTES } from './payments.routes';

describe('PAYMENTS_ROUTES', () => {
  it('define rutas esperadas', () => {
    const paths = PAYMENTS_ROUTES.map((r) => r.path);
    expect(paths).toContain('invoices');
    expect(paths).toContain('invoices/:publicUuid');
    expect(paths).toContain('admin');
  });

  it('raíz usa role redirect (no hard redirect)', () => {
    const root = PAYMENTS_ROUTES.find((r) => r.path === '')!;
    expect(root.component).toBeDefined();
  });

  it('admin children incluyen emit, plans y policy', () => {
    const admin = PAYMENTS_ROUTES.find((r) => r.path === 'admin')!;
    const childPaths = (admin.children ?? []).map((c) => c.path);
    expect(childPaths).toContain('emit');
    expect(childPaths).toContain('plans');
    expect(childPaths).toContain('policy');
    expect(childPaths).toContain('concepts');
  });

  it('admin usa permissionGuard con LMS_PAYMENT_ADMIN', () => {
    const admin = PAYMENTS_ROUTES.find((r) => r.path === 'admin')!;
    expect(admin.canMatch).toBeDefined();
    expect((admin.data?.['permissions'] as string[])).toContain('LMS_PAYMENT_ADMIN');
  });

  it('invoices es lazy loadComponent', () => {
    const r = PAYMENTS_ROUTES.find((x) => x.path === 'invoices')!;
    expect(typeof r.loadComponent).toBe('function');
  });

  it('invoices/:publicUuid carga InvoiceDetailPageComponent', () => {
    const r = PAYMENTS_ROUTES.find((x) => x.path === 'invoices/:publicUuid')!;
    expect(typeof r.loadComponent).toBe('function');
  });
});
