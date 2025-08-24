import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-yield-curve',
  standalone: true,
  imports: [NgIf],
  template: `
    <h2>Yield Curve</h2>
    <!-- Chart Display -->
    <div style="margin: 20px 0;">
      <canvas #yieldChart
              style="width: 100%; height: 520px; border: 1px solid #ddd; border-radius: 3px; background: white;"></canvas>
    </div>
    <div class="muted" *ngIf="error">{{error}}</div>
    <div *ngIf="!error && (!yieldData || yieldData.length === 0)">Loading yield curve...</div>
  `
})
export class YieldCurveComponent implements OnInit {
  @ViewChild('yieldChart', { static: false }) yieldChart?: ElementRef;

  yieldData?: {term: string, rate: number}[];
  error?: string;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.fetchYieldCurveData();
  }

  fetchYieldCurveData() {
    const query = { query: 'query { yieldCurve { term rate } }' };
    this.http.post<{data: {yieldCurve: {term:string, rate:number}[]}}>('http://localhost:8080/graphql', query)
      .subscribe({
        next: (response) => {
          this.yieldData = response.data.yieldCurve;
          setTimeout(() => this.drawYieldCurveChart(), 100);
        },
        error: (err) => this.error = 'Failed to load yield curve data'
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

    // Y axis (fixed 1%..7%)
    const yAxisMin = 1.0, yAxisMax = 7.0, yAxisRange = yAxisMax - yAxisMin;

    // Background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, cssHeight);
    bgGradient.addColorStop(0, '#f8f9fa');
    bgGradient.addColorStop(1, '#ffffff');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // Gridlines (horizontal) light dotted
    ctx.strokeStyle = '#e3e7ea';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    for (let p = 1; p <= 7; p++) {
      const y = cssHeight - paddingBottom - ((p - yAxisMin) / yAxisRange) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(cssWidth - paddingRight, y);
      ctx.stroke();
    }

    // Axes (solid)
    ctx.setLineDash([]);
    ctx.strokeStyle = '#495057';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, paddingTop);
    ctx.lineTo(paddingLeft, cssHeight - paddingBottom);
    ctx.lineTo(cssWidth - paddingRight, cssHeight - paddingBottom);
    ctx.stroke();

    // Compute points
    const points: {x: number, y: number, value: number}[] = [];
    for (let i = 0; i < data.length; i++) {
      const x = paddingLeft + (i / (data.length - 1)) * chartWidth;
      const y = cssHeight - paddingBottom - ((data[i] - yAxisMin) / yAxisRange) * chartHeight;
      points.push({ x, y, value: data[i] });
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

      // Labels — avoid overlapping the curve/axes
      const label = p.value.toFixed(2) + '%';
      ctx.fillStyle = '#495057';
      ctx.font = 'bold 12px system-ui';

      // default above
      let labelX = p.x;
      let labelY = p.y - 14;

      // edges
      if (i === 0) { ctx.textAlign = 'left';  labelX = p.x + 10; }
      else if (i === points.length - 1) { ctx.textAlign = 'right'; labelX = p.x - 10; }
      else { ctx.textAlign = 'center'; }

      // clamp within chart content
      const minY = paddingTop + 16;
      const maxY = cssHeight - paddingBottom - 16;
      labelY = Math.max(minY, Math.min(maxY, labelY));

      const minX = paddingLeft + 10;
      const maxX = cssWidth - paddingRight - 10;
      labelX = Math.max(minX, Math.min(maxX, labelX));

      // If too close to the curve, push a bit more above
      if (Math.abs(labelY - p.y) < 12) {
        labelY = Math.max(minY, p.y - 20);
      }

      ctx.fillText(label, labelX, labelY);
    });

    // X labels — move closer to the axis (tighter)
    ctx.fillStyle = '#495057';
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'center';
    labels.forEach((lab, i) => {
      const x = paddingLeft + (i / (labels.length - 1)) * chartWidth;
      ctx.fillText(lab, x, cssHeight - paddingBottom + 24); // was ~ -25, now closer
    });

    // Y labels
    ctx.font = '12px system-ui';
    ctx.textAlign = 'right';
    for (let p = 1; p <= 7; p++) {
      const y = cssHeight - paddingBottom - ((p - yAxisMin) / yAxisRange) * chartHeight;
      ctx.fillText(p + '%', paddingLeft - 15, y + 4);
    }

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
}
