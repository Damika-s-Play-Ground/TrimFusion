import { Component, Input } from '@angular/core';
import { RenderingPageComponent } from '../rendering-page/rendering-page.component';

/**
 * Export controls, grouped into collapsible Basics / Visual / Audio /
 * Advanced sections. Presentation-only template split: all state stays on
 * the page component (the undo/URL-state snapshots read it there), so this
 * child simply renders against `page`.
 */
@Component({
  selector: 'app-export-controls',
  templateUrl: './export-controls.component.html',
  styleUrls: ['./export-controls.component.scss'],
})
export class ExportControlsComponent {
  @Input({ required: true }) page!: RenderingPageComponent;
}
