import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';
import { featureFlagGuard } from './feature-flag.guard';
import { FeatureKey } from '@core/enums';
import { environment } from '@env/environment';

describe('featureFlagGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
  });

  it('permite acceso cuando no hay feature key', () => {
    const result = TestBed.runInInjectionContext(() => featureFlagGuard({ data: {} } as any, {} as any));
    expect(result).toBeTrue();
  });

  it('permite acceso cuando feature está habilitado', () => {
    (environment.features as Record<string, boolean>)[FeatureKey.Dashboard] = true;
    const result = TestBed.runInInjectionContext(() =>
      featureFlagGuard({ data: { feature: FeatureKey.Dashboard } } as any, {} as any),
    );
    expect(result).toBeTrue();
  });

  it('redirige a not-found cuando feature está deshabilitado', () => {
    (environment.features as Record<string, boolean>)['unknown' as FeatureKey] = false;
    const result = TestBed.runInInjectionContext(() =>
      featureFlagGuard({ data: { feature: 'unknown' as FeatureKey } } as any, {} as any),
    );
    expect(result instanceof UrlTree).toBeTrue();
  });
});
