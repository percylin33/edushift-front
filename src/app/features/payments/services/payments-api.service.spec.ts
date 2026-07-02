import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PaymentsApiService } from './payments-api.service';
import { ApiService } from '@core/services';

describe('PaymentsApiService', () => {
  let service: PaymentsApiService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const samplePayment = {
    publicUuid: 'pay-1',
    invoiceId: 'inv-1',
    guardianUserId: 'u-1',
    provider: 'MERCADOPAGO',
    externalId: null,
    status: 'PENDING',
    amountCents: 1000,
    currency: 'PEN',
    paymentMethod: null,
    installments: null,
    paidAt: null,
    failureReason: null,
    createdAt: '2026-06-19',
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'patch']);
    TestBed.configureTestingModule({
      providers: [PaymentsApiService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(PaymentsApiService);
  });

  it('listMyInvoices hace GET al endpoint de invoices', (done) => {
    apiSpy.get.and.returnValue(of({ content: [], totalElements: 0 }));
    service.listMyInvoices().subscribe((res) => {
      expect(res.totalElements).toBe(0);
      expect(apiSpy.get).toHaveBeenCalled();
      done();
    });
  });

  it('getInvoice hace GET al endpoint por uuid', (done) => {
    apiSpy.get.and.returnValue(of({ publicUuid: 'inv-1' }));
    service.getInvoice('inv-1').subscribe((inv) => {
      expect(inv.publicUuid).toBe('inv-1');
      done();
    });
  });

  it('listPaymentsForInvoice retorna array', (done) => {
    apiSpy.get.and.returnValue(of([samplePayment]));
    service.listPaymentsForInvoice('inv-1').subscribe((payments) => {
      expect(payments).toHaveSize(1);
      done();
    });
  });

  it('checkout POSTea y retorna CheckoutResponse', (done) => {
    apiSpy.post.and.returnValue(
      of({
        paymentPublicUuid: 'pay-1',
        initPoint: 'https://mp.com/1',
        sandboxInitPoint: 'https://sandbox.mp.com/1',
      }),
    );
    service.checkout('inv-1').subscribe((resp) => {
      expect(resp.initPoint).toContain('mp.com');
      done();
    });
  });

  it('listAllPayments envía filtros como query params', (done) => {
    apiSpy.get.and.returnValue(of({ content: [samplePayment], totalElements: 1 }));
    service
      .listAllPayments({
        status: 'PENDING',
        provider: 'MERCADOPAGO',
        search: 'x',
        page: 0,
        size: 20,
      })
      .subscribe((res) => {
        expect(res.content).toHaveSize(1);
        const url = apiSpy.get.calls.mostRecent().args[0] as string;
        expect(url).toContain('status=PENDING');
        expect(url).toContain('provider=MERCADOPAGO');
        expect(url).toContain('search=x');
        expect(url).toContain('page=0');
        expect(url).toContain('size=20');
        done();
      });
  });

  it('listAllPayments sin filtros no añade params', (done) => {
    apiSpy.get.and.returnValue(of({ content: [], totalElements: 0 }));
    service.listAllPayments().subscribe(() => {
      const url = apiSpy.get.calls.mostRecent().args[0] as string;
      expect(url).not.toContain('status=');
      expect(url).not.toContain('provider=');
      expect(url).not.toContain('search=');
      done();
    });
  });

  it('reconcile POSTea reason', (done) => {
    apiSpy.post.and.returnValue(of(samplePayment));
    service.reconcile('pay-1', { reason: 'manual' }).subscribe(() => {
      expect(apiSpy.post).toHaveBeenCalled();
      done();
    });
  });

  it('refund POSTea reason', (done) => {
    apiSpy.post.and.returnValue(of({ ...samplePayment, status: 'REFUNDED' }));
    service.refund('pay-1', { reason: 'solicitud del cliente' }).subscribe((p) => {
      expect(p.status).toBe('REFUNDED');
      done();
    });
  });

  it('markInvoicePaidCash POSTea body opcional', (done) => {
    apiSpy.post.and.returnValue(of(samplePayment));
    service.markInvoicePaidCash('inv-1', { note: 'cobrado en ventanilla' }).subscribe(() => {
      expect(apiSpy.post).toHaveBeenCalled();
      done();
    });
  });
});
