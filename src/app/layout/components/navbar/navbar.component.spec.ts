import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavbarComponent } from './navbar.component';
import { LayoutService } from '../../services';

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [
        {
          provide: LayoutService,
          useValue: jasmine.createSpyObj('LayoutService', ['openSidebar']),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('openSidebar llama a layout.openSidebar', () => {
    const layout = TestBed.inject(LayoutService);
    component.openSidebar();
    expect(layout.openSidebar).toHaveBeenCalled();
  });
});
