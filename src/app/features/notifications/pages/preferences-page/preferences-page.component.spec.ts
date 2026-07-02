import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationPreferencesPageComponent } from './preferences-page.component';
import { NotificationsApiService } from '../../services/notifications-api.service';
import { of, throwError } from 'rxjs';

describe('NotificationPreferencesPageComponent', () => {
  let component: NotificationPreferencesPageComponent;
  let fixture: ComponentFixture<NotificationPreferencesPageComponent>;
  let apiSpy: jasmine.SpyObj<NotificationsApiService>;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj('NotificationsApiService', [
      'getPreferences',
      'updatePreference',
    ]);
    apiSpy.getPreferences.and.returnValue(of([]));
    await TestBed.configureTestingModule({
      imports: [NotificationPreferencesPageComponent],
      providers: [{ provide: NotificationsApiService, useValue: apiSpy }],
    }).compileComponents();
    fixture = TestBed.createComponent(NotificationPreferencesPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('carga preferencias al iniciar', () => {
    expect(apiSpy.getPreferences).toHaveBeenCalled();
  });

  describe('isEnabled', () => {
    it('retorna true por defecto', () => {
      expect(component.isEnabled('GRADE', 'IN_APP')).toBeTrue();
    });
  });

  describe('onToggle', () => {
    it('actualiza estado y llama a API', () => {
      apiSpy.updatePreference.and.returnValue(
        of({ category: 'GRADE', channel: 'IN_APP', enabled: false }),
      );
      component.onToggle('GRADE', 'IN_APP', false);
      expect(component.isEnabled('GRADE', 'IN_APP')).toBeFalse();
      expect(apiSpy.updatePreference).toHaveBeenCalled();
    });

    it('maneja error de API', () => {
      apiSpy.updatePreference.and.returnValue(throwError(() => new Error('Fail')));
      component.onToggle('GRADE', 'IN_APP', false);
      expect(component.saving()).toBeFalse();
    });
  });

  describe('channelLabel', () => {
    it('retorna label para IN_APP', () => {
      expect(component.channelLabel('IN_APP')).toBe('En la app');
    });

    it('retorna label para EMAIL', () => {
      expect(component.channelLabel('EMAIL')).toBe('Email');
    });
  });

  describe('categoryLabel', () => {
    it('retorna label para GRADE', () => {
      expect(component.categoryLabel('GRADE')).toBe('Calificaciones');
    });

    it('retorna label para SYSTEM', () => {
      expect(component.categoryLabel('SYSTEM')).toBe('Sistema');
    });
  });
});
