import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { TimelineComponent } from '../timeline/timeline.component';
import { RenderingPageComponent } from './rendering-page.component';

describe('RenderingPageComponent cheat-sheet (DOM)', () => {
  let fixture: ComponentFixture<RenderingPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RenderingPageComponent, TimelineComponent],
      imports: [
        FormsModule,
        MatButtonModule,
        MatIconModule,
        MatSliderModule,
        MatSnackBarModule,
        NoopAnimationsModule,
        RouterTestingModule,
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RenderingPageComponent);
    fixture.detectChanges();
  });

  // W2-081: cheat-sheet opens and closes.
  it('opens via the header button and closes via Escape', () => {
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.cheatsheet-backdrop')).toBeNull();

    const keysButton = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Show keyboard shortcuts"]'
    );
    expect(keysButton).not.toBeNull();
    keysButton?.click();
    fixture.detectChanges();
    const dialog = host.querySelector('.cheatsheet-backdrop');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('role')).toBe('dialog');
    // Every documented shortcut is listed.
    expect(host.querySelectorAll('.cheatsheet-list kbd').length).toBe(
      fixture.componentInstance.shortcutHelp.length
    );

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    fixture.detectChanges();
    expect(host.querySelector('.cheatsheet-backdrop')).toBeNull();
  });

  it('closes via the explicit close button', () => {
    const host: HTMLElement = fixture.nativeElement;
    fixture.componentInstance.showCheatSheet = true;
    fixture.detectChanges();
    host
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Close keyboard shortcuts"]'
      )
      ?.click();
    fixture.detectChanges();
    expect(host.querySelector('.cheatsheet-backdrop')).toBeNull();
  });
});
