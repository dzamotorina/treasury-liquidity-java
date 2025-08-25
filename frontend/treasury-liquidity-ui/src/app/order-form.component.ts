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
    // Client-side validation
    if (this.amount <= 0 || !Number.isFinite(this.amount)) {
      this.msg = '❌ Amount must be greater than 0';
      return;
    }

    this.msg = 'Submitting order...';
    const mutation = {
      query: `mutation { createOrder(input: { term: "${this.term}", amount: ${this.amount} }) { id term amount createdAt rateAtSubmission } }`
    };
    
    this.http.post<any>('http://localhost:8080/graphql', mutation)
      .subscribe({
        next: (response) => {
          // GraphQL may return 200 with an "errors" array. Handle that.
          const gqlErrors = response?.errors;
          if (Array.isArray(gqlErrors) && gqlErrors.length > 0) {
            const firstMsg = gqlErrors[0]?.message || 'Request failed';
            this.msg = `❌ ${firstMsg}`;
            return;
          }
          const created = response?.data?.createOrder;
          if (!created) {
            this.msg = '❌ Failed to submit order';
            return;
          }
          this.msg = '✅ Order submitted successfully';
          setTimeout(() => this.msg = '', 3000);
        },
        error: (err) => {
          const serverMsg = err?.error?.errors?.[0]?.message || err?.message || 'Failed to submit order';
          this.msg = `❌ ${serverMsg}`;
        }
      });
  }
}
