/**
 * Tipos públicos del {@link GradeDialogComponent}. Aislados del
 * componente para que las pages y los tests no tengan que importar
 * la clase completa (y para evitar ciclos en el barrel).
 */

export type GradeMode = 'Grade' | 'Return';

export interface GradeSubmissionRequest {
  grade: number;
  feedback: string | null;
}
