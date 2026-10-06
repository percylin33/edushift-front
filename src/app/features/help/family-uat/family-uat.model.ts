import type { RoleKey } from '../models/qa.model';

export type FamilyUatBlockKind = 'smoke' | 'happy' | 'reactive' | 'negative';

export interface FamilyUatStep {
  id: string;
  title: string;
  /** Qué hacer — lenguaje cotidiano. */
  do: string;
  /** Cómo saber que salió bien. */
  verify: string;
  /** A quién avisar por WhatsApp (opcional). */
  notify?: string;
  /** Ruta interna de la app. */
  route?: string;
  /** Texto del botón/enlace (si no, “Abrir esta pantalla”). */
  routeLabel?: string;
  /** Nota extra (por ejemplo: “esto es normal, no es un error”). */
  note?: string;
}

export interface FamilyUatBlock {
  kind: FamilyUatBlockKind;
  title: string;
  steps: readonly FamilyUatStep[];
}

export interface FamilyUatRoleScript {
  roleKey: RoleKey;
  /** Código corto: SA, TA, TE, ST, PA, SF */
  code: string;
  title: string;
  subtitle: string;
  bugRoleLabel: string;
  blocks: readonly FamilyUatBlock[];
}

export interface FamilyUatLeadItem {
  id: string;
  title: string;
  detail: string;
}

export interface FamilyUatLeadGuide {
  title: string;
  subtitle: string;
  preflight: readonly FamilyUatLeadItem[];
  chain: readonly FamilyUatLeadItem[];
  success: readonly FamilyUatLeadItem[];
}

export const FAMILY_UAT_PROGRESS_STORAGE_KEY = 'edushift.family-uat.progress';

export interface FamilyUatProgress {
  completed: Record<string, true>;
}

/** Títulos visibles para la familia (sin jerga técnica). */
export const FAMILY_UAT_BLOCK_LABEL: Record<FamilyUatBlockKind, string> = {
  smoke: 'Parte 1 — Abrí cada pantalla del menú',
  happy: 'Parte 2 — Hacé tu trabajo del día',
  reactive: 'Parte 3 — Cuando alguien te avise',
  negative: 'Parte 4 — Cosas que NO deberías poder hacer',
};
