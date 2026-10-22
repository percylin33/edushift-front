import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AdmissionsApiService } from '../services/admissions-api.service';
import {
  AdmissionApplicationDetail,
  AdmissionDetailDecision,
  AdmissionStatus,
  GradeVacancy,
} from '../models';

@Component({
  selector: 'app-admission-detail-panel',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admission-detail-panel.component.html',
})
export class AdmissionDetailPanelComponent implements AfterViewInit {
  private readonly api = inject(AdmissionsApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly applicationUuid = input.required<string>();
  readonly reload = input(0);
  readonly canDecide = input(false);
  readonly canManage = input(false);
  readonly vacancy = input<GradeVacancy | null>(null);
  readonly linkEnrollment = output<AdmissionApplicationDetail['application']>();
  readonly canEnroll = input(false);
  readonly busy = input(false);
  readonly loaded = output<AdmissionApplicationDetail>();
  readonly closed = output<void>();
  readonly decision = output<AdmissionDetailDecision>();
  readonly enroll = output<AdmissionApplicationDetail['application']>();
  readonly detailSignal = signal<AdmissionApplicationDetail | null>(null);
  readonly loadingSignal = signal(false);
  readonly errorSignal = signal<string | null>(null);
  readonly retrySignal = signal(0);
  readonly increment = (value: number): number => value + 1;
  constructor() {
    effect((onCleanup) => {
      const uuid = this.applicationUuid();
      this.reload();
      this.retrySignal();
      this.detailSignal.set(null);
      this.errorSignal.set(null);
      this.loadingSignal.set(true);
      const subscription = this.api.detail(uuid).subscribe({
        next: (response) => {
          this.detailSignal.set(response.data);
          this.loadingSignal.set(false);
          this.loaded.emit(response.data);
        },
        error: (error: HttpErrorResponse) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(
            error.status === 404
              ? 'La solicitud no está disponible en este colegio.'
              : error.status === 403
                ? 'No tienes permiso para consultar este expediente.'
                : 'No se pudo cargar el expediente. Intenta nuevamente.',
          );
        },
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }
  ngAfterViewInit(): void {
    this.host.nativeElement.querySelector<HTMLElement>('h2')?.focus();
  }
  choose(status: AdmissionStatus): void {
    const detail = this.detailSignal();
    if (detail && !this.busy() && this.canDecide())
      this.decision.emit({ application: detail.application, status });
  }
  nextStep(status: AdmissionStatus): string {
    return (
      {
        RECEIVED: 'Siguiente paso: iniciar la revisión del expediente',
        UNDER_REVIEW: 'Siguiente paso: revisar los datos y registrar una decisión',
        WAITLISTED: 'Siguiente paso: revisar disponibilidad antes de admitir',
        ADMITTED: 'Siguiente paso: seleccionar sección y completar matrícula',
        ENROLLED: 'Proceso completado: estudiante matriculado',
        REJECTED: 'Solicitud cerrada por rechazo',
        WITHDRAWN: 'Solicitud retirada',
      } as Record<AdmissionStatus, string>
    )[status];
  }
  statusLabel(status: AdmissionStatus): string {
    return {
      RECEIVED: 'Recibida',
      UNDER_REVIEW: 'En revisión',
      ADMITTED: 'Admitida',
      WAITLISTED: 'Lista de espera',
      REJECTED: 'Rechazada',
      WITHDRAWN: 'Retirada',
      ENROLLED: 'Matriculada',
    }[status];
  }
  sourceLabel(source: AdmissionApplicationDetail['application']['source']): string {
    return {
      IN_PERSON: 'Presencial',
      REFERRAL: 'Recomendación',
      WEBSITE: 'Sitio web',
      OTHER: 'Otro',
    }[source];
  }
  genderLabel(gender: string | null): string {
    return (
      (
        {
          MALE: 'Masculino',
          FEMALE: 'Femenino',
          OTHER: 'Otro',
          NOT_SPECIFIED: 'Sin especificar',
        } as Record<string, string>
      )[gender ?? ''] ?? 'No registrado'
    );
  }
  relationshipLabel(value: string | null): string {
    return (
      (
        {
          MOTHER: 'Madre',
          FATHER: 'Padre',
          GRANDPARENT: 'Abuelo/a',
          GUARDIAN: 'Apoderado/a',
          OTHER: 'Otro',
        } as Record<string, string>
      )[value ?? ''] ?? 'No registrado'
    );
  }
}
