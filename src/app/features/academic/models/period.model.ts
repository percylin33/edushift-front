// =============================================================================
// Enum
// =============================================================================

/**
 * Espejo de {@code com.edushift.modules.academic.period.entity.PeriodType}.
 *
 * <p>El backend usa el nombre del enum (ej. {@code "BIMESTRE"}) como
 * representación serializada; el {@code displayLabel} es solo para
 * el {@code name} auto-generado del periodo.</p>
 */
export enum PeriodType {
  Bimestre  = 'BIMESTRE',
  Trimestre = 'TRIMESTRE',
  Anual     = 'ANUAL'
}

/** Cuántos periodos divide cada {@link PeriodType} en el bulk-generator. */
export const PERIOD_TYPE_DIVISIONS: Readonly<Record<PeriodType, number>> = {
  [PeriodType.Bimestre]:  4,
  [PeriodType.Trimestre]: 3,
  [PeriodType.Anual]:     1
};

/** Label en español para el dropdown del form y la UI. */
export const PERIOD_TYPE_LABELS: Readonly<Record<PeriodType, string>> = {
  [PeriodType.Bimestre]:  'Bimestre',
  [PeriodType.Trimestre]: 'Trimestre',
  [PeriodType.Anual]:     'Anual'
};

// =============================================================================
// Raw wire shapes — espejo 1:1 del backend (BE-4.5)
// =============================================================================

/**
 * RAW backend {@code AcademicPeriodListItem}.
 * {@code startDate} y {@code endDate} llegan como {@code yyyy-MM-dd}
 * (Spring serializa {@code LocalDate} con {@code ISO_LOCAL_DATE}).
 */
export interface AcademicPeriodListItemRaw {
  publicUuid: string;
  academicYearPublicUuid: string;
  periodType: PeriodType;
  ordinal: number;
  name: string;
  startDate: string;
  endDate: string;
}

/** RAW backend {@code AcademicPeriodResponse}. Superset con audit + año name. */
export interface AcademicPeriodResponseRaw {
  publicUuid: string;
  academicYearPublicUuid: string;
  academicYearName: string;
  periodType: PeriodType;
  ordinal: number;
  name: string;
  startDate: string;
  endDate: string;
  createdAt: string | null;
  updatedAt: string | null;
}

// =============================================================================
// UI shapes
// =============================================================================

/** UI-side row para tabla y timeline. */
export interface AcademicPeriodRow {
  publicUuid: string;
  academicYearPublicUuid: string;
  periodType: PeriodType;
  ordinal: number;
  name: string;
  startDate: Date;
  endDate: Date;
}

/** UI-side detail con audit + label del año. */
export interface AcademicPeriodDetail extends AcademicPeriodRow {
  academicYearName: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// =============================================================================
// Request shapes
// =============================================================================

/**
 * Body de {@code POST /v1/academic/periods}.
 *
 * <h3>Validación BE (orden)</h3>
 * <ol>
 *   <li>{@code ACADEMIC_YEAR_LOCKED} — año {@code CLOSED}.</li>
 *   <li>{@code PERIOD_DATE_INVERTED} — {@code startDate >= endDate}.</li>
 *   <li>{@code PERIOD_OUT_OF_YEAR_RANGE} — fuera del rango del año.</li>
 *   <li>{@code PERIOD_ORDINAL_TAKEN} | {@code PERIOD_ORDINAL_GAP}.</li>
 *   <li>{@code PERIOD_DATE_OVERLAP} — solapa con otro {@code (year, type)}.</li>
 * </ol>
 *
 * <p>Si se omite {@code name}, el BE lo genera como
 * {@code "<roman_ordinal> <PeriodType.displayLabel>"} (ej. ordinal=2,
 * type=BIMESTRE → {@code "II Bimestre"}).</p>
 */
export interface CreateAcademicPeriodRequest {
  academicYearPublicUuid: string;
  periodType: PeriodType;
  ordinal: number;
  /** Opcional. Si se omite el BE lo auto-genera. */
  name?: string;
  /** {@code yyyy-MM-dd}. */
  startDate: string;
  /** {@code yyyy-MM-dd}. */
  endDate: string;
}

/**
 * Body de {@code PUT /v1/academic/periods/{publicUuid}}.
 *
 * <p>Partial-merge sobre {@code name}, {@code startDate} y
 * {@code endDate}. La triple {@code (year, type, ordinal)} es
 * inmutable — para renumerar hay que delete & re-create.</p>
 */
export interface UpdateAcademicPeriodRequest {
  name?: string;
  /** {@code yyyy-MM-dd}. */
  startDate?: string;
  /** {@code yyyy-MM-dd}. */
  endDate?: string;
}

/** Filtros para {@code GET /v1/academic/periods}. */
export interface AcademicPeriodListFilters {
  academicYearPublicUuid?: string;
  periodType?: PeriodType;
}

// =============================================================================
// Helpers de validación local + overlap detection
// =============================================================================

/** {@code true} sii {@code start < end} (espejo de {@code PERIOD_DATE_INVERTED}). */
export function isDateRangeValid(start: Date, end: Date): boolean {
  return start.getTime() < end.getTime();
}

/**
 * {@code true} sii {@code start >= yearStart && end <= yearEnd}
 * (espejo de {@code PERIOD_OUT_OF_YEAR_RANGE}). Compara <em>fechas</em>
 * (sin componente de hora), igual que el BE.
 */
export function isWithinYear(
  start: Date,
  end: Date,
  yearStart: Date,
  yearEnd: Date
): boolean {
  return (
    start.getTime() >= yearStart.getTime() &&
    end.getTime() <= yearEnd.getTime()
  );
}

/**
 * Detecta overlap con un periodo existente. Dos rangos se solapan si
 * {@code aStart <= bEnd && aEnd >= bStart} (cierre cerrado-cerrado,
 * mismo criterio que el BE).
 */
export function periodsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return (
    aStart.getTime() <= bEnd.getTime() &&
    aEnd.getTime() >= bStart.getTime()
  );
}

