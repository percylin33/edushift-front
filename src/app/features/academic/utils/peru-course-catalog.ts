/**
 * Catálogo estático de cursos usuales en colegios peruanos (CN MINEDU).
 * Los {@code levelCodes} se resuelven contra los levels del tenant por
 * {@code AcademicLevel.code} al momento de crear.
 */
export interface PeruCourseCatalogItem {
  code: string;
  name: string;
  /** Codes de nivel sugeridos (INICIAL / PRIMARIA / SECUNDARIA). */
  levelCodes: readonly string[];
}

export const PERU_COURSE_CATALOG: readonly PeruCourseCatalogItem[] = [
  { code: 'COMU', name: 'Comunicación', levelCodes: ['INICIAL', 'PRIMARIA', 'SECUNDARIA'] },
  { code: 'MAT', name: 'Matemática', levelCodes: ['INICIAL', 'PRIMARIA', 'SECUNDARIA'] },
  { code: 'PS', name: 'Personal Social', levelCodes: ['INICIAL', 'PRIMARIA'] },
  { code: 'CYT', name: 'Ciencia y Tecnología', levelCodes: ['PRIMARIA', 'SECUNDARIA'] },
  { code: 'AC', name: 'Arte y Cultura', levelCodes: ['INICIAL', 'PRIMARIA', 'SECUNDARIA'] },
  { code: 'EF', name: 'Educación Física', levelCodes: ['PRIMARIA', 'SECUNDARIA'] },
  { code: 'ER', name: 'Educación Religiosa', levelCodes: ['INICIAL', 'PRIMARIA', 'SECUNDARIA'] },
  { code: 'ING', name: 'Inglés', levelCodes: ['PRIMARIA', 'SECUNDARIA'] },
  { code: 'CCSS', name: 'Ciencias Sociales', levelCodes: ['SECUNDARIA'] },
  {
    code: 'DPCC',
    name: 'Desarrollo Personal, Ciudadanía y Cívica',
    levelCodes: ['SECUNDARIA'],
  },
  { code: 'EPT', name: 'Educación para el Trabajo', levelCodes: ['SECUNDARIA'] },
  { code: 'COMP', name: 'Computación', levelCodes: ['PRIMARIA', 'SECUNDARIA'] },
  { code: 'PSI', name: 'Psicomotricidad', levelCodes: ['INICIAL'] },
  { code: 'TUT', name: 'Tutoría', levelCodes: ['PRIMARIA', 'SECUNDARIA'] },
] as const;
