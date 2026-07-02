import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { InvoicesPageComponent } from './invoices-page.component';
import { PaymentsApiService } from '../../services/payments-api.service';
import { Invoice } from '../../models/invoice.model';

describe('InvoicesPageComponent', () => {
  let fixture: ComponentFixture<InvoicesPageComponent>;
  let component: InvoicesPageComponent;
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
      { id: '1', description: 'X', quantity: 1, unitAmountCents: 10000, lineTotalCents: 10000 },
    ],
  };

  beforeEach(() => {
    fakeApi = jasmine.createSpyObj<PaymentsApiService>('PaymentsApiService', ['listMyInvoices']);
    TestBed.configureTestingModule({
      imports: [InvoicesPageComponent],
      providers: [provideRouter([]), { provide: PaymentsApiService, useValue: fakeApi }],
    });
    fixture = TestBed.createComponent(InvoicesPageComponent);
    component = fixture.componentInstance;
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnInit carga invoices', () => {
    fakeApi.listMyInvoices.and.returnValue(of({ content: [invoice], totalElements: 1 }));
    component.ngOnInit();
    expect((component as any).items()).toHaveSize(1);
    expect((component as any).loading()).toBeFalse();
  });

  it('ngOnInit maneja error', () => {
    fakeApi.listMyInvoices.and.returnValue(throwError(() => ({ error: { message: 'falló' } })));
    component.ngOnInit();
    expect((component as any).errorMsg()).toBe('falló');
    expect((component as any).loading()).toBeFalse();
  });

  it('helpers de formato delegan al modelo', () => {
    expect((component as any).statusLabel('PENDING')).toBe('Pendiente');
    expect((component as any).badgeClass('PENDING')).toContain('amber');
    expect((component as any).money(25000, 'PEN')).toBe('S/ 250.00');
  });
});
