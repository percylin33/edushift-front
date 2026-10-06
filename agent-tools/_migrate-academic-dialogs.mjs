import fs from 'fs';

const root = 'edushift-front/src/app/features/academic';

function read(p) {
  return fs.readFileSync(p, 'utf8');
}
function write(p, s) {
  fs.writeFileSync(p, s, 'utf8');
  console.log('OK', p);
}
function mustInclude(s, needle, label) {
  if (!s.includes(needle)) throw new Error(`Missing after patch [${label}]: ${needle}`);
}

// ---------- periods-list ----------
{
  const p = `${root}/pages/periods-list/periods-list.component.ts`;
  let s = read(p);
  if (!s.includes('ConfirmDialogService')) {
    s = s.replace(
      "import { EmptyStateComponent, IconComponent, SpinnerComponent } from '@shared/components';",
      `import { NotificationService } from '@core/services';
import {
  ConfirmDialogService,
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent,
} from '@shared/components';`,
    );
  }
  if (!s.includes('confirmDialog = inject')) {
    s = s.replace(
      `export class PeriodsListComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);`,
      `export class PeriodsListComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly notifications = inject(NotificationService);`,
    );
  }
  s = s.replace(
    /protected async confirmDelete\(row: AcademicPeriodRow\): Promise<void> \{[\s\S]*?await this\.store\.deletePeriod\(row\.publicUuid\);\r?\n  \}/,
    `protected async confirmDelete(row: AcademicPeriodRow): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Eliminar periodo',
      message:
        \`¿Eliminar el periodo "\${row.name}"?\\n\\n\` +
        'Solo se puede borrar el último ordinal del par (año, tipo). Si\\n' +
        'querés renumerar, borrá de mayor a menor y recreá los que falten.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;
    await this.store.deletePeriod(row.publicUuid);
  }`,
  );
  s = s.replace(
    /const ok = confirm\(header \+ lines\.join\('\\n'\)\);\r?\n    if \(!ok\) return;/,
    `const ok = await this.confirmDialog.open({
      title: 'Generar periodos',
      message: header + lines.join('\\n'),
      confirmLabel: 'Crear',
      variant: existingSameType > 0 ? 'warning' : 'default',
    });
    if (!ok) return;`,
  );
  s = s.replace(
    /alert\(\r?\n\s*`Se crearon \$\{result\.failedAt - 1\} periodo\(s\) y luego falló\.\\n` \+\r?\n\s*'Revisa el banner de error y reintenta el resto manualmente\.',\r?\n\s*\);/,
    `this.notifications.error(
        \`Se crearon \${result.failedAt - 1} periodo(s) y luego falló.\\n\` +
          'Revisa el banner de error y reintenta el resto manualmente.',
      );`,
  );
  mustInclude(s, 'confirmDialog.open', 'periods confirm');
  mustInclude(s, 'notifications.error', 'periods alert');
  if (/\balert\(/.test(s) || /(?<!DialogService\.)\bconfirm\(/.test(s)) {
    // allow method names like confirmDelete
  }
  write(p, s);
}

// ---------- years-list ----------
{
  const p = `${root}/pages/years-list/years-list.component.ts`;
  let s = read(p);
  if (!s.includes('ConfirmDialogService')) {
    s = s.replace(
      "import { EmptyStateComponent, IconComponent, SpinnerComponent } from '@shared/components';",
      `import {
  ConfirmDialogService,
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent,
} from '@shared/components';`,
    );
  }
  if (!s.includes('confirmDialog = inject')) {
    s = s.replace(
      `export class YearsListComponent implements OnInit {
  private readonly store = inject(AcademicStore);`,
      `export class YearsListComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly confirmDialog = inject(ConfirmDialogService);`,
    );
  }
  s = s.replace(
    /protected async activate\(year: AcademicYearRow\): Promise<void> \{[\s\S]*?await this\.store\.activateYear\(year\.publicUuid\);\r?\n  \}/,
    `protected async activate(year: AcademicYearRow): Promise<void> {
    const current = this.currentActive();
    if (current && current.publicUuid !== year.publicUuid) {
      const ok = await this.confirmDialog.open({
        title: 'Activar año académico',
        message: \`Activar "\${year.name}" cerrará automáticamente el año activo "\${current.name}".\\n\\n¿Continuar?\`,
        confirmLabel: 'Activar',
        variant: 'warning',
      });
      if (!ok) return;
    }
    await this.store.activateYear(year.publicUuid);
  }`,
  );
  s = s.replace(
    /protected async confirmDelete\(year: AcademicYearRow\): Promise<void> \{[\s\S]*?await this\.store\.deleteYear\(year\.publicUuid\);\r?\n  \}/,
    `protected async confirmDelete(year: AcademicYearRow): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Eliminar año académico',
      message: \`¿Eliminar el año "\${year.name}"?\\n\\nEsta operación es reversible solo desde el backend.\`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;
    await this.store.deleteYear(year.publicUuid);
  }`,
  );
  write(p, s);
}

// ---------- session-templates-page ----------
{
  const p = `${root}/pages/session-templates-page/session-templates-page.component.ts`;
  let s = read(p);
  if (!s.includes('ConfirmDialogService')) {
    s = s.replace(
      `import {
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent,
} from '@shared/components';`,
      `import {
  ConfirmDialogService,
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent,
} from '@shared/components';`,
    );
  }
  if (!s.includes('confirmDialog = inject')) {
    s = s.replace(
      `export class SessionTemplatesPageComponent implements OnInit {
  private readonly api = inject(SessionTemplatesApiService);`,
      `export class SessionTemplatesPageComponent implements OnInit {
  private readonly api = inject(SessionTemplatesApiService);
  private readonly confirmDialog = inject(ConfirmDialogService);`,
    );
  }
  s = s.replace(
    /async remove\(t: SessionTemplateListItem\): Promise<void> \{\r?\n    if \(!confirm\(`¿Eliminar la plantilla «\$\{t\.name\}»\?`\)\) return;/,
    `async remove(t: SessionTemplateListItem): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Eliminar plantilla',
      message: \`¿Eliminar la plantilla «\${t.name}»?\`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;`,
  );
  write(p, s);
}

// ---------- sections-list ----------
{
  const p = `${root}/pages/sections-list/sections-list.component.ts`;
  let s = read(p);
  if (!s.includes('ConfirmDialogService')) {
    s = s.replace(
      "import { EmptyStateComponent, IconComponent, SpinnerComponent } from '@shared/components';",
      `import {
  ConfirmDialogService,
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent,
} from '@shared/components';`,
    );
  }
  if (!s.includes('confirmDialog = inject')) {
    s = s.replace(
      `export class SectionsListComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);`,
      `export class SectionsListComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmDialog = inject(ConfirmDialogService);`,
    );
  }
  s = s.replace(
    /protected async confirmDelete\(row: SectionRow\): Promise<void> \{[\s\S]*?await this\.store\.deleteSection\(row\.publicUuid\);\r?\n  \}/,
    `protected async confirmDelete(row: SectionRow): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Eliminar sección',
      message:
        \`¿Eliminar la sección "\${row.gradeName} \${row.name}" del año "\${row.academicYearName}"?\\n\\n\` +
        'Esta operación es reversible solo desde el backend.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;
    await this.store.deleteSection(row.publicUuid);
  }`,
  );
  write(p, s);
}

// ---------- section-detail ----------
{
  const p = `${root}/pages/section-detail/section-detail.component.ts`;
  let s = read(p);
  if (!s.includes('ConfirmDialogService')) {
    s = s.replace(
      `import {
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';`,
      `import {
  ConfirmDialogService,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';`,
    );
  }
  if (!s.includes('confirmDialog = inject')) {
    s = s.replace(
      `export class SectionDetailComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);`,
      `export class SectionDetailComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmDialog = inject(ConfirmDialogService);`,
    );
  }
  s = s.replace(
    /protected async confirmDelete\(\): Promise<void> \{[\s\S]*?void this\.router\.navigate\(\[this\.listRoute\]\);\r?\n    \}\r?\n  \}/,
    `protected async confirmDelete(): Promise<void> {
    const sec = this.section();
    if (!sec) return;
    const ok = await this.confirmDialog.open({
      title: 'Eliminar sección',
      message:
        \`¿Eliminar la sección "\${sec.gradeName} \${sec.name}" del año "\${sec.academicYearName}"?\\n\\n\` +
        'Esta operación es reversible solo desde el backend.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;
    const success = await this.store.deleteSection(sec.publicUuid);
    if (success) {
      void this.router.navigate([this.listRoute]);
    }
  }`,
  );
  write(p, s);
}

// ---------- courses-list ----------
{
  const p = `${root}/pages/courses-list/courses-list.component.ts`;
  let s = read(p);
  if (!s.includes('ConfirmDialogService')) {
    s = s.replace(
      "import { EmptyStateComponent, IconComponent, SpinnerComponent } from '@shared/components';",
      `import {
  ConfirmDialogService,
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent,
} from '@shared/components';`,
    );
  }
  if (!s.includes('confirmDialog = inject')) {
    s = s.replace(
      `export class CoursesListComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);`,
      `export class CoursesListComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmDialog = inject(ConfirmDialogService);`,
    );
  }
  s = s.replace(
    /protected async confirmDelete\(row: CourseRow\): Promise<void> \{[\s\S]*?await this\.store\.deleteCourse\(row\.publicUuid\);\r?\n  \}/,
    `protected async confirmDelete(row: CourseRow): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Eliminar curso',
      message:
        \`¿Eliminar el curso "\${row.code} — \${row.name}"?\\n\\n\` +
        'Esta operación es reversible solo desde el backend. Si el curso\\n' +
        'tiene asignaciones de docentes, considera desactivarlo en su lugar.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;
    await this.store.deleteCourse(row.publicUuid);
  }`,
  );
  write(p, s);
}

// ---------- course-detail ----------
{
  const p = `${root}/pages/course-detail/course-detail.component.ts`;
  let s = read(p);
  if (!s.includes('ConfirmDialogService')) {
    s = s.replace(
      `import {
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';`,
      `import {
  ConfirmDialogService,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';`,
    );
  }
  if (!s.includes('confirmDialog = inject')) {
    s = s.replace(
      `export class CourseDetailComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);`,
      `export class CourseDetailComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmDialog = inject(ConfirmDialogService);`,
    );
  }
  s = s.replace(
    /protected async confirmDelete\(\): Promise<void> \{[\s\S]*?void this\.router\.navigate\(\[this\.listRoute\]\);\r?\n    \}\r?\n  \}/,
    `protected async confirmDelete(): Promise<void> {
    const c = this.course();
    if (!c) return;
    const ok = await this.confirmDialog.open({
      title: 'Eliminar curso',
      message:
        \`¿Eliminar el curso "\${c.code} — \${c.name}"?\\n\\n\` +
        'Si el curso tiene asignaciones de docentes, considera ' +
        'desactivarlo en su lugar.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;
    const success = await this.store.deleteCourse(c.publicUuid);
    if (success) {
      void this.router.navigate([this.listRoute]);
    }
  }`,
  );
  write(p, s);
}

// ---------- time-slot-form-modal ----------
{
  const p = `${root}/components/time-slot-form-modal.component.ts`;
  let s = read(p);
  if (!s.includes('ConfirmDialogService')) {
    s = s.replace(
      "import { IconComponent, SpinnerComponent } from '@shared/components';",
      `import { ConfirmDialogService, IconComponent, SpinnerComponent } from '@shared/components';`,
    );
  }
  if (!s.includes('confirmDialog = inject')) {
    s = s.replace(
      `export class TimeSlotFormModalComponent implements OnInit {
  private readonly api = inject(AcademicApiService);
  private readonly fb = inject(FormBuilder);`,
      `export class TimeSlotFormModalComponent implements OnInit {
  private readonly api = inject(AcademicApiService);
  private readonly fb = inject(FormBuilder);
  private readonly confirmDialog = inject(ConfirmDialogService);`,
    );
  }
  s = s.replace(
    /const confirmed = confirm\(\r?\n\s*'¿Eliminar este bloque del horario semanal\? Se quitará en todos los bimestres del año\.',\r?\n\s*\);\r?\n    if \(!confirmed\) return;/,
    `const confirmed = await this.confirmDialog.open({
      title: 'Eliminar bloque',
      message:
        '¿Eliminar este bloque del horario semanal? Se quitará en todos los bimestres del año.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
      icon: 'trash',
    });
    if (!confirmed) return;`,
  );
  write(p, s);
}

// ---------- course-units-tab ----------
{
  const p = `${root}/components/course-units-tab.component.ts`;
  let s = read(p);
  if (!s.includes('ConfirmDialogService')) {
    s = s.replace(
      "import { EmptyStateComponent, IconComponent, SpinnerComponent } from '@shared/components';",
      `import {
  ConfirmDialogService,
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent,
} from '@shared/components';`,
    );
  }
  // remove DEBT-UX-1 note
  s = s.replace(
    /\r?\n \*   <li>El delete usa \{@code window\.confirm\} \(DEBT-UX-1, mismo\r?\n \*       patrón que levels-board y courses-list\)\.<\/li>/,
    '',
  );
  if (!s.includes('confirmDialog = inject')) {
    s = s.replace(
      `export class CourseUnitsTabComponent implements OnChanges {
  private readonly store = inject(UnitsStore);
  private readonly api = inject(AcademicApiService);`,
      `export class CourseUnitsTabComponent implements OnChanges {
  private readonly store = inject(UnitsStore);
  private readonly api = inject(AcademicApiService);
  private readonly confirmDialog = inject(ConfirmDialogService);`,
    );
  }
  s = s.replace(
    /protected async confirmDelete\(unit: UnitRow\): Promise<void> \{[\s\S]*?await this\.store\.deleteUnit\(unit\.publicUuid\);\r?\n  \}/,
    `protected async confirmDelete(unit: UnitRow): Promise<void> {
    const sessionWarn =
      unit.sessionCount > 0
        ? \`\\n\\nLa unidad tiene \${unit.sessionCount} sesión(es) viva(s); el backend devolverá UNIT_HAS_SESSIONS.\`
        : '';
    const ok = await this.confirmDialog.open({
      title: 'Eliminar unidad',
      message:
        \`¿Eliminar la unidad "\${unit.name}"?\\n\\n\` +
        'Esta operación es reversible solo desde el backend.' +
        sessionWarn,
      confirmLabel: 'Eliminar',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;
    await this.store.deleteUnit(unit.publicUuid);
  }`,
  );
  write(p, s);
}

// ---------- course-competencies-tab ----------
{
  const p = `${root}/components/course-competencies-tab.component.ts`;
  let s = read(p);
  if (!s.includes('ConfirmDialogService')) {
    s = s.replace(
      "import { EmptyStateComponent, IconComponent, SpinnerComponent } from '@shared/components';",
      `import {
  ConfirmDialogService,
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent,
} from '@shared/components';`,
    );
  }
  s = s.replace(
    /\r?\n \*   <li>El delete usa \{@code window\.confirm\} \(mismo patrón que units\)\.<\/li>/,
    '',
  );
  if (!s.includes('confirmDialog = inject')) {
    s = s.replace(
      `export class CourseCompetenciesTabComponent implements OnChanges {
  private readonly store = inject(CompetenciesStore);
  private readonly api = inject(AcademicApiService);`,
      `export class CourseCompetenciesTabComponent implements OnChanges {
  private readonly store = inject(CompetenciesStore);
  private readonly api = inject(AcademicApiService);
  private readonly confirmDialog = inject(ConfirmDialogService);`,
    );
  }
  s = s.replace(
    /protected async confirmDeleteCompetency\(comp: CompetencyRow\): Promise<void> \{[\s\S]*?await this\.store\.deleteCompetency\(comp\.publicUuid\);\r?\n  \}/,
    `protected async confirmDeleteCompetency(comp: CompetencyRow): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Eliminar competencia',
      message:
        \`¿Eliminar la competencia "\${comp.name}"?\\n\\n\` +
        'Esta operación es reversible solo desde el backend. ' +
        'Si tiene sesiones asociadas, el backend devolverá COMPETENCY_IN_USE_BY_SESSIONS.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;
    await this.store.deleteCompetency(comp.publicUuid);
  }`,
  );
  s = s.replace(
    /protected async confirmDeleteCapacity\(\r?\n    competencyUuid: string,\r?\n    capacityUuid: string,\r?\n  \): Promise<void> \{[\s\S]*?await this\.store\.deleteCapacity\(capacityUuid, competencyUuid\);\r?\n  \}/,
    `protected async confirmDeleteCapacity(
    competencyUuid: string,
    capacityUuid: string,
  ): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Eliminar capacidad',
      message:
        '¿Eliminar esta capacidad?\\n\\n' +
        'Si tiene sesiones asociadas, el backend devolverá CAPACITY_IN_USE_BY_SESSIONS.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;
    await this.store.deleteCapacity(capacityUuid, competencyUuid);
  }`,
  );
  write(p, s);
}

// ---------- grade-register-page ----------
{
  const p = `${root}/pages/grade-register-page/grade-register-page.component.ts`;
  let s = read(p);
  if (!s.includes('ConfirmDialogService')) {
    s = s.replace(
      `import {
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent,
} from '@shared/components';`,
      `import {
  ConfirmDialogService,
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent,
} from '@shared/components';`,
    );
  }
  if (!s.includes('confirmDialog = inject')) {
    s = s.replace(
      `export class GradeRegisterPageComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly api = inject(GradeRegisterApiService);`,
      `export class GradeRegisterPageComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly api = inject(GradeRegisterApiService);
  private readonly confirmDialog = inject(ConfirmDialogService);`,
    );
  }
  s = s.replace(
    /protected async adoptOrReplace\(t: GradeRegisterTemplateListItem\): Promise<void> \{[\s\S]*?await this\.adopt\(t, replace\);\r?\n  \}/,
    `protected async adoptOrReplace(t: GradeRegisterTemplateListItem): Promise<void> {
    const replace = this.hasActiveTemplate();
    if (replace) {
      const ok = await this.confirmDialog.open({
        title: 'Cambiar plantilla activa',
        message:
          \`¿Cambiar la plantilla activa por «\${t.name}»?\\n\\n\` +
          'La plantilla actual se archivará. Si ya hay evaluaciones o notas ligadas, el cambio puede rechazarse.',
        confirmLabel: 'Cambiar',
        variant: 'warning',
      });
      if (!ok) return;
    }
    await this.adopt(t, replace);
  }`,
  );
  s = s.replace(
    /protected async deleteCategory\(c: GradeCategory\): Promise<void> \{\r?\n    if \(!confirm\(`¿Eliminar la categoría «\$\{c\.name\}»\?`\)\) return;/,
    `protected async deleteCategory(c: GradeCategory): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Eliminar categoría',
      message: \`¿Eliminar la categoría «\${c.name}»?\`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;`,
  );
  write(p, s);
}

console.log('All migrations applied.');
