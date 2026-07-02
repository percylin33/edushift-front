import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AdminPaymentsPageComponent } from './admin-payments-page.component';
import { AdminPaymentsStore } from '../../store/admin-payments.store';
import { Payment } from '../../models/invoice.model';

describe('AdminPaymentsPageComponent', () => {
  let fixture: ComponentFixture<AdminPaymentsPageComponent>;
  let component: AdminPaymentsPageComponent;
  let fakeStore: {
    items: ReturnType<typeof signal<Payment[]>>;
    totalElements: ReturnType<typeof signal<number>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    hasItems: ReturnType<typeof signal<boolean>>;
    lastAction: ReturnType<typeof signal<unknown>>;
    pendingAction: ReturnType<typeof signal<string | null>>;
    clearLastAction: jasmine.Spy;
    load: jasmine.Spy;
    reconcile: jasmine.Spy;
    refund: jasmine.Spy;
    markInvoicePaidCash: jasmine.Spy;
    filter: ReturnType<typeof signal<{ status?: string; provider?: string; search?: string }>>;
  };

  const payment: Payment = {
    publicUuid: 'pay-1',
    invoiceId: 'inv-1',
    guardianUserId: 'u-1',
    provider: 'MERCADOPAGO',
    externalId: null,
    status: 'PENDING',
    amountCents: 10000,
    currency: 'PEN',
    paymentMethod: null,
    installments: null,
    paidAt: null,
    failureReason: null,
    createdAt: '2026-06-19',
  };

  function configureModule(): void {
    fakeStore = {
      items: signal<Payment[]>([]),
      totalElements: signal(0),
      loading: signal(false),
      error: signal<string | null>(null),
      hasItems: signal(false),
      lastAction: signal(null),
      pendingAction: signal<string | null>(null),
      clearLastAction: jasmine.createSpy('clearLastAction'),
      load: jasmine.createSpy('load'),
      reconcile: jasmine.createSpy('reconcile'),
      refund: jasmine.createSpy('refund'),
      markInvoicePaidCash: jasmine.createSpy('markInvoicePaidCash'),
      filter: signal({ status: undefined, provider: undefined, search: undefined }),
    };
    TestBed.configureTestingModule({
      imports: [AdminPaymentsPageComponent],
      providers: [{ provide: AdminPaymentsStore, useValue: fakeStore }],
    });
    fixture = TestBed.createComponent(AdminPaymentsPageComponent);
    component = fixture.componentInstance;
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit dispara load', () => {
    configureModule();
    component.ngOnInit();
    expect(fakeStore.load).toHaveBeenCalled();
  });

  it('onStatusChange / onProviderChange / onSearchChange delegan al store', () => {
    configureModule();
    (component as any).onStatusChange('PENDING');
    (component as any).onProviderChange('MERCADOPAGO');
    (component as any).onSearchChange('x');
    expect(fakeStore.load).toHaveBeenCalledTimes(3);
  });

  it('onStatusChange con valor vacío normaliza a undefined', () => {
    configureModule();
    (component as any).onStatusChange('');
    const call = fakeStore.load.calls.mostRecent().args[0];
    expect(call.status).toBeUndefined();
  });

  it('open / closeModal alternan modal', () => {
    configureModule();
    (component as any).open('reconcile', payment);
    expect((component as any).modalKind()).toBe('reconcile');
    expect((component as any).modalPayment()?.publicUuid).toBe('pay-1');
    (component as any).closeModal();
    expect((component as any).modalKind()).toBeNull();
    expect((component as any).modalPayment()).toBeNull();
  });

  it('onModalSubmit reconcile llama store con reason', () => {
    configureModule();
    (component as any).open('reconcile', payment);
    (component as any).onModalSubmit({ reason: 'manual' });
    expect(fakeStore.reconcile).toHaveBeenCalledWith('pay-1', { reason: 'manual' });
  });

  it('onModalSubmit refund llama store con reason', () => {
    configureModule();
    (component as any).open('refund', payment);
    (component as any).onModalSubmit({ reason: 'solicitud' });
    expect(fakeStore.refund).toHaveBeenCalledWith('pay-1', { reason: 'solicitud' });
  });

  it('onModalSubmit sin kind ignora', () => {
    configureModule();
    (component as any).onModalSubmit({ reason: 'x' });
    expect(fakeStore.reconcile).not.toHaveBeenCalled();
  });

  it('onModalSubmit cierra modal tras enviar', () => {
    configureModule();
    (component as any).open('reconcile', payment);
    (component as any).onModalSubmit({ reason: 'r' });
    expect((component as any).modalKind()).toBeNull();
  });

  it('canReconcile / canRefund reflejan status', () => {
    configureModule();
    expect((component as any).canReconcile({ ...payment, status: 'PENDING' })).toBeTrue();
    expect((component as any).canReconcile({ ...payment, status: 'IN_PROCESS' })).toBeTrue();
    expect((component as any).canReconcile({ ...payment, status: 'APPROVED' })).toBeFalse();
    expect((component as any).canRefund({ ...payment, status: 'APPROVED' })).toBeTrue();
    expect((component as any).canRefund({ ...payment, status: 'PENDING' })).toBeFalse();
  });

  it('statusBadge retorna clase tier correcta', () => {
    configureModule();
    expect((component as any).statusBadge('PENDING')).toContain('amber');
    expect((component as any).statusBadge('APPROVED')).toContain('emerald');
    expect((component as any).statusBadge('REJECTED')).toContain('rose');
    expect((component as any).statusBadge('UNKNOWN' as any)).toContain('slate');
  });

  it('isEndpointMissing detecta 404', () => {
    configureModule();
    fakeStore.error.set('404 not found');
    expect((component as any).isEndpointMissing()).toBeTrue();
    fakeStore.error.set('boom');
    expect((component as any).isEndpointMissing()).toBeFalse();
    fakeStore.error.set(null);
    expect((component as any).isEndpointMissing()).toBeFalse();
  });
});
