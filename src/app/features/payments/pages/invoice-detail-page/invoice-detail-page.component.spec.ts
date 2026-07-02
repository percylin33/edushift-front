import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { InvoiceDetailPageComponent } from './invoice-detail-page.component';
import { PaymentsApiService } from '../../services/payments-api.service';
import { Invoice, Payment } from '../../models/invoice.model';

describe('InvoiceDetailPageComponent', () => {
  let fixture: ComponentFixture<InvoiceDetailPageComponent>;
  let component: InvoiceDetailPageComponent;
  let fakeApi: jasmine.SpyObj<PaymentsApiService>;

  const invoice: Invoice = {
    publicUuid: 'inv-1',
    subscriptionId: null,
    studentId: 's-1',
    guardianUserId: 'u-1',
    periodLabel: 'Marzo',
    currency: 'PEN',
    subtotalCents: 10000,
    discountCents: 0,
    taxCents: 0,
    totalCents: 10000,
    status: 'PENDING',
    issuedAt: '2026-03-01',
    dueAt: '2026-03-15',
    paidAt: null,
    notes: null,
    items: [
      {
        id: '1',
        description: 'Matrícula',
        quantity: 1,
        unitAmountCents: 10000,
        lineTotalCents: 10000,
      },
    ],
  };

  const payment: Payment = {
    publicUuid: 'pay-1',
    invoiceId: 'inv-1',
    guardianUserId: 'u-1',
    provider: 'MERCADOPAGO',
    externalId: '12345',
    status: 'PENDING',
    amountCents: 10000,
    currency: 'PEN',
    paymentMethod: null,
    installments: null,
    paidAt: null,
    failureReason: null,
    createdAt: '2026-03-15',
  };

  function configureModule(uuid: string | null = 'inv-1'): void {
    TestBed.resetTestingModule();
    fakeApi = jasmine.createSpyObj<PaymentsApiService>('PaymentsApiService', [
      'getInvoice',
      'listPaymentsForInvoice',
      'checkout',
    ]);
    TestBed.configureTestingModule({
      imports: [InvoiceDetailPageComponent],
      providers: [
        provideRouter([]),
        { provide: PaymentsApiService, useValue: fakeApi },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (_: string) => uuid } } },
        },
      ],
    });
    fixture = TestBed.createComponent(InvoiceDetailPageComponent);
    component = fixture.componentInstance;
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit sin uuid setea error', () => {
    configureModule(null);
    component.ngOnInit();
    expect((component as any).errorMsg()).toBe('UUID inválido');
  });

  it('ngOnInit carga invoice y payments', () => {
    configureModule();
    fakeApi.getInvoice.and.returnValue(of(invoice));
    fakeApi.listPaymentsForInvoice.and.returnValue(of([payment]));
    component.ngOnInit();
    expect((component as any).invoice()?.publicUuid).toBe('inv-1');
    expect((component as any).items()).toHaveSize(1);
    expect((component as any).payments()).toHaveSize(1);
    expect((component as any).loading()).toBeFalse();
  });

  it('ngOnInit maneja error en getInvoice', () => {
    configureModule();
    fakeApi.getInvoice.and.returnValue(throwError(() => ({ error: { message: 'no encontrado' } })));
    fakeApi.listPaymentsForInvoice.and.returnValue(of([]));
    component.ngOnInit();
    expect((component as any).errorMsg()).toBe('no encontrado');
    expect((component as any).loading()).toBeFalse();
  });

  it('ngOnInit error de payments es no-bloqueante', () => {
    configureModule();
    fakeApi.getInvoice.and.returnValue(of(invoice));
    fakeApi.listPaymentsForInvoice.and.returnValue(throwError(() => new Error('x')));
    component.ngOnInit();
    expect((component as any).invoice()?.publicUuid).toBe('inv-1');
  });

  it('canPay true para PENDING y OVERDUE', () => {
    configureModule();
    (component as any).invoice.set({ ...invoice, status: 'PENDING' });
    expect((component as any).canPay()).toBeTrue();
    (component as any).invoice.set({ ...invoice, status: 'OVERDUE' });
    expect((component as any).canPay()).toBeTrue();
    (component as any).invoice.set({ ...invoice, status: 'PAID' });
    expect((component as any).canPay()).toBeFalse();
  });

  it('canPay false sin invoice', () => {
    configureModule();
    expect((component as any).canPay()).toBeFalse();
  });

  it('onPay llama checkout y abre initPoint', () => {
    configureModule();
    (component as any).invoice.set(invoice);
    fakeApi.checkout.and.returnValue(
      of({ paymentPublicUuid: 'p-1', initPoint: 'https://mp.com', sandboxInitPoint: '' }),
    );
    spyOn(window, 'open');
    (component as any).onPay();
    expect(fakeApi.checkout).toHaveBeenCalledWith('inv-1');
    expect(window.open).toHaveBeenCalledWith('https://mp.com', '_blank', jasmine.any(String));
  });

  it('onPay sin invoice no llama checkout', () => {
    configureModule();
    (component as any).onPay();
    expect(fakeApi.checkout).not.toHaveBeenCalled();
  });

  it('onPay maneja error', () => {
    configureModule();
    (component as any).invoice.set(invoice);
    fakeApi.checkout.and.returnValue(throwError(() => ({ error: { message: 'pago falló' } })));
    (component as any).onPay();
    expect((component as any).errorMsg()).toBe('pago falló');
  });

  it('helpers de formato delegan a las constantes del modelo', () => {
    configureModule();
    expect((component as any).statusLabel('PENDING')).toBe('Pendiente');
    expect((component as any).badgeClass('PENDING')).toContain('amber');
    expect((component as any).money(10000, 'PEN')).toBe('S/ 100.00');
  });
});
