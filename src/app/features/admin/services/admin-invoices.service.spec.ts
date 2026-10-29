import { TestBed } from '@angular/core/testing';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { of, throwError } from 'rxjs';
import { AdminInvoicesService } from './admin-invoices.service';

describe('AdminInvoicesService', () => {
  let service: AdminInvoicesService;
  let api: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post']);
    TestBed.configureTestingModule({
      providers: [AdminInvoicesService, { provide: ApiService, useValue: api }],
    });
    service = TestBed.inject(AdminInvoicesService);
  });

  it('loads invoices with defaults and maps the primary response fields', () => {
    api.get.and.returnValue(
      of({
        data: {
          content: [
            {
              id: 'invoice-1',
              tenantName: 'Colegio Norte',
              periodStart: '2026-01-01',
              periodEnd: '2026-01-31',
              activeStudentCount: 42,
              totalCents: 125000,
              status: 'PAID',
              dueAt: '2026-02-01',
              paidAt: '2026-01-30',
            },
          ],
          totalPages: 3,
        },
      }),
    );

    service.loadInvoices();

    expect(api.get).toHaveBeenCalledWith(API.ADMIN.INVOICES_ROOT, { page: 0, size: 10 });
    expect(service.invoices()).toEqual([
      {
        publicUuid: 'invoice-1',
        tenantName: 'Colegio Norte',
        period: '2026-01-01 – 2026-01-31',
        activeStudents: 42,
        totalCents: 125000,
        status: 'PAID',
        dueDate: '2026-02-01',
        paidAt: '2026-01-30',
      },
    ]);
    expect(service.totalPages()).toBe(3);
    expect(service.loading()).toBeFalse();
    expect(service.error()).toBeNull();
  });

  it('supports legacy invoice aliases and empty response defaults', () => {
    api.get.and.returnValue(
      of({
        data: {
          content: [
            {
              publicUuid: 'invoice-2',
              tenantId: 'tenant-2',
              period: '2026-02',
              activeStudents: '12',
              totalCents: 'invalid',
              dueDate: '2026-03-01',
              paidAt: null,
            },
          ],
          totalPages: undefined,
        },
      }),
    );

    service.loadInvoices({ status: 'OVERDUE', page: 2, size: 5 });

    expect(api.get).toHaveBeenCalledWith(API.ADMIN.INVOICES_ROOT, {
      page: 2,
      size: 5,
      status: 'OVERDUE',
    });
    expect(service.invoices()[0]).toEqual({
      publicUuid: 'invoice-2',
      tenantName: 'tenant-2',
      period: '2026-02',
      activeStudents: 12,
      totalCents: 0,
      status: '',
      dueDate: '2026-03-01',
      paidAt: undefined,
    });
    expect(service.totalPages()).toBe(0);

    api.get.and.returnValue(of({ data: { content: undefined, totalPages: undefined } }));
    service.loadInvoices({ status: '' });
    expect(service.invoices()).toEqual([]);
  });

  it('loads tenant invoices and uses a default error when the response has no message', () => {
    api.get.and.returnValue(of({ data: undefined }));
    service.loadTenantInvoices('tenant-1');
    expect(api.get).toHaveBeenCalledWith(API.ADMIN.TENANT_INVOICES('tenant-1'));
    expect(service.invoices()).toEqual([]);
    expect(service.totalPages()).toBe(1);

    api.get.and.returnValue(throwError(() => ({})));
    service.loadTenantInvoices('tenant-1');
    expect(service.error()).toBe('No se pudieron cargar los comprobantes.');
    expect(service.loading()).toBeFalse();
  });

  it('maps invoice details, payment aliases and numeric fallbacks', () => {
    api.get.and.returnValues(
      of({ data: { id: 'invoice-3', pricePerStudentCents: '2500', issuedAt: '2026-01-01' } }),
      of({
        data: [
          {
            id: 'payment-1',
            amountCents: 2500,
            paymentMethod: 'TRANSFER',
            externalRef: 'ref-1',
            status: 'SETTLED',
            paidAt: '2026-01-02',
          },
          {
            publicUuid: 'payment-2',
            amountCents: null,
            method: 'CASH',
            reference: 'ref-2',
          },
        ],
      }),
    );

    service.loadInvoiceDetail('invoice-3');

    expect(api.get).toHaveBeenCalledWith(API.ADMIN.INVOICE_BY_ID('invoice-3'));
    expect(api.get).toHaveBeenCalledWith(API.ADMIN.INVOICE_PAYMENTS('invoice-3'));
    expect(service.selectedInvoice()).toEqual(
      jasmine.objectContaining({
        publicUuid: 'invoice-3',
        pricePerStudentCents: 2500,
        issuedAt: '2026-01-01',
        payments: [
          {
            publicUuid: 'payment-1',
            amountCents: 2500,
            method: 'TRANSFER',
            reference: 'ref-1',
            status: 'SETTLED',
            paidAt: '2026-01-02',
          },
          {
            publicUuid: 'payment-2',
            amountCents: 0,
            method: 'CASH',
            reference: 'ref-2',
            status: '',
            paidAt: '',
          },
        ],
      }),
    );
    expect(service.loading()).toBeFalse();
  });

  it('reports invoice detail and payment registration errors with safe defaults', () => {
    api.get.and.returnValues(
      throwError(() => ({ error: { message: 'Detalle no disponible' } })),
      of({ data: [] }),
    );
    service.loadInvoiceDetail('invoice-4');
    expect(service.error()).toBe('Detalle no disponible');
    expect(service.loading()).toBeFalse();

    api.post.and.returnValue(throwError(() => ({})));
    service.registerPayment(
      { invoiceId: 'invoice-4', amountCents: 100, method: 'CASH' },
      'invoice-4',
    );
    expect(service.error()).toBe('No se pudo registrar el pago.');

    api.post.and.returnValue(of({}));
    const invoicesSpy = spyOn(service, 'loadInvoices');
    const detailSpy = spyOn(service, 'loadInvoiceDetail');
    service.registerPayment(
      { invoiceId: 'invoice-4', amountCents: 100, method: 'CASH' },
      'invoice-4',
    );
    expect(invoicesSpy).toHaveBeenCalled();
    expect(detailSpy).toHaveBeenCalledWith('invoice-4');
  });
});
