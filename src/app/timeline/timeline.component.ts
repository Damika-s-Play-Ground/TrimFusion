import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { formatTime } from '../shared/format-time';
import { panWindow, snapSeconds, ZOOM_LEVELS, zoomWindow } from './zoom';

/**
 * Trim timeline: filmstrip + waveform strips, zoomable range slider and time
 * readouts. Presentation-only — owns no export state; the parent binds
 * [(start)] / [(end)] and reacts to (rangeCommit) when a drag ends.
 */
@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss'],
})
export class TimelineComponent implements AfterViewInit, OnChanges {
  @Input() start = 0;
  @Input() end = 60;
  @Input() max = 600;
  @Input() filmstrip: string[] = [];
  @Input() filmstripLoading = false;
  /** Normalized 0..1 audio peaks; null/empty = no audio track (no strip). */
  @Input() waveform: number[] | null = null;
  /** Player position in seconds; null hides the playhead layer. */
  @Input() playhead: number | null = null;

  @Output() startChange = new EventEmitter<number>();
  @Output() endChange = new EventEmitter<number>();
  /** Emitted when a thumb drag finishes (parent revalidates the range). */
  @Output() rangeCommit = new EventEmitter<void>();
  /** Ask the parent to seek the player (timeline click / arrow keys). */
  @Output() seek = new EventEmitter<number>();
  /** Set the trim start/end to the current playhead. */
  @Output() setIn = new EventEmitter<void>();
  @Output() setOut = new EventEmitter<void>();

  @ViewChild('waveCanvas')
  private waveCanvas?: ElementRef<HTMLCanvasElement>;

  readonly formatTime = formatTime;
  readonly skeletonCells = Array.from({ length: 10 });

  // ── Zoom / pan / snap ─────────────────────────────────────────────────────
  readonly zoomLevels = ZOOM_LEVELS;
  zoom = 1;
  viewFrom = 0;
  snap = true;

  get viewTo(): number {
    return Math.min(this.max, this.viewFrom + this.max / this.zoom);
  }

  /** Slider step: whole seconds when snapping, tenths otherwise. */
  get step(): number {
    return this.snap ? 1 : 0.1;
  }

  /** CSS transform shifting the zoomed strips to the visible window. */
  get stripTransform(): string {
    if (this.zoom <= 1 || this.max <= 0) {
      return 'translateX(0)';
    }
    return `translateX(-${(this.viewFrom / this.max) * 100}%)`;
  }

  setZoom(level: number): void {
    this.zoom = level;
    const focus = (this.start + this.end) / 2;
    this.viewFrom = zoomWindow(this.max, level, focus).from;
    // Canvas width changes with the track width; redraw next frame.
    setTimeout(() => this.drawWaveform());
  }

  pan(direction: -1 | 1): void {
    const span = this.max / this.zoom;
    this.viewFrom = panWindow(
      { from: this.viewFrom, to: this.viewFrom + span },
      (direction * span) / 4,
      this.max
    ).from;
  }

  // ── Playhead / markers ────────────────────────────────────────────────────

  /** Percent position inside the visible window, or null when off-screen. */
  posPercent(seconds: number): number | null {
    const span = this.viewTo - this.viewFrom;
    if (span <= 0) {
      return null;
    }
    const percent = ((seconds - this.viewFrom) / span) * 100;
    return percent >= 0 && percent <= 100 ? percent : null;
  }

  /** Click on the strips seeks the player to that position. */
  onTrackClick(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (!rect.width) {
      return;
    }
    const ratio = (event.clientX - rect.left) / rect.width;
    const span = this.viewTo - this.viewFrom;
    this.seek.emit(snapSeconds(this.viewFrom + ratio * span, this.snap));
  }

  /** Arrow keys move the playhead (±1 s, Shift = ±5 s). */
  onTrackKeydown(event: KeyboardEvent): void {
    if (
      this.playhead === null ||
      (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    ) {
      return;
    }
    event.preventDefault();
    const step =
      (event.shiftKey ? 5 : 1) * (event.key === 'ArrowLeft' ? -1 : 1);
    this.seek.emit(Math.max(0, Math.min(this.max, this.playhead + step)));
  }

  ngAfterViewInit(): void {
    this.drawWaveform();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['max']) {
      // New file: reset the view to the whole clip.
      this.zoom = 1;
      this.viewFrom = 0;
    }
    // ViewChild is unset on first change; ngAfterViewInit covers that pass.
    this.drawWaveform();
  }

  onStartModel(value: number): void {
    this.start = snapSeconds(value, this.snap);
    this.startChange.emit(this.start);
  }

  onEndModel(value: number): void {
    this.end = snapSeconds(value, this.snap);
    this.endChange.emit(this.end);
  }

  private drawWaveform(): void {
    const canvas = this.waveCanvas?.nativeElement;
    const peaks = this.waveform;
    if (!canvas || !peaks?.length) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    const width = (canvas.width = canvas.offsetWidth || 600);
    const height = (canvas.height = 28);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(139, 92, 246, 0.55)';
    const barWidth = width / peaks.length;
    peaks.forEach((peak, i) => {
      const barHeight = Math.max(1, peak * (height - 2));
      ctx.fillRect(
        i * barWidth + 0.5,
        (height - barHeight) / 2,
        Math.max(1, barWidth - 1),
        barHeight
      );
    });
  }
}
