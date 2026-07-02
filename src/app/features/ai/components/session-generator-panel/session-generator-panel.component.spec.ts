import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionGeneratorPanelComponent } from './session-generator-panel.component';
import { SessionGeneratorService } from '../../services/session-generator.service';
import { of, throwError } from 'rxjs';

describe('SessionGeneratorPanelComponent', () => {
  let component: SessionGeneratorPanelComponent;
  let fixture: ComponentFixture<SessionGeneratorPanelComponent>;
  let serviceSpy: jasmine.SpyObj<SessionGeneratorService>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('SessionGeneratorService', ['generate']);
    serviceSpy.generate.and.returnValue(
      of({ title: 'Clase', activities: [], resources: [], evaluationCriteria: [] }),
    );
    await TestBed.configureTestingModule({
      imports: [SessionGeneratorPanelComponent],
      providers: [{ provide: SessionGeneratorService, useValue: serviceSpy }],
    }).compileComponents();
    fixture = TestBed.createComponent(SessionGeneratorPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('inicia con estado vacío', () => {
    expect(component.draft()).toBeNull();
    expect(component.loading()).toBeFalse();
    expect(component.error()).toBeNull();
  });

  describe('statusLabel', () => {
    it('retorna "Listo" por defecto', () => {
      expect(component.statusLabel()).toBe('Listo');
    });

    it('retorna "Generando sesión…" mientras carga', () => {
      component.loading.set(true);
      expect(component.statusLabel()).toBe('Generando sesión…');
    });

    it('retorna "Error al generar" si hay error', () => {
      component.error.set({ code: 'ERR', message: 'Error' });
      expect(component.statusLabel()).toBe('Error al generar');
    });

    it('retorna "Borrador listo" si hay draft', () => {
      component.draft.set({ title: 'Test', activities: [], resources: [], evaluationCriteria: [] });
      expect(component.statusLabel()).toBe('Borrador listo');
    });
  });

  describe('statusClass', () => {
    it('retorna clase por defecto', () => {
      expect(component.statusClass()).toContain('text-slate');
    });
  });

  describe('onGenerate', () => {
    it('genera borrador exitosamente', async () => {
      component.form.patchValue({
        topic: 'Revolución',
        courseName: 'Historia',
        gradeName: '5to',
        durationMinutes: 45,
      });
      await component.onGenerate();
      expect(component.draft()).toBeTruthy();
      expect(component.loading()).toBeFalse();
    });

    it('no genera si form es inválido', async () => {
      await component.onGenerate();
      expect(component.draft()).toBeNull();
    });

    it('maneja error del servicio', async () => {
      serviceSpy.generate.and.returnValue(
        throwError(() => ({ code: 'AI_ERROR', message: 'Falló' })),
      );
      component.form.patchValue({
        topic: 'Revolución',
        courseName: 'Historia',
        gradeName: '5to',
        durationMinutes: 45,
      });
      await component.onGenerate();
      expect(component.error()).toBeTruthy();
      expect(component.draft()).toBeNull();
    });
  });

  describe('onAccept', () => {
    it('emite el draft al aceptar', () => {
      const emitSpy = spyOn(component.accept, 'emit');
      component.draft.set({ title: 'Test', activities: [], resources: [], evaluationCriteria: [] });
      component.onAccept();
      expect(emitSpy).toHaveBeenCalled();
    });

    it('no emite si no hay draft', () => {
      const emitSpy = spyOn(component.accept, 'emit');
      component.onAccept();
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });
});
