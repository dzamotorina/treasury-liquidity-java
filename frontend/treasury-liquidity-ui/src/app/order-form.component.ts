import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NgFor } from '@angular/common';

@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [FormsModule, NgFor],
  template: `
    <form (ngSubmit)="submit()">
      <label>Term
        <select [(ngModel)]="term" name="term">
          <option *ngFor="let t of terms" [value]="t">{{t}}</option>
        </select>
      </label>
      <label>Amount (USD)
        <input [(ngModel)]="amount" name="amount" type="number" min="1" step="1000" placeholder="1000000"/>
      </label>
      <button type="submit">Place Order</button>
      <div class="muted">{{msg}}</div>
    </form>
  `
})
export class OrderFormComponent {
  terms = ['1M','1.5M','2M','3M','4M','6M','1Y','2Y','3Y','5Y','7Y','10Y','20Y','30Y'];
  term = '2Y';
  amount = 1000000;
  msg = '';

  constructor(private http: HttpClient) {}
  
  submit() {
    this.msg = 'Submitting order...';
    const mutation = {
      query: `mutation { createOrder(input: { term: "${this.term}", amount: ${this.amount} }) { id term amount createdAt rateAtSubmission } }`
    };
    
    this.http.post<{data: {createOrder: any}}>('http://localhost:8080/graphql', mutation)
      .subscribe({
        next: (response) => {
          this.msg = '✅ Order submitted successfully';
          setTimeout(() => this.msg = '', 3000);
        },
        error: (err) => this.msg = '❌ Failed to submit order'
      });
  }
}
