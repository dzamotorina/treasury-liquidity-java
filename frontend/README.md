# Treasury Liquidity — Frontend (Angular + Apollo + Chart.js)

**Run locally**
```bash
cd frontend/treasury-liquidity-ui
npm install
npm start          # dev server at http://localhost:4200
```

**Assumes backend at** `http://localhost:8080/graphql`.

**What it shows**
- Line chart of the yield curve.
- Order form (term + amount) -> GraphQL mutation.
- Order history table (auto-refetched).

If you prefer Angular Material, you can add it later with `ng add @angular/material`.
