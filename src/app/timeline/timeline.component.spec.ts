import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TimelineComponent } from './timeline.component';

describe('TimelineComponent (DOM)', () => {
  let fixture: ComponentFixture<TimelineComponent>;
  let component: TimelineComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TimelineComponent],
      imports: [FormsModule, MatSliderModule, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(TimelineComponent);
    component = fixture.componentInstance;
    component.max = 100;
    component.start = 10;
    component.end = 40;
    fixture.detectChanges();
  });

  // W2-079: segment blocks render from the segments input.
  it('renders one block per visible segment with labels', () => {
    component.segments = [
      { start: 0, end: 5 },
      { start: 10, end: 20 },
    ];
    fixture.detectChanges();
    const blocks: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('.segment-block');
    expect(blocks.length).toBe(2);
    expect(blocks[0].getAttribute('aria-label')).toContain('00:00 to 00:05');
  });

  it('hides blocks scrolled outside the zoom window', () => {
    component.segments = [{ start: 90, end: 100 }];
    component.zoom = 4;
    component.viewFrom = 0; // window 0–25
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelectorAll('.segment-block').length
    ).toBe(0);
  });

  // W2-080: numeric time inputs validate and clamp.
  it('applies a valid typed start time and emits the change', () => {
    const emitted: number[] = [];
    component.startChange.subscribe((v: number) => emitted.push(v));
    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[aria-label="Trim start time (e.g. 1:23)"]'
    );
    input.value = '0:30';
    input.dispatchEvent(new Event('change'));
    expect(component.start).toBe(30);
    expect(emitted).toEqual([30]);
    expect(input.value).toBe('00:30');
  });

  it('reverts invalid input and clamps out-of-range end times', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[aria-label="Trim start time (e.g. 1:23)"]'
    );
    input.value = 'garbage';
    input.dispatchEvent(new Event('change'));
    expect(component.start).toBe(10);
    expect(input.value).toBe('00:10');

    const end: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[aria-label="Trim end time (e.g. 2:00)"]'
    );
    end.value = '9:59'; // 599 s > max 100 → clamps to max
    end.dispatchEvent(new Event('change'));
    expect(component.end).toBe(100);
  });
});
