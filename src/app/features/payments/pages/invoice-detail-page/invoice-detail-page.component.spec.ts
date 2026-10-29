import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { InvoiceDetailPageComponent } from './invoice-detail-page.component';
import { PaymentsApiService } from '../../services/payments-api.service';
import { Invoice, Payment } from '../../models/invoice.model';
import { FileUploadService } from '@core/services/file-upload.service';

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
    evidenceFilePublicUuid: null,
    evidenceSubmittedAt: null,
    evidenceNotes: null,
    evidenceRejectionReason: null,
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
      'listPublicPaymentMethods',
      'checkout',
      'submitEvidence',
      'downloadReceipt',
    ]);
    fakeApi.listPublicPaymentMethods.and.returnValue(of([]));
    TestBed.configureTestingModule({
      imports: [InvoiceDetailPageComponent],
      providers: [
        provideRouter([]),
        { provide: PaymentsApiService, useValue: fakeApi },
        { provide: FileUploadService, useValue: { downloadAndSave: jasmine.createSpy().and.resolveTo(undefined) } },
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
    expect(component['errorMsg']()).toBe('UUID inválido');
  });

  it('ngOnInit carga invoice y payments', () => {
    configureModule();
    fakeApi.getInvoice.and.returnValue(of(invoice));
    fakeApi.listPaymentsForInvoice.and.returnValue(of([payment]));
    component.ngOnInit();
    expect(component['invoice']()?.publicUuid).toBe('inv-1');
    expect(component['items']()).toHaveSize(1);
    expect(component['payments']()).toHaveSize(1);
    expect(component['loading']()).toBeFalse();
  });

  it('ngOnInit maneja error en getInvoice', () => {
    configureModule();
    fakeApi.getInvoice.and.returnValue(throwError(() => ({ error: { message: 'no encontrado' } })));
    fakeApi.listPaymentsForInvoice.and.returnValue(of([]));
    component.ngOnInit();
    expect(component['errorMsg']()).toBe('no encontrado');
    expect(component['loading']()).toBeFalse();
  });

  it('ngOnInit error de payments es no-bloqueante', () => {
    configureModule();
    fakeApi.getInvoice.and.returnValue(of(invoice));
    fakeApi.listPaymentsForInvoice.and.returnValue(throwError(() => new Error('x')));
    component.ngOnInit();
    expect(component['invoice']()?.publicUuid).toBe('inv-1');
  });

  it('permite subir voucher para cuotas pendientes y en revisión', () => {
    configureModule();
    component['invoice'].set({ ...invoice, status: 'PENDING' });
    expect(component.canUploadEvidence()).toBeTrue();
    component['invoice'].set({ ...invoice, status: 'OVERDUE' });
    expect(component.canUploadEvidence()).toBeTrue();
    component['invoice'].set({ ...invoice, status: 'PENDING_REVIEW' });
    expect(component.canUploadEvidence()).toBeTrue();
    component['invoice'].set({ ...invoice, status: 'PAID' });
    expect(component.canUploadEvidence()).toBeFalse();
  });

  it('habilita descarga de recibo solo para cuotas pagadas', () => {
    configureModule();
    expect(component.canDownloadReceipt()).toBeFalse();
    component['invoice'].set({ ...invoice, status: 'PAID' });
    expect(component.canDownloadReceipt()).toBeTrue();
  });

  it('envía el voucher y la nota opcional', () => {
    configureModule();
    component['invoice'].set(invoice);
    fakeApi.submitEvidence.and.returnValue(of({ ...invoice, status: 'PENDING_REVIEW' }));
    component.evidenceNotes = '  operación 123  ';
    component.onEvidenceUploaded({
      publicUuid: 'file-1',
      originalName: 'voucher.png',
      contentType: 'image/png',
      sizeBytes: 1024,
      checksumSha256: 'abc123',
      url: '/files/file-1',
      createdAt: '2026-10-29T12:00:00.000Z',
    });
    expect(fakeApi.submitEvidence).toHaveBeenCalledWith('inv-1', {
      filePublicUuid: 'file-1',
      notes: 'operación 123',
    });
    expect(component['invoice']()!.status).toBe('PENDING_REVIEW');
    expect(component['submittingEvidence']()).toBeFalse();
  });

  it('muestra error si falla el envío del voucher', () => {
    configureModule();
    component['invoice'].set(invoice);
    fakeApi.submitEvidence.and.returnValue(throwError(() => ({ error: { message: 'falló' } })));
    component.onEvidenceUploaded({
      publicUuid: 'file-1',
      originalName: 'voucher.png',
      contentType: 'image/png',
      sizeBytes: 1024,
      checksumSha256: 'abc123',
      url: '/files/file-1',
      createdAt: '2026-10-29T12:00:00.000Z',
    });
    expect(component['errorMsg']()).toBe('falló');
    expect(component['submittingEvidence']()).toBeFalse();
  });

  it('helpers de formato delegan a las constantes del modelo', () => {
    configureModule();
    expect(component['statusLabel']('PENDING')).toBe('Pendiente');
    expect(component['badgeClass']('PENDING')).toContain('amber');
    expect(component['money'](10000, 'PEN')).toBe('S/ 100.00');
  });
});
