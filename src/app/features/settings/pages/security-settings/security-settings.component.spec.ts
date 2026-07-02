import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ChangeDetectionStrategy } from '@angular/core';

import { AuthService } from '@core/services';
import { UserRole, UserStatus } from '@core/enums';
import { User } from '@core/models';

import { SecuritySettingsComponent } from './security-settings.component';

describe('SecuritySettingsComponent', () => {
  let fixture: ComponentFixture<SecuritySettingsComponent>;
  let auth: AuthService;

  const seed = (overrides: Partial<User> = {}): User =>
    ({
      publicUuid: 'me',
      fullName: 'Alice Demo',
      email: 'alice@acme.test',
      status: UserStatus.Active,
      roles: [UserRole.Teacher],
      mfaEnabled: false,
      ...overrides,
    }) as User;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SecuritySettingsComponent],
      providers: [provideRouter([])],
    })
      .overrideComponent(SecuritySettingsComponent, {
        set: { changeDetection: ChangeDetectionStrategy.Default },
      })
      .compileComponents();
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => auth.clearSession());

  const render = () => {
    fixture = TestBed.createComponent(SecuritySettingsComponent);
    fixture.detectChanges();
  };

  it('shows the activate CTA when MFA is disabled', () => {
    auth.setUser(seed({ mfaEnabled: false }));
    render();
    expect(fixture.nativeElement.textContent).toContain('Activar');
  });

  it('shows the reconfigurar CTA when MFA is enabled', () => {
    auth.setUser(seed({ mfaEnabled: true }));
    render();
    expect(fixture.nativeElement.textContent).toContain('Reconfigurar');
  });
});
