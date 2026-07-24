import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/services';
import { ApiResponse } from '@core/models';
import { API } from '@core/constants';

/**
 * Physical classroom (Sprint cierre-C / B4).
 *
 * <p>Mirrors the BE
 * {@code com.edushift.modules.academic.classrooms.entity.Classroom}.
 * The {@code type} enum is the same whitelist the BE CHECK constraint
 * enforces; {@code capacity} is nullable for classrooms the admin
 * hasn't quantified yet.</p>
 */
export interface Classroom {
	publicUuid: string;
	code: string;
	name: string;
	type: ClassroomType;
	capacity: number | null;
	location: string | null;
	description: string | null;
	createdAt: string;
	updatedAt: string;
}

export type ClassroomType =
	| 'CLASSROOM'
	| 'LAB'
	| 'GYM'
	| 'LIBRARY'
	| 'AUDITORIUM'
	| 'OUTDOOR'
	| 'OTHER';

export interface ClassroomRequest {
	code: string;
	name: string;
	type: ClassroomType;
	capacity: number | null;
	location: string | null;
	description: string | null;
}

/**
 * HTTP boundary for the classrooms catalog (cierre-C / B4).
 * Endpoints live under {@code /v1/academic/classrooms}; the BE enforces
 * {@code TENANT_ADMIN} for write paths.
 */
@Injectable({ providedIn: 'root' })
export class ClassroomsApiService {
	private readonly api = inject(ApiService);

	list(page = 0, size = 50): Observable<{ items: readonly Classroom[]; total: number }> {
		return this.api
			.get<ApiResponse<{ content: Classroom[]; totalElements: number }>>(
				API.ACADEMIC.CLASSROOMS.ROOT,
				{ params: { page, size } },
			)
			.pipe(map((env) => ({
				items: env.data?.content ?? [],
				total: env.data?.totalElements ?? 0,
			})));
	}

	create(req: ClassroomRequest): Observable<Classroom> {
		return this.api
			.post<ApiResponse<Classroom>, ClassroomRequest>(
				API.ACADEMIC.CLASSROOMS.ROOT,
				req,
			)
			.pipe(map((env) => env.data));
	}

	update(publicUuid: string, req: ClassroomRequest): Observable<Classroom> {
		return this.api
			.put<ApiResponse<Classroom>, ClassroomRequest>(
				API.ACADEMIC.CLASSROOMS.BY_ID(publicUuid),
				req,
			)
			.pipe(map((env) => env.data));
	}

	softDelete(publicUuid: string): Observable<void> {
		return this.api
			.delete<ApiResponse<unknown>>(API.ACADEMIC.CLASSROOMS.BY_ID(publicUuid))
			.pipe(map(() => undefined));
	}
}