import {
  InvoiceStatus,
  PaymentStatus,
  PaymentProvider,
  InvoiceItem,
  Invoice,
  Payment,
  CheckoutResponse,
  ReconcilePaymentRequest,
  RefundPaymentRequest,
  MarkInvoicePaidCashRequest,
  AdminPaymentsQuery,
  STATUS_LABELS,
  STATUS_BADGE,
  formatMoney,
} from './invoice.model';

describe('InvoiceModel', () => {
  describe('InvoiceStatus', () => {
    it('incluye los 5 status esperados', () => {
      const values: InvoiceStatus[] = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED'];
      for (const v of values) expect(STATUS_LABELS[v]).toBeTruthy();
    });
  });

  describe('InvoiceItem', () => {
    it('shape con minor units', () => {
      const item: InvoiceItem = {
        id: '1',
        description: 'Matrícula',
        quantity: 1,
        unitAmountCents: 10000,
        lineTotalCents: 10000,
      };
      expect(item.lineTotalCents).toBe(10000);
    });
  });

  describe('Invoice', () => {
    it('shape completo', () => {
      const i: Invoice = {
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
        items: [],
      };
      expect(i.subscriptionId).toBeNull();
    });
  });

  describe('Payment', () => {
    it('shape completo', () => {
      const p: Payment = {
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
      expect(p.provider).toBe('MERCADOPAGO');
    });
  });

  describe('CheckoutResponse', () => {
    it('incluye initPoint y sandbox', () => {
      const c: CheckoutResponse = {
        paymentPublicUuid: 'pay-1',
        initPoint: 'https://mp.com',
        sandboxInitPoint: 'https://sandbox.mp.com',
      };
      expect(c.initPoint).toContain('mp.com');
    });
  });

  describe('Request shapes', () => {
    it('ReconcilePaymentRequest', () => {
      const r: ReconcilePaymentRequest = { reason: 'manual' };
      expect(r.reason).toBe('manual');
    });
    it('RefundPaymentRequest', () => {
      const r: RefundPaymentRequest = { reason: 'solicitud' };
      expect(r.reason).toBe('solicitud');
    });
    it('MarkInvoicePaidCashRequest con nota opcional', () => {
      const r: MarkInvoicePaidCashRequest = { note: 'efectivo' };
      expect(r.note).toBe('efectivo');
      const r2: MarkInvoicePaidCashRequest = {};
      expect(r2.note).toBeUndefined();
    });
    it('AdminPaymentsQuery todos opcionales', () => {
      const q: AdminPaymentsQuery = {};
      expect(q.page).toBeUndefined();
    });
  });

  describe('formatMoney', () => {
    it('PEN con prefijo S/', () => {
      expect(formatMoney(25000, 'PEN')).toBe('S/ 250.00');
    });
    it('USD sin prefijo', () => {
      expect(formatMoney(25000, 'USD')).toBe('250.00 USD');
    });
    it('cero', () => {
      expect(formatMoney(0, 'PEN')).toBe('S/ 0.00');
    });
    it('default currency es PEN', () => {
      expect(formatMoney(100)).toBe('S/ 1.00');
    });
  });

  describe('STATUS_BADGE', () => {
    it('clases por status', () => {
      expect(STATUS_BADGE.PENDING).toContain('amber');
      expect(STATUS_BADGE.PAID).toContain('emerald');
      expect(STATUS_BADGE.OVERDUE).toContain('rose');
      expect(STATUS_BADGE.CANCELLED).toContain('slate');
      expect(STATUS_BADGE.REFUNDED).toContain('violet');
    });
  });

  describe('PaymentProvider union', () => {
    it('valores conocidos', () => {
      const providers: PaymentProvider[] = ['MERCADOPAGO', 'MANUAL', 'CASH'];
      expect(providers).toContain('MERCADOPAGO');
      expect(providers).toContain('CASH');
    });
  });

  describe('PaymentStatus union', () => {
    it('valores conocidos', () => {
      const statuses: PaymentStatus[] = [
        'PENDING',
        'IN_PROCESS',
        'APPROVED',
        'REJECTED',
        'CANCELLED',
        'REFUNDED',
      ];
      expect(statuses).toContain('REFUNDED');
    });
  });
});
