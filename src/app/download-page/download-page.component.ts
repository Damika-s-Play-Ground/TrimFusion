import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-download-page',
  templateUrl: './download-page.component.html',
  styleUrls: ['./download-page.component.scss'],
})
export class DownloadPageComponent {
  constructor(private router: Router) {}
  cropVideo() {
    this.router.navigate(['/home']);
  }
}
