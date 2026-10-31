import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserMenuComponent } from './user-menu.component';
import { provideRouter } from '@angular/router';
import { AuthService } from '@core/services';
import { AuthApiService } from '@features/auth/services/auth-api.service';
import { provideHttpClient } from '@angular/common/http';

describe('UserMenuComponent', () => {
  let component: UserMenuComponent;
  let fixture: ComponentFixture<UserMenuComponent>;
  let authSpy: jasmine.SpyObj<AuthService>;
  let authApiSpy: jasmine.SpyObj<AuthApiService>;
  let userSignal: ReturnType<typeof signal>;

  beforeEach(async () => {
    userSignal = signal({ fullName: 'Juan Pérez', email: 'juan@test.com' });
    authSpy = jasmine.createSpyObj('AuthService', ['clearSession', 'hasRole', 'hasPermission'], {
      isAuthenticated: () => true,
      user: userSignal,
      refreshToken: () => null,
    });
    authApiSpy = jasmine.createSpyObj('AuthApiService', ['logout']);

    await TestBed.configureTestingModule({
      imports: [UserMenuComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: AuthService, useValue: authSpy },
        { provide: AuthApiService, useValue: authApiSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('fullName devuelve el nombre completo del usuario', () => {
    expect(component.fullName()).toBe('Juan Pérez');
  });

  it('fullName devuelve Invitado cuando no hay usuario', () => {
    userSignal.set(null);
    expect(component.fullName()).toBe('Invitado');
  });

  it('toggle cambia el estado open', () => {
    const initial = component.open();
    component.toggle();
    expect(component.open()).toBe(!initial);
  });

  it('close cierra el menú', () => {
    component.toggle();
    expect(component.open()).toBeTrue();
    component.close();
    expect(component.open()).toBeFalse();
  });
});
