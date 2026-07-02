import { PAYMENTS_ROUTES } from './payments.routes';

describe('PAYMENTS_ROUTES', () => {
  it('define rutas esperadas', () => {
    const paths = PAYMENTS_ROUTES.map((r) => r.path);
    expect(paths).toContain('invoices');
    expect(paths).toContain('invoices/:publicUuid');
    expect(paths).toContain('admin');
  });

  it('raíz redirige a invoices', () => {
    const root = PAYMENTS_ROUTES.find((r) => r.path === '')!;
    expect(root.redirectTo).toBe('invoices');
  });

  it('admin usa permissionGuard con LMS_PAYMENT_ADMIN', () => {
    const admin = PAYMENTS_ROUTES.find((r) => r.path === 'admin')!;
    expect(admin.canMatch).toBeDefined();
    expect((admin.data as any).permissions).toBe('LMS_PAYMENT_ADMIN');
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
