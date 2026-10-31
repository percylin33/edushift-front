import { HttpErrorResponse } from '@angular/common/http';

export function admissionError(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 403) return 'No tienes permiso para realizar esta operación.';
  if (error.status === 404) return 'El registro ya no está disponible en este colegio.';
  const body = error.error as {
    code?: string;
    errorCode?: string;
    error?: { code?: string };
  } | null;
  const code = body?.code ?? body?.errorCode ?? body?.error?.code ?? '';
  return (
    (
      {
        ADMISSION_CAPACITY_NOT_CONFIGURED:
          'Falta configurar el aforo de las secciones de este grado. Revisa Vacantes.',
        ADMISSION_NO_VACANCY:
          'No quedan vacantes para este grado. Puedes enviar la solicitud a lista de espera.',
        ADMISSION_APPLICANT_ALREADY_EXISTS:
          'Ya existe una solicitud con este documento para el año seleccionado. Búscala en Solicitudes.',
        ADMISSION_APPLICATION_EXISTS: 'El estudiante ya tiene una solicitud para este año.',
        STUDENT_ALREADY_ENROLLED_FOR_YEAR:
          'El estudiante ya tiene una matrícula activa para este año.',
        ADMISSION_YEAR_CLOSED: 'El año académico está cerrado. Elige un año abierto.',
        ADMISSION_INVALID_TRANSITION:
          'El estado cambió o esta acción ya no está disponible. Actualiza el expediente.',
        ADMISSION_REASON_REQUIRED: 'Indica el motivo de la decisión.',
        ADMISSION_APPLICANT_DATA_INCOMPLETE:
          'Completa los datos del expediente antes de matricular.',
        ADMISSION_SECTION_MISMATCH: 'La sección debe corresponder al año y grado de la solicitud.',
        ADMISSION_EDIT_NOT_ALLOWED:
          'Solo se pueden corregir solicitudes abiertas sin ficha de estudiante vinculada.',
      } as Record<string, string>
    )[code] ?? fallback
  );
}
