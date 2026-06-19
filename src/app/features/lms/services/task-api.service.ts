import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse, SpringPage } from '@core/models';
import { ApiService } from '@core/services';
import {
  CreateTaskRequest,
  TaskDetail,
  TaskLifecycle,
  TaskResponseRaw,
  TaskRow,
  TaskSummaryRaw,
  UpdateTaskRequest,
  toTaskDetail,
  toTaskRow
} from '../models';

/**
 * HTTP boundary del módulo {@code lms.tasks} (FE-7a.1 / BE-7a.2).
 *
 * <h3>Endpoint coverage</h3>
 * <ul>
 *   <li>{@link #listBySection}      → {@code GET    /v1/lms/sections/{uuid}/assignments} (TEACHER)</li>
 *   <li>{@link #listByStudent}      → {@code GET    /v1/lms/students/{uuid}/assignments} (STUDENT/PARENT)</li>
 *   <li>{@link #getTask}            → {@code GET    /v1/lms/assignments/{uuid}}</li>
 *   <li>{@link #createTask}         → {@code POST   /v1/lms/assignments}</li>
 *   <li>{@link #updateTask}         → {@code PATCH  /v1/lms/assignments/{uuid}} (DRAFT o before dueAt)</li>
 *   <li>{@link #publishTask}        → {@code POST   /v1/lms/assignments/{uuid}/publish} (DRAFT → PUBLISHED)</li>
 *   <li>{@link #closeTask}          → {@code POST   /v1/lms/assignments/{uuid}/close} (PUBLISHED → CLOSED)</li>
 * </ul>
 *
 * <p>Endpoints de Submissions / Materials viven en
 * {@link SubmissionApiService} y {@link MaterialApiService} (FE-7a.2 /
 * FE-7a.3); este servicio se mantiene centrado en el CRUD del task.</p>
 *
 * <p>El backend devuelve siempre el envelope {@code ApiResponse<T>};
 * el adapter {@code toTaskRow} / {@code toTaskDetail} lo desenvuelve y
 * normaliza Jackson's {@code null → undefined} antes de llegar al
 * componente.</p>
 */
@Injectable({ providedIn: 'root' })
export class TaskApiService {
  private readonly api = inject(ApiService);

  /**
   * Lista paginada de tasks de una sección. Sólo el docente (TEACHER) o
   * el admin del tenant (TENANT_ADMIN) llega a este endpoint; un STUDENT
   * recibiría {@code 403} y el `errorInterceptor` lo traduce a un
   * banner.
   *
   * <p>Acepta filtros {@code ?lifecycle} y {@code ?dueBefore} para que
   * la UI pueda server-side filtrar por lifecycle y por "vence antes
   * de" sin paginar todo el curso.</p>
   */
  listBySection(
    sectionPublicUuid: string,
    filters: { lifecycle?: TaskLifecycle; dueBefore?: string } = {}
  ): Observable<TaskRow[]> {
    return this.api
      .get<SpringPage<TaskSummaryRaw>>(
        API.LMS.ASSIGNMENTS_BY_SECTION(sectionPublicUuid),
        {
          lifecycle: filters.lifecycle,
          dueBefore: filters.dueBefore
        }
      )
      .pipe(map((page) => page.content.map(toTaskRow)));
  }

  /**
   * Lista paginada de "mis tareas" para STUDENT/PARENT. El backend ya
   * filtra por {@code lifecycle=PUBLISHED} y por enrollment activo.
   */
  listByStudent(studentPublicUuid: string): Observable<TaskRow[]> {
    return this.api
      .get<SpringPage<TaskSummaryRaw>>(
        API.LMS.ASSIGNMENTS_BY_STUDENT(studentPublicUuid)
      )
      .pipe(map((page) => page.content.map(toTaskRow)));
  }

  /** Detail completo. */
  getTask(publicUuid: string): Observable<TaskDetail> {
    return this.api
      .get<ApiResponse<TaskResponseRaw>>(API.LMS.ASSIGNMENT_BY_UUID(publicUuid))
      .pipe(map((envelope) => toTaskDetail(envelope.data)));
  }

  /**
   * Crea un task en lifecycle {@code DRAFT}. La fecha de entrega llega
   * como ISO-8601 (`YYYY-MM-DDTHH:mm:ssZ`); el caller es responsable
   * de pasarla en UTC.
   */
  createTask(request: CreateTaskRequest): Observable<TaskDetail> {
    return this.api
      .post<ApiResponse<TaskResponseRaw>, CreateTaskRequest>(
        API.LMS.ASSIGNMENTS_ROOT,
        request
      )
      .pipe(map((envelope) => toTaskDetail(envelope.data)));
  }

  /**
   * Edita un task. El backend rechaza con {@code 409} si la lifecycle
   * es {@code CLOSED} o si es {@code PUBLISHED} y ya pasó
   * {@code dueAt}. Esos códigos se mapean en el store a errores
   * inline en el form.
   */
  updateTask(
    publicUuid: string,
    patch: UpdateTaskRequest
  ): Observable<TaskDetail> {
    return this.api
      .patch<ApiResponse<TaskResponseRaw>, UpdateTaskRequest>(
        API.LMS.ASSIGNMENT_PATCH(publicUuid),
        patch
      )
      .pipe(map((envelope) => toTaskDetail(envelope.data)));
  }

  /**
   * DRAFT → PUBLISHED. El backend puede responder 409 si falta
   * {@code dueAt} (un DRAFT sin fecha no puede publicarse); el store
   * propaga ese código como error inline.
   */
  publishTask(publicUuid: string): Observable<TaskDetail> {
    return this.api
      .post<ApiResponse<TaskResponseRaw>>(
        API.LMS.ASSIGNMENT_PUBLISH(publicUuid)
      )
      .pipe(map((envelope) => toTaskDetail(envelope.data)));
  }

  /**
   * PUBLISHED → CLOSED. Idempotente en backend: si ya está CLOSED
   * retorna 200 con el mismo payload.
   */
  closeTask(publicUuid: string): Observable<TaskDetail> {
    return this.api
      .post<ApiResponse<TaskResponseRaw>>(
        API.LMS.ASSIGNMENT_CLOSE(publicUuid)
      )
      .pipe(map((envelope) => toTaskDetail(envelope.data)));
  }
}
