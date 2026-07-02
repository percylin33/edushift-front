import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OnboardingLayoutComponent } from './onboarding-layout.component';
import { provideRouter } from '@angular/router';
import { TenantService } from '@core/services';

describe('OnboardingLayoutComponent', () => {
  let component: OnboardingLayoutComponent;
  let fixture: ComponentFixture<OnboardingLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnboardingLayoutComponent],
      providers: [
        provideRouter([]),
        {
          provide: TenantService,
          useValue: jasmine.createSpyObj('TenantService', [], { tenant: () => null }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('appName está definido', () => {
    expect(component.appName).toBeDefined();
  });

  it('year es el año actual', () => {
    expect(component.year).toBe(new Date().getFullYear());
  });

  it('hasSteps es false inicialmente', () => {
    expect(component.hasSteps()).toBeFalse();
  });
});
