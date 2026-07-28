import { ErrorHandler, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { YouTubePlayerModule } from '@angular/youtube-player';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ExportControlsComponent } from './export-controls/export-controls.component';
import { GlobalErrorHandler } from './global-error-handler';
import { NotFoundPageComponent } from './not-found-page/not-found-page.component';
import { RenderingPageComponent } from './rendering-page/rendering-page.component';
import { TimelineComponent } from './timeline/timeline.component';

@NgModule({
  declarations: [
    AppComponent,
    RenderingPageComponent,
    NotFoundPageComponent,
    TimelineComponent,
    ExportControlsComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    YouTubePlayerModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatSnackBarModule,
  ],
  providers: [{ provide: ErrorHandler, useClass: GlobalErrorHandler }],
  bootstrap: [AppComponent],
})
export class AppModule {}
