import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BreadcrumbsComponent } from './breadcrumbs.component';
import { BreadcrumbService } from '../../services';

describe('BreadcrumbsComponent', () => {
  let component: BreadcrumbsComponent;
  let fixture: ComponentFixture<BreadcrumbsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BreadcrumbsComponent],
      providers: [
        {
          provide: BreadcrumbService,
          useValue: jasmine.createSpyObj('BreadcrumbService', [], { breadcrumbs: () => [] }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BreadcrumbsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('crumbs es un array vacío por defecto', () => {
    expect(component.crumbs()).toEqual([]);
  });

  it('crumbs refleja las migas del servicio', () => {
    const service = TestBed.inject(BreadcrumbService);
    const mockCrumbs = [{ label: 'Inicio', url: '/' }];
    (service.breadcrumbs as unknown as jasmine.Spy).and.returnValue(mockCrumbs);
    expect(component.crumbs()).toEqual(mockCrumbs);
  });
});
