import { TestBed } from '@angular/core/testing';
import { NavLabels } from './nav-labels.service';

describe('NavLabels', () => {
  let labels: NavLabels;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    labels = TestBed.inject(NavLabels);
  });

  it('translates group ids', () => {
    expect(labels.labelFor('workspace')).toBe('Institución');
    expect(labels.labelFor('academic')).toBe('Académico');
    expect(labels.labelFor('lms')).toBe('Aula virtual');
    expect(labels.labelFor('attendance')).toBe('Asistencia');
    expect(labels.labelFor('payments')).toBe('Pagos');
    expect(labels.labelFor('system')).toBe('Sistema');
  });

  it('translates nav item ids', () => {
    expect(labels.labelFor('dashboard')).toBe('Panel');
    expect(labels.labelFor('students')).toBe('Estudiantes');
    expect(labels.labelFor('teachers')).toBe('Docentes');
    expect(labels.labelFor('courses')).toBe('Cursos');
    expect(labels.labelFor('years')).toBe('Años académicos');
    expect(labels.labelFor('levels')).toBe('Niveles y grados');
    expect(labels.labelFor('sections')).toBe('Secciones');
    expect(labels.labelFor('sessions')).toBe('Sesiones de clase');
    expect(labels.labelFor('schedule')).toBe('Horarios');
    expect(labels.labelFor('schedule-jornada')).toBe('Jornada y recreos');
    expect(labels.labelFor('schedule-workload')).toBe('Carga docente');
    expect(labels.labelFor('evaluations')).toBe('Registros');
    expect(labels.labelFor('family')).toBe('Mis hijos');
    expect(labels.labelFor('me')).toBe('Mi espacio');
    expect(labels.labelFor('me-schedule')).toBe('Mi horario');
    expect(labels.labelFor('users')).toBe('Usuarios');
    expect(labels.labelFor('settings')).toBe('Configuración');
  });

  it('honors legacy aliases', () => {
    expect(labels.labelFor('analytics')).toBe('Análisis');
    expect(labels.labelFor('insights')).toBe('Análisis');
    expect(labels.labelFor('periods')).toBe('Periodos');
    expect(labels.labelFor('academic-periods')).toBe('Periodos');
    expect(labels.labelFor('academic-years')).toBe('Años académicos');
    expect(labels.labelFor('academic-grade-register')).toBe('Registro de notas');
    expect(labels.labelFor('grade-register')).toBe('Registro de notas');
    expect(labels.labelFor('reconciliation')).toBe('Conciliación');
    expect(labels.labelFor('payments-admin')).toBe('Conciliación');
    expect(labels.labelFor('payments-emit')).toBe('Emitir cuotas');
    expect(labels.labelFor('payments-concepts')).toBe('Conceptos');
    expect(labels.labelFor('payments-plans')).toBe('Planes automáticos');
    expect(labels.labelFor('payments-policy')).toBe('Política de cobro');
    expect(labels.labelFor('payments-methods')).toBe('Métodos de pago');
  });

  it('returns the id itself for unknown keys', () => {
    expect(labels.labelFor('not-a-real-key')).toBe('not-a-real-key');
  });
});
