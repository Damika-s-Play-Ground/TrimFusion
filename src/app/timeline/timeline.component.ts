import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { debounce } from '../shared/debounce';
import { formatTime } from '../shared/format-time';
import { parseTimeString } from '../shared/parse-time';
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
  /** Stitch segments to render as blocks on the lane below the strips. */
  @Input() segments: { start: number; end: number }[] = [];
  @Input() selectedSegment: number | null = null;

  @Output() startChange = new EventEmitter<number>();
  @Output() endChange = new EventEmitter<number>();
  /** Emitted when a thumb drag finishes (parent revalidates the range). */
  @Output() rangeCommit = new EventEmitter<void>();
  /** Ask the parent to seek the player (timeline click / arrow keys). */
  @Output() seek = new EventEmitter<number>();
  /** Set the trim start/end to the current playhead. */
  @Output() setIn = new EventEmitter<void>();
  @Output() setOut = new EventEmitter<void>();
  /** A segment block was clicked (index into `segments`). */
  @Output() segmentSelect = new EventEmitter<number>();
  /** A segment block was dragged (moved or edge-resized). */
  @Output() segmentChange = new EventEmitter<{
    index: number;
    start: number;
    end: number;
  }>();

  @ViewChild('waveCanvas')
  private waveCanvas?: ElementRef<HTMLCanvasElement>;

  readonly formatTime = formatTime;
  readonly skeletonCells = Array.from({ length: 10 });

  // ── Zoom / pan / snap ─────────────────────────────────────────────────────
  private static readonly PREFS_KEY = 'tf-timeline-prefs';
  readonly zoomLevels = ZOOM_LEVELS;
  zoom = 1;
  viewFrom = 0;
  snap = true;

  constructor() {
    // Restore persisted zoom/snap preferences.
    try {
      const raw = localStorage.getItem(TimelineComponent.PREFS_KEY);
      if (raw) {
        const prefs = JSON.parse(raw) as { zoom?: number; snap?: boolean };
        if (
          prefs.zoom &&
          (ZOOM_LEVELS as readonly number[]).includes(prefs.zoom)
        ) {
          this.zoom = prefs.zoom;
        }
        if (typeof prefs.snap === 'boolean') {
          this.snap = prefs.snap;
        }
      }
    } catch {
      /* storage unavailable */
    }
  }

  private persistPrefs(): void {
    try {
      localStorage.setItem(
        TimelineComponent.PREFS_KEY,
        JSON.stringify({ zoom: this.zoom, snap: this.snap })
      );
    } catch {
      /* storage unavailable */
    }
  }

  setSnap(value: boolean): void {
    this.snap = value;
    this.persistPrefs();
  }

  /** Redraw the waveform when the layout resizes (debounced). */
  private readonly onResize = debounce(() => this.drawWaveform(), 150);

  @HostListener('window:resize')
  handleWindowResize(): void {
    this.onResize();
  }

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
    this.persistPrefs();
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

  // ── Segment drag (move / edge-resize) ─────────────────────────────────────
  private drag: {
    index: number;
    mode: 'move' | 'start' | 'end';
    startX: number;
    origStart: number;
    origEnd: number;
    laneWidth: number;
    moved: boolean;
  } | null = null;
  private suppressClick = false;

  onBlockPointerDown(event: PointerEvent, index: number): void {
    const seg = this.segments[index];
    const el = event.currentTarget as HTMLElement;
    if (!seg || !el.parentElement) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const edge = 7;
    const mode =
      event.clientX - rect.left <= edge
        ? 'start'
        : rect.right - event.clientX <= edge
          ? 'end'
          : 'move';
    this.drag = {
      index,
      mode,
      startX: event.clientX,
      origStart: seg.start,
      origEnd: seg.end,
      laneWidth: el.parentElement.getBoundingClientRect().width,
      moved: false,
    };
    el.setPointerCapture(event.pointerId);
  }

  onBlockPointerMove(event: PointerEvent): void {
    const d = this.drag;
    if (!d || !d.laneWidth) {
      return;
    }
    if (Math.abs(event.clientX - d.startX) > 3) {
      d.moved = true;
    }
    const span = this.viewTo - this.viewFrom;
    const deltaSec = ((event.clientX - d.startX) / d.laneWidth) * span;
    const clamp = (v: number, lo: number, hi: number) =>
      Math.max(lo, Math.min(hi, v));
    let start = d.origStart;
    let end = d.origEnd;
    if (d.mode === 'move') {
      const length = end - start;
      start = clamp(d.origStart + deltaSec, 0, this.max - length);
      end = start + length;
    } else if (d.mode === 'start') {
      start = clamp(d.origStart + deltaSec, 0, end - 1);
    } else {
      end = clamp(d.origEnd + deltaSec, start + 1, this.max);
    }
    this.segmentChange.emit({
      index: d.index,
      start: snapSeconds(start, this.snap),
      end: snapSeconds(end, this.snap),
    });
  }

  onBlockPointerUp(): void {
    this.suppressClick = this.drag?.moved ?? false;
    this.drag = null;
  }

  onBlockClick(index: number): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.segmentSelect.emit(index);
  }

  /** Clamped left/width percents for a segment block, null when off-window. */
  blockStyle(seg: {
    start: number;
    end: number;
  }): { left: number; width: number } | null {
    const span = this.viewTo - this.viewFrom;
    if (span <= 0) {
      return null;
    }
    const from = Math.max(seg.start, this.viewFrom);
    const to = Math.min(seg.end, this.viewTo);
    if (to <= from) {
      return null;
    }
    return {
      left: ((from - this.viewFrom) / span) * 100,
      width: ((to - from) / span) * 100,
    };
  }

  // ── Hover tooltip / stepping / nudging ────────────────────────────────────
  hoverTime: number | null = null;
  hoverPercent = 0;

  onTrackHover(event: PointerEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (!rect.width) {
      return;
    }
    const ratio = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / rect.width)
    );
    this.hoverPercent = ratio * 100;
    this.hoverTime = this.viewFrom + ratio * (this.viewTo - this.viewFrom);
  }

  onTrackLeave(): void {
    this.hoverTime = null;
  }

  /** Step the playhead by ±1 frame (~1/30 s); bypasses snapping. */
  frameStep(direction: -1 | 1): void {
    if (this.playhead === null) {
      return;
    }
    this.seek.emit(
      Math.max(0, Math.min(this.max, this.playhead + direction / 30))
    );
  }

  /** Jump the playhead to the trim start/end. */
  jumpTo(edge: 'start' | 'end'): void {
    this.seek.emit(edge === 'start' ? this.start : this.end);
  }

  /** Nudge the trim start by ±1 s (clamped, committed). */
  nudgeStart(delta: -1 | 1): void {
    this.start = Math.max(0, Math.min(this.start + delta, this.end - 1));
    this.startChange.emit(this.start);
    this.rangeCommit.emit();
  }

  /** Nudge the trim end by ±1 s (clamped, committed). */
  nudgeEnd(delta: -1 | 1): void {
    this.end = Math.min(this.max, Math.max(this.end + delta, this.start + 1));
    this.endChange.emit(this.end);
    this.rangeCommit.emit();
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

  /** Typed start time: parse, clamp to [0, end-1], commit (or revert). */
  onStartInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const parsed = parseTimeString(input.value);
    if (parsed === null) {
      input.value = formatTime(this.start);
      return;
    }
    this.start = snapSeconds(
      Math.max(0, Math.min(parsed, this.end - 1)),
      this.snap
    );
    input.value = formatTime(this.start);
    this.startChange.emit(this.start);
    this.rangeCommit.emit();
  }

  /** Typed end time: parse, clamp to [start+1, max], commit (or revert). */
  onEndInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const parsed = parseTimeString(input.value);
    if (parsed === null) {
      input.value = formatTime(this.end);
      return;
    }
    this.end = snapSeconds(
      Math.min(this.max, Math.max(parsed, this.start + 1)),
      this.snap
    );
    input.value = formatTime(this.end);
    this.endChange.emit(this.end);
    this.rangeCommit.emit();
  }

  /** One-click reset to the whole clip. */
  useFullRange(): void {
    this.start = 0;
    this.end = this.max;
    this.startChange.emit(this.start);
    this.endChange.emit(this.end);
    this.rangeCommit.emit();
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
