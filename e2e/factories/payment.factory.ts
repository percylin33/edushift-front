import { APIRequestContext } from '@playwright/test';
import { CreatedEntity, seqId } from './_shared';

/**
 * Factory: create a payment invoice.
 *
 * <p>Used by payments UI + RBAC-matrix specs. The MercadoPago checkout
 * flow is mocked separately via {@code utils/mercadopago-mock.ts}.</p>
 */
export async function makeInvoice(
  api: APIRequestContext,
  overrides: {
    studentPublicUuid: string;
    amount?: number;
    currency?: 'PEN' | 'USD';
    description?: string;
    dueDate?: string;
  },
): Promise<CreatedEntity> {
  const id = seqId('inv');
  const payload = {
    studentPublicUuid: overrides.studentPublicUuid,
    amount: overrides.amount ?? 150.0,
    currency: overrides.currency ?? 'PEN',
    description: overrides.description ?? `Invoice ${id}`,
    dueDate: overrides.dueDate ?? new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
  };
  const res = await api.post('/api/v1/payments/invoices', { data: payload });
  if (!res.ok()) {
    throw new Error(`makeInvoice failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      // Invoices have no DELETE endpoint (immutable for audit).
      // No-op cleanup — the spec should pick a unique studentPublicUuid
      // so the invoice doesn't collide on re-runs.
    },
  };
}
