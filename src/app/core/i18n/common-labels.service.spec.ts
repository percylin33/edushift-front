import { TestBed } from '@angular/core/testing';
import { CommonLabels } from './common-labels.service';

describe('CommonLabels', () => {
  let labels: CommonLabels;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    labels = TestBed.inject(CommonLabels);
  });

  it('exposes the 15 canonical action labels in es-PE', () => {
    expect(labels.guardar()).toBe('Guardar');
    expect(labels.cancelar()).toBe('Cancelar');
    expect(labels.eliminar()).toBe('Eliminar');
    expect(labels.editar()).toBe('Editar');
    expect(labels.nuevo()).toBe('Nuevo');
    expect(labels.crear()).toBe('Crear');
    expect(labels.cerrar()).toBe('Cerrar');
    expect(labels.volver()).toBe('Volver');
    expect(labels.buscar()).toBe('Buscar');
    expect(labels.descargar()).toBe('Descargar');
    expect(labels.subir()).toBe('Subir');
    expect(labels.confirmar()).toBe('Confirmar');
    expect(labels.reintentar()).toBe('Reintentar');
    expect(labels.cargando()).toContain('Cargando');
    expect(labels.actualizar()).toBe('Actualizar');
  });

  it('every label is a non-empty string', () => {
    const methods: Array<keyof CommonLabels> = [
      'guardar', 'cancelar', 'eliminar', 'editar', 'nuevo', 'crear',
      'cerrar', 'volver', 'buscar', 'descargar', 'subir', 'confirmar',
      'reintentar', 'cargando', 'actualizar',
    ];
    for (const m of methods) {
      const out = (labels[m] as () => string)();
      expect(typeof out).toBe('string');
      expect(out.length).toBeGreaterThan(0);
    }
  });
});
