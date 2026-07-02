import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeToggleComponent } from './theme-toggle.component';
import { ThemeService } from '@core/services';
import { Theme } from '@core/enums';

describe('ThemeToggleComponent', () => {
  let component: ThemeToggleComponent;
  let fixture: ComponentFixture<ThemeToggleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThemeToggleComponent],
      providers: [
        {
          provide: ThemeService,
          useValue: jasmine.createSpyObj('ThemeService', ['setTheme', 'clearUserPreference'], {
            userTheme: () => null,
            hasUserPreference: () => false,
            isDark: () => false,
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ThemeToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('tiene 3 opciones de tema', () => {
    expect(component.options.length).toBe(3);
  });

  it('toggle cambia el estado open', () => {
    const initial = component.open();
    component.toggle();
    expect(component.open()).toBe(!initial);
  });

  it('close cierra el dropdown', () => {
    component.toggle();
    component.close();
    expect(component.open()).toBeFalse();
  });

  it('pick llama a themeService.setTheme y cierra', () => {
    const themeService = TestBed.inject(ThemeService);
    component.pick(Theme.Dark);
    expect(themeService.setTheme).toHaveBeenCalledWith(Theme.Dark);
    expect(component.open()).toBeFalse();
  });

  it('reset llama a clearUserPreference y cierra', () => {
    const themeService = TestBed.inject(ThemeService);
    component.reset();
    expect(themeService.clearUserPreference).toHaveBeenCalled();
    expect(component.open()).toBeFalse();
  });

  it('triggerIcon es sun cuando no está oscuro', () => {
    expect(component.triggerIcon()).toBe('sun');
  });

  it('triggerIcon es moon cuando está oscuro', () => {
    const themeService = TestBed.inject(ThemeService);
    (themeService.isDark as unknown as jasmine.Spy).and.returnValue(true);
    expect(component.triggerIcon()).toBe('moon');
  });
});
