import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageContainerComponent } from './page-container.component';

describe('PageContainerComponent', () => {
  let component: PageContainerComponent;
  let fixture: ComponentFixture<PageContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageContainerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PageContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('size por defecto es default', () => {
    expect(component.size()).toBe('default');
    expect(component.containerClass()).toContain('max-w-7xl');
  });

  it('size narrow usa max-w-2xl', () => {
    fixture.componentRef.setInput('size', 'narrow');
    expect(component.containerClass()).toContain('max-w-2xl');
  });

  it('size wide usa max-w-screen-2xl', () => {
    fixture.componentRef.setInput('size', 'wide');
    expect(component.containerClass()).toContain('max-w-screen-2xl');
  });

  it('size full usa max-w-none', () => {
    fixture.componentRef.setInput('size', 'full');
    expect(component.containerClass()).toContain('max-w-none');
  });
});
