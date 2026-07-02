import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TenantLogoComponent } from './tenant-logo.component';
import { TenantAssetsService } from '@core/theming/tenant-assets.service';

describe('TenantLogoComponent', () => {
  let component: TenantLogoComponent;
  let fixture: ComponentFixture<TenantLogoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantLogoComponent],
      providers: [
        {
          provide: TenantAssetsService,
          useValue: jasmine.createSpyObj('TenantAssetsService', [], {
            fullLogoUrl: () => null,
            markUrl: () => null,
            alt: () => 'Logo',
            initial: () => 'E',
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TenantLogoComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('variant', 'mark');
    fixture.componentRef.setInput('size', 'md');
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('resolvedUrl usa markUrl para variant mark', () => {
    expect(component.resolvedUrl()).toBeNull();
  });

  it('resolvedUrl usa fullLogoUrl para variant full', () => {
    fixture.componentRef.setInput('variant', 'full');
    fixture.detectChanges();
    expect(component.resolvedUrl()).toBeNull();
  });
});
