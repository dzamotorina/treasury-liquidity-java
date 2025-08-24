# Treasury Liquidity — Backend (Spring Boot WebFlux + GraphQL)

**What it does**
- `/graphql` exposes:
  - `yieldCurve`: fetches the latest U.S. Treasury par yield curve (via the official XML feed) and returns points like `[{ term: "2Y", rate: 4.35 }]`.
  - `orders`: lists submitted demo orders from an in‑memory H2 (R2DBC) database.
  - `createOrder(input: {term, amount})`: stores an order and captures the current yield for that term, if available.

**Run locally**

```bash
# from backend/
./mvnw spring-boot:run     # if you have mvnw; otherwise: mvn spring-boot:run
# GraphQL endpoint: http://localhost:8080/graphql
```

**Test it in GraphiQL** (the Spring Boot starter exposes GraphiQL at `/graphiql`):

```graphql
query { yieldCurve { term rate } }
mutation { createOrder(input: { term: "2Y", amount: 1000000 }) { id term amount createdAt rateAtSubmission } }
query { orders { id term amount createdAt rateAtSubmission } }
```

**Notes**
- Yield Source: U.S. Treasury Daily Interest Rate XML Feed (no API key).
- CORS: Open for dev so Angular on `http://localhost:4200` works out of the box.
