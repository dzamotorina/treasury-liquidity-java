# Treasury Liquidity — Quick Start

Follow these steps to run the UI locally.

1) Start the backend application:
    - In your IDE, locate the backend's main class (e.g., `Application.java`).
    - Right‑click `Application.java` and choose “Run” to start the backend server.
    - Ensure it’s running locally (commonly on http://localhost:8080).
2) Open a terminal in the UI folder and install dependencies (first time only): bash npm install
3) Start the dev server: bash npm run start
4) Open the app in your browser: http://localhost:4200

## How the application works

- Single-page application:
  - The UI is a single-page Angular app. It boots the root component and renders the entire experience in the browser without full page reloads.

- HTTP communication:
  - The UI uses the browser’s HTTP client to talk to a backend GraphQL API running locally (commonly at http://localhost:8080/graphql).
  - Typical operations:
    - Query the current Treasury yield curve to render a chart.
    - Submit new orders with a selected term and amount.
    - Poll or refresh order history to display recent activity.

- Key UI areas:
  - Yield Curve: Fetches yield data from the backend and draws a chart in a canvas element.
  - Submit Order: Lets you pick a term and amount, then sends a request to create an order. A status message confirms success or failure.
  - Order History: Retrieves and displays a table of recent orders, including timestamp, term, amount, and the yield at submission.

- Runtime expectations:
  - Frontend dev server runs at http://localhost:4200 and proxies requests from the browser to the backend URL in the code/config.
  - Backend service should be running at http://localhost:8080 so that the UI can successfully load data and submit orders.









