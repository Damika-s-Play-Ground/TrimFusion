import { Component, EventEmitter, Input, Output } from '@angular/core';
import { formatTime } from '../shared/format-time';

/**
 * Trim timeline: filmstrip strip + range slider + time readouts.
 * Presentation-only — owns no export state; the parent binds [(start)] /
 * [(end)] and reacts to (rangeCommit) when a drag ends.
 */
@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss'],
})
export class TimelineComponent {
  @Input() start = 0;
  @Input() end = 60;
  @Input() max = 600;
  @Input() filmstrip: string[] = [];
  @Input() filmstripLoading = false;

  @Output() startChange = new EventEmitter<number>();
  @Output() endChange = new EventEmitter<number>();
  /** Emitted when a thumb drag finishes (parent revalidates the range). */
  @Output() rangeCommit = new EventEmitter<void>();

  readonly formatTime = formatTime;
  readonly skeletonCells = Array.from({ length: 10 });

  onStartModel(value: number): void {
    this.start = value;
    this.startChange.emit(value);
  }

  onEndModel(value: number): void {
    this.end = value;
    this.endChange.emit(value);
  }
}
