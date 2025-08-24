import { Routes } from '@angular/router';
export const routes: Routes = [
  { path: '', loadComponent: () => import('./yield-curve.component').then(m => m.YieldCurveComponent) },
  { path: 'orders', loadComponent: () => import('./order-history.component').then(m => m.OrderHistoryComponent) },
];
