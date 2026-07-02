import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { StorageService } from '@core/services';
import { Theme } from '@core/enums';

describe('ThemeService', () => {
  let service: ThemeService;
  let storageSpy: jasmine.SpyObj<StorageService>;

  beforeEach(() => {
    storageSpy = jasmine.createSpyObj('StorageService', ['get', 'set', 'remove']);
    storageSpy.get.and.returnValue(null);

    TestBed.configureTestingModule({
      providers: [ThemeService, { provide: StorageService, useValue: storageSpy }],
    });
    service = TestBed.inject(ThemeService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('theme por defecto es System', () => {
    expect(service.theme()).toBe(Theme.System);
  });

  it('hasUserPreference es false inicialmente', () => {
    expect(service.hasUserPreference()).toBeFalse();
  });

  it('userTheme es null inicialmente', () => {
    expect(service.userTheme()).toBeNull();
  });

  it('setTheme establece y persiste la preferencia', () => {
    service.setTheme(Theme.Dark);
    expect(service.userTheme()).toBe(Theme.Dark);
    expect(storageSpy.set).toHaveBeenCalled();
    expect(service.hasUserPreference()).toBeTrue();
  });

  it('toggle cambia entre light y dark', () => {
    service.setTheme(Theme.Light);
    service.toggle();
    expect(service.userTheme()).toBe(Theme.Dark);
  });

  it('clearUserPreference elimina la preferencia', () => {
    service.setTheme(Theme.Dark);
    service.clearUserPreference();
    expect(service.userTheme()).toBeNull();
    expect(storageSpy.remove).toHaveBeenCalled();
    expect(service.hasUserPreference()).toBeFalse();
  });

  it('applyTenantDefault establece tenantTheme', () => {
    service.applyTenantDefault(Theme.Light);
    expect(service.tenantTheme()).toBe(Theme.Light);
  });

  it('theme usa userTheme sobre tenantTheme sobre System', () => {
    service.applyTenantDefault(Theme.Dark);
    expect(service.theme()).toBe(Theme.Dark);
    service.setTheme(Theme.Light);
    expect(service.theme()).toBe(Theme.Light);
  });
});
