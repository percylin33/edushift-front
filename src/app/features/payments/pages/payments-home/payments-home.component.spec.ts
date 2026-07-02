import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaymentsHomeComponent } from './payments-home.component';

describe('PaymentsHomeComponent', () => {
  let fixture: ComponentFixture<PaymentsHomeComponent>;
  let component: PaymentsHomeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentsHomeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(PaymentsHomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('renderiza título y subtítulo', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Pagos');
  });
});
