# Tally

Expense sharing for groups. Create a group, share the link, add what everyone paid, and Tally shows each person's balance and the fewest payments that settle everyone up. No accounts: anyone with a group's link can view and edit it.

## Stack

- `api/`: ASP.NET Core 10 minimal API on Postgres (Npgsql). Creates its tables on startup and serves the frontend.
- `web/`: Next.js 15 static export with the Geist font, copied into the API's `wwwroot` at build time.
- `Dockerfile`: builds both into one container listening on port 8080.

Amounts are stored as integers in minor units (kobo, cents), so splits always add up exactly.

## API

| Method | Path | Does |
| --- | --- | --- |
| POST | `/api/groups` | Create a group `{ name, currency, members: [names] }` |
| GET | `/api/groups/{id}` | Group with members, expenses, balances and settle-up transfers |
| POST | `/api/groups/{id}/members` | Add a person `{ name }` |
| POST | `/api/groups/{id}/expenses` | Add an expense `{ description, amount, paidBy, spentOn, shares: [{ memberId, share }] }` |
| POST | `/api/groups/{id}/payments` | Record a payment `{ from, to, amount }` |
| DELETE | `/api/groups/{id}/expenses/{expenseId}` | Delete an expense or payment |
| GET | `/healthz` | Health check |

## Run locally

```bash
# API (needs Postgres)
cd api
ConnectionStrings__Default="Host=localhost;Database=tally;Username=postgres;Password=postgres" dotnet run --urls http://localhost:5080

# Frontend with hot reload, proxying /api to the API above
cd web
npm install
npm run dev
```

## Deploy

On Fenze Cloud the repo deploys from its Dockerfile. Attach a Postgres database to the app; Fenze sets `ConnectionStrings__Default`, which the API reads.
