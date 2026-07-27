import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NotFoundPageComponent } from './not-found-page/not-found-page.component';
import { RenderingPageComponent } from './rendering-page/rendering-page.component';
const routes: Routes = [
  {
    component: RenderingPageComponent,
    path: 'home',
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '/home',
  },
  {
    component: NotFoundPageComponent,
    path: '**',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
