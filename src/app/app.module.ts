import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { BrowserModule } from '@angular/platform-browser';
import { YouTubePlayerModule } from '@angular/youtube-player';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NotFoundPageComponent } from './not-found-page/not-found-page.component';
import { RenderingPageComponent } from './rendering-page/rendering-page.component';

@NgModule({
  declarations: [AppComponent, RenderingPageComponent, NotFoundPageComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    YouTubePlayerModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
