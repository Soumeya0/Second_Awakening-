# Level Up

Submission for Hack The Hill III. Setup details: [backend](backend/README.md), [frontend](Frontend/README.md).

## Run it with Docker

```bash
docker compose up --build
```

Then open http://localhost:8080. This starts three containers:

| Service | What it is | Port |
|---|---|---|
| `frontend` | the Vite build served by Nginx, which proxies `/api` and `/audio` to the backend | 8080 |
| `backend` | the Express API; applies `schema.sql` on every start (safe to re-run) | 4000 |
| `db` | a local TimescaleDB (data kept in the `db-data` volume) | 55432 |

By default it runs with `DEMO_MODE=true` and `AUTH_DISABLED=true`, and the frontend sends `x-dev-user: player1`.
API keys (Gemini, ElevenLabs, Auth0) are read from `backend/.env` if that file exists (see `backend/.env.example`).
To override the defaults, put them in a `.env` next to `docker-compose.yml`:

```bash
DATABASE_URL=postgres://tsdbadmin:...tsdb.cloud.timescale.com:PORT/tsdb?sslmode=require  # use Tiger Cloud instead of the local db
AUTH_DISABLED=false       # once AUTH0_DOMAIN / AUTH0_AUDIENCE are set
VITE_DEV_USER=someone     # a fresh player (the frontend is rebuilt with --build)
```

Seed the Rank S showcase player with `docker compose exec backend npm run db:seed` (use it with `VITE_DEV_USER=showcase`),
run the smoke test with `docker compose exec backend npm run test:smoke`, and reset everything with `docker compose down -v`.
