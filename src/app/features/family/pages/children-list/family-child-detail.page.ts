import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-family-child-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <a routerLink="/family" class="text-sm font-semibold text-indigo-600">← Volver a mis hijos</a>
      <header class="mt-6">
        <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">Familia</p>
        <h1 class="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
          Resumen del estudiante
        </h1>
      </header>
      <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <a
          [routerLink]="['attendance']"
          class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <h2 class="font-semibold">Asistencia</h2>
          <p class="mt-2 text-sm text-slate-500">Revisar faltas y justificar.</p>
        </a>
        <a
          [routerLink]="['grades']"
          class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <h2 class="font-semibold">Calificaciones</h2>
          <p class="mt-2 text-sm text-slate-500">Ver el progreso académico.</p>
        </a>
        <a
          [routerLink]="['schedule']"
          class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <h2 class="font-semibold">Horario</h2>
          <p class="mt-2 text-sm text-slate-500">Semana de clases del hijo.</p>
        </a>
        <a
          [routerLink]="['activities']"
          class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <h2 class="font-semibold">Actividades</h2>
          <p class="mt-2 text-sm text-slate-500">Tareas (puedes entregar) y quizzes.</p>
        </a>
        <a
          [routerLink]="['payments']"
          class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <h2 class="font-semibold">Pagos</h2>
          <p class="mt-2 text-sm text-slate-500">Cuotas, pagar y comprobante.</p>
        </a>
      </div>
    </section>
  `,
})
export class FamilyChildDetailPageComponent {}
