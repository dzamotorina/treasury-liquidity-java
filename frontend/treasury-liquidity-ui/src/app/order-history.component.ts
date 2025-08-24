import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgFor, DatePipe, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [NgFor, DatePipe, DecimalPipe],
  template: `
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #f5f5f5;">
          <th style="border: 1px solid #ccc; padding: 8px;">When</th>
          <th style="border: 1px solid #ccc; padding: 8px;">Term</th>
          <th style="border: 1px solid #ccc; padding: 8px;">Amount</th>
          <th style="border: 1px solid #ccc; padding: 8px;">Yield at Submission</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let o of orders">
          <td style="border: 1px solid #ccc; padding: 8px;">{{ o.createdAt | date:'short' }}</td>
          <td style="border: 1px solid #ccc; padding: 8px;">{{ o.term }}</td>
          <td style="border: 1px solid #ccc; padding: 8px;">{{ o.amount | number:'1.0-0' }}</td>
          <td style="border: 1px solid #ccc; padding: 8px;">
            {{ o.rateAtSubmission !== null ? (o.rateAtSubmission | number:'1.2-2') + '%' : '—' }}
          </td>
        </tr>
        <tr *ngIf="orders.length === 0">
          <td colspan="4" style="text-align: center; padding: 20px;">No orders yet</td>
        </tr>
      </tbody>
    </table>
  `
})
export class OrderHistoryComponent implements OnInit {
  orders: any[] = [];
  
  constructor(private http: HttpClient) {}
  
  ngOnInit() {
    this.loadOrders();
    setInterval(() => this.loadOrders(), 5000);
  }
  
  private loadOrders() {
    const query = { query: 'query { orders { id term amount createdAt rateAtSubmission } }' };
    this.http.post<{data: {orders: any[]}}>('http://localhost:8080/graphql', query)
      .subscribe({
        next: (response) => this.orders = response.data.orders,
        error: (err) => console.error('Failed to load orders:', err)
      });
  }
}
