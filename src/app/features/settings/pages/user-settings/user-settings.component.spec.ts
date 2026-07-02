import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ChangeDetectionStrategy } from '@angular/core';

import { AuthService } from '@core/services';
import { UserRole, UserStatus } from '@core/enums';
import { User } from '@core/models';

import { UserSettingsComponent } from './user-settings.component';

describe('UserSettingsComponent', () => {
  let fixture: ComponentFixture<UserSettingsComponent>;
  let component: UserSettingsComponent;
  let auth: AuthService;

  const seedUser = (overrides: Partial<User> = {}): User =>
    ({
      publicUuid: 'u-1',
      fullName: 'Alice Demo',
      email: 'alice@acme.test',
      status: UserStatus.Active,
      roles: [UserRole.Teacher],
      mfaEnabled: false,
      lastLoginAt: new Date('2026-06-30T12:00:00Z').toISOString(),
      createdAt: new Date('2024-01-15T08:00:00Z').toISOString(),
      ...overrides,
    }) as User;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserSettingsComponent],
      providers: [provideRouter([])],
    })
      .overrideComponent(UserSettingsComponent, {
        set: { changeDetection: ChangeDetectionStrategy.Default },
      })
      .compileComponents();

    auth = TestBed.inject(AuthService);
    auth.setSession({
      user: seedUser(),
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: new Date(Date.now() + 60_000),
    });
  });

  afterEach(() => auth.clearSession());

  const render = (): void => {
    fixture = TestBed.createComponent(UserSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('shows the email and role from the cached user', () => {
    render();
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('alice@acme.test');
    expect(text).toContain('TEACHER');
  });

  it('shows MFA badge state', () => {
    auth.setUser(seedUser({ mfaEnabled: true }));
    render();
    expect(fixture.nativeElement.textContent).toContain('Activado');

    auth.setUser(seedUser({ mfaEnabled: false }));
    render();
    expect(fixture.nativeElement.textContent).toContain('Desactivado');
  });
});
