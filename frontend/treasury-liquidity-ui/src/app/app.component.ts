import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  template: `
  <div style="padding: 20px; font-family: Arial, sans-serif;">
    <h1>🏦 Treasury Liquidity Desk</h1>
    
    <!-- Yield Curve Section -->
    <div style="border: 1px solid #ccc; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <h2>Yield Curve</h2>
      <div *ngIf="yieldError" style="color: red;">{{yieldError}}</div>
      <div *ngIf="!yieldError && yieldData?.length === 0">Loading yield curve...</div>
      <div *ngIf="yieldData && yieldData.length > 0">
        <p><strong>Current U.S. Treasury Yield Curve:</strong></p>
        
        <!-- Chart Display -->
        <div style="margin: 20px 0;">
          <canvas #yieldChart
                  style="width: 100%; height: 520px; border: 1px solid #ddd; border-radius: 3px; background: white;"></canvas>
        </div>
        
        <!-- Badge Display for Quick Reference -->
        <div style="margin-top: 15px;">
          <p style="font-size: 14px; color: #666; margin-bottom: 10px;">Quick Reference:</p>
          <div style="display: flex; flex-wrap: wrap; gap: 10px;">
            <span *ngFor="let point of yieldData" style="background: #f0f0f0; padding: 5px 10px; border-radius: 3px; color: #333; border: 1px solid #ddd; font-size: 12px;">
              {{point.term}}: {{point.rate}}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Order Form Section -->
    <div style="border: 1px solid #ccc; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <h2>Submit Order</h2>
      <form (ngSubmit)="submitOrder()" style="display: flex; gap: 15px; align-items: end;">
        <label style="display: flex; flex-direction: column;">
          Term:
          <select [(ngModel)]="selectedTerm" name="term" style="padding: 5px; margin-top: 5px;">
            <option *ngFor="let t of terms" [value]="t">{{t}}</option>
          </select>
        </label>
        <label style="display: flex; flex-direction: column;">
          Amount (USD):
          <input [(ngModel)]="orderAmount" name="amount" type="number" min="1" step="1000" 
                 style="padding: 5px; margin-top: 5px;" placeholder="1000000"/>
        </label>
        <button type="submit" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 3px;">
          Place Order
        </button>
      </form>
      <div style="margin-top: 10px; color: #666;">{{orderMessage}}</div>
    </div>

    <!-- Order History Section -->
    <div style="border: 1px solid #ccc; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <h2>Order History</h2>
      <div *ngIf="orders.length === 0" style="text-align: center; color: #666; padding: 20px;">
        No orders yet
      </div>
      <table *ngIf="orders.length > 0" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">When</th>
            <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Term</th>
            <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Amount</th>
            <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Yield at Submission</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let order of orders">
            <td style="border: 1px solid #ccc; padding: 8px;">{{ formatDate(order.createdAt) }}</td>
            <td style="border: 1px solid #ccc; padding: 8px;">{{ order.term }}</td>
            <td style="border: 1px solid #ccc; padding: 8px;">{{ formatAmount(order.amount) }}</td>
            <td style="border: 1px solid #ccc; padding: 8px;">
              {{ order.rateAtSubmission ? order.rateAtSubmission.toFixed(2) + '%' : '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  `
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('yieldChart', { static: false }) yieldChart?: ElementRef<HTMLCanvasElement>;
  yieldData: any[] = [];
  yieldError: string = '';
  orders: any[] = [];
  orderMessage: string = '';
  
  terms = ['1M','2M','3M','6M','1Y','2Y','3Y','5Y','7Y','10Y','20Y','30Y'];
  selectedTerm = '2Y';
  orderAmount = 1000000;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    // Chart will be drawn after data loads
  }

  ngOnInit() {
    console.log('AppComponent ngOnInit called');
    this.loadYieldCurve();
    this.loadOrders();
    // Refresh orders every 10 seconds
    setInterval(() => this.loadOrders(), 10000);
  }

  loadYieldCurve() {
    const query = { query: 'query { yieldCurve { term rate } }' };
    this.http.post<{data: {yieldCurve: {term:string, rate:number}[]}}>('http://localhost:8080/graphql', query)
      .subscribe({
        next: (response) => {
          this.yieldData = response.data.yieldCurve;
          this.cdr.detectChanges();
          setTimeout(() => this.drawYieldCurveChart(), 100); // Draw chart after DOM updates
        },
        error: (err) => {
          this.yieldError = 'Failed to load yield curve data';
        }
      });
  }

  private drawYieldCurveChart() {
    if (!this.yieldChart || !this.yieldData?.length) return;

    const canvas = this.yieldChart.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Taller graph: increase CSS height and backing buffer
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 980;
    const cssHeight = 520; // was 420
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const data = this.yieldData.map(p => p.rate);
    const labels = this.yieldData.map(p => p.term);

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // Layout
    const paddingLeft = 95;
    const paddingTop = 80;
    const paddingRight = 95;
    const paddingBottom = 80; // slightly smaller to bring labels closer to the axis
    const chartWidth = cssWidth - (paddingLeft + paddingRight);
    const chartHeight = cssHeight - (paddingTop + paddingBottom);

    // Fixed Y-axis scale from 3.6% to 5.0% (proportionate like the reference chart)
    const yAxisMin = 3.6, yAxisMax = 5.0, yAxisRange = yAxisMax - yAxisMin;

    // Horizontal grid lines every 0.2% (3.6, 3.8, ..., 5.0) — brighter and dashed
    ctx.strokeStyle = '#cfd6dc';
    ctx.lineWidth = 1.25;
    ctx.setLineDash([4, 4]);
    for (let v = yAxisMin; v <= yAxisMax + 1e-6; v += 0.2) {
      const y = cssHeight - paddingBottom - ((v - yAxisMin) / yAxisRange) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(cssWidth - paddingRight, y);
      ctx.stroke();
    }

    // Vertical grid lines — same brightness and dashes
    for (let i = 0; i < labels.length; i++) {
      const x = paddingLeft + (i / (labels.length - 1)) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, cssHeight - paddingBottom);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Points computed with fixed 3.6–5.0% scale
    const points: {x: number, y: number, value: number}[] = [];
    for (let i = 0; i < data.length; i++) {
      const x = paddingLeft + (i / (data.length - 1)) * chartWidth;
      const y = cssHeight - paddingBottom - ((data[i] - yAxisMin) / yAxisRange) * chartHeight;
      points.push({ x, y, value: data[i] });
    }

    // Y labels at 3.6..5.0 by 0.2
    ctx.font = '12px system-ui';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#495057';
    for (let v = yAxisMin; v <= yAxisMax + 1e-6; v += 0.2) {
      const y = cssHeight - paddingBottom - ((v - yAxisMin) / yAxisRange) * chartHeight;
      ctx.fillText(v.toFixed(1) + '%', paddingLeft - 15, y);
    }

    // Brighter vertical guide lines from each data point to the X axis
    // (solid and a bit brighter than grid)
    ctx.strokeStyle = 'rgba(0, 123, 255, 0.45)'; // brighter guides
    ctx.lineWidth = 2;
    ctx.setLineDash([]); // solid
    points.forEach(p => {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, cssHeight - paddingBottom);
      ctx.stroke();
    });

    // Area under curve
    const areaGradient = ctx.createLinearGradient(0, paddingTop, 0, cssHeight - paddingBottom);
    areaGradient.addColorStop(0, 'rgba(0, 123, 255, 0.28)');
    areaGradient.addColorStop(1, 'rgba(0, 123, 255, 0.06)');
    ctx.fillStyle = areaGradient;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, cssHeight - paddingBottom);
    points.forEach((p, i) => {
      if (i === 0) ctx.lineTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.lineTo(cssWidth - paddingRight, cssHeight - paddingBottom);
    ctx.closePath();
    ctx.fill();

    // Curve
    const lineGradient = ctx.createLinearGradient(paddingLeft, 0, cssWidth - paddingRight, 0);
    lineGradient.addColorStop(0, '#28a745');
    lineGradient.addColorStop(0.3, '#007bff');
    lineGradient.addColorStop(0.7, '#6f42c1');
    lineGradient.addColorStop(1, '#dc3545');
    ctx.strokeStyle = lineGradient;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Points + labels with clamping
    points.forEach((p, i) => {
      // point glow
      ctx.shadowColor = 'rgba(0, 123, 255, 0.6)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#007bff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
      ctx.fill();

      // Labels — place higher above the curve
      const label = p.value.toFixed(2) + '%';
      ctx.fillStyle = '#495057';
      ctx.font = 'bold 12px system-ui';

      // default above with larger offset
      const labelOffsetAbove = 32;   // raise labels higher (previously ~14)
      const minGapFromPoint  = 24;   // ensure minimum distance from the point/line

      let labelX = p.x;
      let labelY = p.y - labelOffsetAbove;

      // edges
      if (i === 0) { ctx.textAlign = 'left';  labelX = p.x + 10; }
      else if (i === points.length - 1) { ctx.textAlign = 'right'; labelX = p.x - 10; }
      else { ctx.textAlign = 'center'; }

      // clamp within chart content
      const minY = paddingTop + 16;
      const maxY = cssHeight - paddingBottom - 16;
      const minX = paddingLeft + 10;
      const maxX = cssWidth - paddingRight - 10;

      // maintain a minimum gap from the point even after clamping
      labelY = Math.max(minY, Math.min(maxY, labelY));
      if (labelY > p.y - minGapFromPoint) {
        labelY = Math.max(minY, p.y - minGapFromPoint);
      }

      labelX = Math.max(minX, Math.min(maxX, labelX));

      ctx.fillText(label, labelX, labelY);
    })

    // X labels — move closer to the axis (tighter)
    ctx.fillStyle = '#495057';
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'center';
    labels.forEach((lab, i) => {
      const x = paddingLeft + (i / (labels.length - 1)) * chartWidth;
      ctx.fillText(lab, x, cssHeight - paddingBottom + 24); // was ~ -25, now closer
    });

    // Remove the duplicate integer Y-axis loop entirely
    // ctx.font = '12px system-ui';
    // ctx.textAlign = 'right';
    // for (let p = 1; p <= 7; p++) {
    //   const y = cssHeight - paddingBottom - ((p - yAxisMin) / yAxisRange) * chartHeight;
    //   ctx.fillText(p + '%', paddingLeft - 15, y + 4);
    // }

    // Title and subtitle (same)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = '#212529';
    ctx.font = 'bold 20px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('U.S. Treasury Yield Curve', cssWidth / 2, 35);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#6c757d';
    ctx.font = '12px system-ui';
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    ctx.fillText(`As of ${currentDate}`, cssWidth / 2, 55);

    // Axis labels
    ctx.fillStyle = '#495057';
    ctx.font = 'bold 14px system-ui';
    ctx.save();
    ctx.translate(25, cssHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Yield (%)', 0, 0);
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillText('Maturity', cssWidth / 2, cssHeight - 10);
  }

    // Remove the duplicate integer Y-axis loop entirely
    // ctx.font = '12px system-ui';
    // ctx.textAlign = 'right';
    // for (let p = 1; p <= 7; p++) {
    //   const y = cssHeight - paddingBottom - ((p - yAxisMin) / yAxisRange) * chartHeight;
    //   ctx.fillText(p + '%', paddingLeft - 15, y + 4);
    // }

  loadOrders() {
    const query = { query: 'query { orders { id term amount createdAt rateAtSubmission } }' };
    this.http.post<{data: {orders: any[]}}>('http://localhost:8080/graphql', query)
      .subscribe({
        next: (response) => this.orders = response.data.orders.reverse(),
        error: (err) => console.error('Failed to load orders:', err)
      });
  }

  submitOrder() {
    this.orderMessage = 'Submitting order...';

    if (this.orderAmount <= 0 || !Number.isFinite(this.orderAmount)) {
      this.orderMessage = '❌ Amount must be greater than 0';
      return;
    }

    const mutation = {
      query: `mutation { createOrder(input: { term: "${this.selectedTerm}", amount: ${this.orderAmount} }) { id term amount createdAt rateAtSubmission } }`
    };
    
    this.http.post<any>('http://localhost:8080/graphql', mutation)
      .subscribe({
        next: (response) => {
          const gqlErrors = response?.errors;
          if (Array.isArray(gqlErrors) && gqlErrors.length > 0) {
            const firstMsg = gqlErrors[0]?.message || 'Request failed';
            this.orderMessage = `❌ ${firstMsg}`;
            return;
          }
          const created = response?.data?.createOrder;
          if (!created) {
            this.orderMessage = '❌ Failed to submit order';
            return;
          }
          this.orderMessage = '✅ Order submitted successfully';
          setTimeout(() => this.orderMessage = '', 3000);
          this.loadOrders();
        },
        error: (err) => {
          const serverMsg = err?.error?.errors?.[0]?.message || err?.message || 'Failed to submit order';
          this.orderMessage = `❌ ${serverMsg}`;
        }
      });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat().format(amount);
  }
}