/**
 * Filtra los periodos del mismo {@code (year, type)} que solapan con
 * el rango {@code [start, end]}, opcionalmente excluyendo el propio
 * (modo edit, donde el periodo se compara contra los demás). Útil
 * para resaltar el conflicto en el timeline antes del submit.
 */
export function findOverlappingPeriods(
  periods: AcademicPeriodRow[],
  yearUuid: string,
  type: PeriodType,
  start: Date,
  end: Date,
  excludePublicUuid?: string
): AcademicPeriodRow[] {
  return periods.filter((p) => {
    if (p.academicYearPublicUuid !== yearUuid) return false;
    if (p.periodType !== type) return false;
    if (excludePublicUuid && p.publicUuid === excludePublicUuid) return false;
    return periodsOverlap(start, end, p.startDate, p.endDate);
  });
}

// =============================================================================
// Roman numerals (para preview del bulk-generator y nombres auto)
// =============================================================================

const ROMAN: ReadonlyArray<string> = [
  '', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII'
];

/**
 * Convierte un ordinal {@code 1..12} a su numeral romano. Soporta el
 * rango realista de periodos (1..12 cubre TRIMESTRE × 4 años con
 * margen). Para valores fuera de rango devuelve el ordinal como
 * string para no romper la UI.
 */
export function toRoman(ordinal: number): string {
  if (ordinal >= 1 && ordinal < ROMAN.length) return ROMAN[ordinal];
  return String(ordinal);
}

/** Genera el {@code name} auto al estilo del backend ("II Bimestre"). */
export function defaultPeriodName(ordinal: number, type: PeriodType): string {
  return `${toRoman(ordinal)} ${PERIOD_TYPE_LABELS[type]}`;
}

// =============================================================================
// Bulk-generator de bimestres / trimestres
// =============================================================================

/**
 * Plan ya calculado (sin commitear) para "Generar bimestres
 * automáticos". El componente lo muestra como preview y el store
 * lo materializa con N POSTs secuenciales.
 */
export interface BulkPeriodPlan {
  periodType: PeriodType;
  yearStart: Date;
  yearEnd: Date;
  parts: ReadonlyArray<{
    ordinal: number;
    name: string;
    startDate: Date;
    endDate: Date;
  }>;
}

/**
 * Divide el rango del año en {@link PERIOD_TYPE_DIVISIONS}[type]
 * partes <em>aproximadamente</em> iguales. La última parte absorbe el
 * remainder en milisegundos para que la cobertura del año sea total
 * sin huecos.
 *
 * <p>Convención: las fechas son <em>locales</em> (sin tz) — el backend
 * trabaja con {@code LocalDate}. Se trunca a día (00:00 local).</p>
 */
export function planBulkPeriods(
  yearStart: Date,
  yearEnd: Date,
  type: PeriodType
): BulkPeriodPlan {
  const divisions = PERIOD_TYPE_DIVISIONS[type];
  const startMs = startOfDay(yearStart).getTime();
  const endMs   = startOfDay(yearEnd).getTime();
  const totalDays = Math.max(1, Math.round((endMs - startMs) / DAY_MS) + 1);

  const baseDays = Math.floor(totalDays / divisions);
  const extra    = totalDays - baseDays * divisions;

  const parts: BulkPeriodPlan['parts'] = Array.from({ length: divisions }, (_, i) => {
    const ordinal = i + 1;
    /* Distribuye el remainder en los primeros `extra` slots para que
     * el cubrimiento sea exacto. Sin esto, la última parte podría
     * salirse del rango si los días no dividen exactamente. */
    const offsetDays =
      i * baseDays + Math.min(i, extra);
    const lengthDays =
      baseDays + (i < extra ? 1 : 0);

    const start = new Date(startMs + offsetDays * DAY_MS);
    const end   = new Date(startMs + (offsetDays + lengthDays - 1) * DAY_MS);

    return {
      ordinal,
      name: defaultPeriodName(ordinal, type),
      startDate: start,
      endDate: end
    };
  });

  return {
    periodType: type,
    yearStart: startOfDay(yearStart),
    yearEnd: startOfDay(yearEnd),
    parts
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const out = new Date(d.getTime());
  out.setHours(0, 0, 0, 0);
  return out;
}

// =============================================================================
// Serialización LocalDate <-> Date
// =============================================================================

/** Formatea {@code Date} a {@code yyyy-MM-dd} (LocalDate-compatible). */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parsea un {@code yyyy-MM-dd} (LocalDate) a {@code Date} interpretado
 * como medianoche local. Sin {@code Date.parse} para evitar el bug de
 * tz en Safari (interpretaba ISO como UTC).
 */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map((s) => parseInt(s, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}
