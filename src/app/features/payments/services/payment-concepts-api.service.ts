import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/services';
import { ApiResponse } from '@core/models';
import { API } from '@core/constants';

/**
 * Tenant-defined billing concept (Sprint cierre-C / F14).
 *
 * <p>Mirrors the BE
 * {@code com.edushift.modules.payments.entity.PaymentConcept} +
 * {@code com.edushift.modules.payments.dto.PaymentConceptResponse}
 * (added in cierre-A / B5 part 1). Categories are the same enum
 * values the BE whitelists in the DB CHECK constraint.</p>
 */
export interface PaymentConcept {
	readonly publicUuid: string;
	readonly code: string;
	readonly name: string;
	readonly description: string | null;
	readonly category: PaymentConceptCategory;
	readonly defaultAmountCents: number;
	readonly currency: string;
	readonly recurring: boolean;
	readonly active: boolean;
	readonly sortOrder: number;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export type PaymentConceptCategory =
	| 'TUITION'
	| 'ENROLLMENT'
	| 'MATERIALS'
	| 'MEALS'
	| 'TRANSPORT'
	| 'EXAM'
	| 'EVENT'
	| 'OTHER';

export interface PaymentConceptRequest {
	code: string;
	name: string;
	description: string | null;
	category: PaymentConceptCategory;
	defaultAmountCents: number;
	currency: string;
	recurring: boolean;
	active: boolean;
	sortOrder: number;
}

/**
 * HTTP boundary for the payment-concepts admin surface.
 * Endpoints live under {@code /admin/payments/concepts}; gated by
 * {@code LMS_PAYMENT_ADMIN} on the server side.
 */
@Injectable({ providedIn: 'root' })
export class PaymentConceptsApiService {
	private readonly api = inject(ApiService);

	/** Paginated list of tenant payment concepts (Spring Pageable). */
	listConcepts(page = 0, size = 50): Observable<{ items: readonly PaymentConcept[]; total: number }> {
		return this.api
			.get<ApiResponse<{ content: PaymentConcept[]; totalElements: number }>>(
				API.PAYMENTS.ADMIN.CONCEPTS.ROOT,
				{ params: { page, size } },
			)
			.pipe(map((env) => ({
				items: env.data?.content ?? [],
				total: env.data?.totalElements ?? 0,
			})));
	}

	create(req: PaymentConceptRequest): Observable<PaymentConcept> {
		return this.api
			.post<ApiResponse<PaymentConcept>, PaymentConceptRequest>(
				API.PAYMENTS.ADMIN.CONCEPTS.ROOT,
				req,
			)
			.pipe(map((env) => env.data));
	}

	update(publicUuid: string, req: PaymentConceptRequest): Observable<PaymentConcept> {
		return this.api
			.patch<ApiResponse<PaymentConcept>, PaymentConceptRequest>(
				API.PAYMENTS.ADMIN.CONCEPTS.BY_ID(publicUuid),
				req,
			)
			.pipe(map((env) => env.data));
	}

	softDelete(publicUuid: string): Observable<void> {
		return this.api
			.delete<ApiResponse<unknown>>(API.PAYMENTS.ADMIN.CONCEPTS.BY_ID(publicUuid))
			.pipe(map(() => undefined));
	}
}