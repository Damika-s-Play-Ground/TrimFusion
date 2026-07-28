import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  ViewChild,
} from '@angular/core';
import { formatTime } from '../shared/format-time';

/**
 * Trim timeline: filmstrip + waveform strips + range slider + time readouts.
 * Presentation-only — owns no export state; the parent binds [(start)] /
 * [(end)] and reacts to (rangeCommit) when a drag ends.
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

  @Output() startChange = new EventEmitter<number>();
  @Output() endChange = new EventEmitter<number>();
  /** Emitted when a thumb drag finishes (parent revalidates the range). */
  @Output() rangeCommit = new EventEmitter<void>();

  @ViewChild('waveCanvas')
  private waveCanvas?: ElementRef<HTMLCanvasElement>;

  readonly formatTime = formatTime;
  readonly skeletonCells = Array.from({ length: 10 });

  ngAfterViewInit(): void {
    this.drawWaveform();
  }

  ngOnChanges(): void {
    // ViewChild is unset on first change; ngAfterViewInit covers that pass.
    this.drawWaveform();
  }

  onStartModel(value: number): void {
    this.start = value;
    this.startChange.emit(value);
  }

  onEndModel(value: number): void {
    this.end = value;
    this.endChange.emit(value);
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
