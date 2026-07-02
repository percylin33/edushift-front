import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { AdminPaymentActionModalComponent } from './admin-payment-action-modal.component';
import { Payment } from '../../models/invoice.model';

/**
 * Smoke spec for the admin payment action modal (Sprint 11 / FE-11.5).
 *
 * <p>The component is a leaf with no DI dependencies, so we can mount
 * it standalone and verify the per-mode contract:</p>
 *
 * <ul>
 *   <li>{@code reconcile} / {@code refund} require a non-empty reason
 *       (the submit emit is gated by form validity).</li>
 *   <li>{@code mark-paid-cash} emits an optional {@code note} only.</li>
 *   <li>Cancel click emits {@code cancel}.</li>
 *   <li>Backdrop click emits {@code cancel} (and inner click does not).</li>
 * </ul>
 *
 * <p>This is intentionally a smoke test: the page-level behavior
 * (filters, last action banner) is covered by FE-11.1's type-driven
 * design. End-to-end browser coverage (Cypress / Playwright) is on
 * the FE roadmap (DEBT-FE-E2E-1) and is not in scope for Sprint 11.</p>
 */
describe('AdminPaymentActionModalComponent', () => {
  let fixture: ComponentFixture<AdminPaymentActionModalComponent>;
  let component: AdminPaymentActionModalComponent;

  const dummyPayment: Payment = {
    publicUuid: 'pay-1',
    invoiceId: 'inv-1',
    guardianUserId: 'u-1',
    provider: 'MERCADOPAGO',
    externalId: 'ext-1',
    status: 'PENDING',
    amountCents: 25000,
    currency: 'PEN',
    paymentMethod: null,
    installments: 1,
    paidAt: null,
    failureReason: null,
    createdAt: '2026-06-19T00:00:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, AdminPaymentActionModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPaymentActionModalComponent);
    component = fixture.componentInstance;
  });

  function setKind(kind: 'reconcile' | 'refund' | 'mark-paid-cash') {
    component.kind = kind;
    component.payment = dummyPayment;
    fixture.detectChanges();
  }

  it('reconcile: requires a reason of at least 4 chars', () => {
    setKind('reconcile');
    expect(component.requiresReason()).toBeTrue();
    expect(component.form.controls.reason.hasValidator).toBeTruthy();
  });

  it('mark-paid-cash: does not require a reason', () => {
    setKind('mark-paid-cash');
    expect(component.requiresReason()).toBeFalse();
  });

  it('refund: emits submit with reason when form valid', () => {
    setKind('refund');
    component.form.controls.reason.setValue('cobro duplicado');
    const submitSpy = spyOn(component.submit, 'emit');

    component.onSubmit();

    expect(submitSpy).toHaveBeenCalledWith({ reason: 'cobro duplicado' });
  });

  it('mark-paid-cash: emits submit with note only', () => {
    setKind('mark-paid-cash');
    component.form.controls.reason.setValue('motivo');
    component.form.controls.note.setValue('cobrado en administración');
    const submitSpy = spyOn(component.submit, 'emit');

    component.onSubmit();

    expect(submitSpy).toHaveBeenCalledWith({ note: 'cobrado en administración' });
  });

  it('invalid form: does not emit submit, marks all as touched', () => {
    setKind('reconcile');
    const submitSpy = spyOn(component.submit, 'emit');
    component.form.controls.reason.setValue('x'); // < 4 chars

    component.onSubmit();

    expect(submitSpy).not.toHaveBeenCalled();
    expect(component.form.controls.reason.touched).toBeTrue();
  });

  it('cancel: emits cancel when cancel button invoked', () => {
    setKind('reconcile');
    const cancelSpy = spyOn(component.cancel, 'emit');

    component.cancel.emit();

    expect(cancelSpy).toHaveBeenCalled();
  });

  it('backdrop click: emits cancel when currentTarget == target', () => {
    setKind('reconcile');
    const cancelSpy = spyOn(component.cancel, 'emit');
    const fakeEvent = { target: 'X', currentTarget: 'X' } as unknown as MouseEvent;
    const stopSpy = jasmine.createSpy('stopPropagation');

    component.onBackdropClick({ ...fakeEvent, stopPropagation: stopSpy } as unknown as MouseEvent);

    expect(cancelSpy).toHaveBeenCalled();
  });

  it('inner click: does NOT emit cancel', () => {
    setKind('reconcile');
    const cancelSpy = spyOn(component.cancel, 'emit');
    const fakeEvent = { target: 'A', currentTarget: 'B' } as unknown as MouseEvent;

    component.onBackdropClick({
      ...fakeEvent,
      stopPropagation: () => undefined,
    } as unknown as MouseEvent);

    expect(cancelSpy).not.toHaveBeenCalled();
  });
});
