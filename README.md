# Treasury Liquidity App (Java WebFlux + GraphQL + Angular)

This repo contains a minimal full‑stack take‑home that:
- Pulls **U.S. Treasury par yields** (official XML feed)
- Plots the yield curve (Angular + Chart.js)
- Lets a user **submit an order** (term + amount)
- Shows **historical orders**

## Quickstart

### Backend
```bash
cd backend
# Requires Java 17+ and Maven
mvn spring-boot:run
# GraphQL: http://localhost:8080/graphql
# GraphiQL UI: http://localhost:8080/graphiql
```

**GraphQL examples**
```graphql
query { yieldCurve { term rate } }
mutation { createOrder(input: { term: "2Y", amount: 1000000 }) { id term amount status rateAtSubmission } }
query { orders { id term amount createdAt rateAtSubmission } }
```

### Frontend
```bash
cd frontend/treasury-liquidity-ui
npm install
npm start
# open http://localhost:4200
```

## Notes
- **Data source**: U.S. Treasury Daily Interest Rate **XML** feed (no API key). Backend caches for 30 min & has a fallback curve if offline.
- **DB**: H2 (R2DBC) in‑memory for demo; swap to Postgres R2DBC later if desired.
- **CORS** open for local dev.

## Deliverables (per prompt)
- ✅ Public/Private GitHub repo (include this whole folder)
- ✅ Top-level `README.md` with run steps (this file)
- ✅ ~30s **video demo**: start backend + frontend; show chart rendering; submit two orders; show history updating.

---

_Trade‑offs_: Parsing XML with a regex keeps dependencies small for a take‑home; in production, consider an XML parser and a small persistence cache table for curve points.
