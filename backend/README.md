# Level Up: backend

Node + Express 5 + **Tiger Data** (PostgreSQL + TimescaleDB) through plain SQL with `pg`.
The game rules match the frontend (`frontend/src/api/game.js`): 30 categories, 4 proof types, 4 required quests + a bonus a day,
1000 EXP per level with every bar full, the Rift, and the potion shop.

Diagrams: [database](../docs/database.md) (tables, time-series flow, policies) and
[state machines](../docs/state-machines.md) (quests, verification, game day, Rift, levels, vitals, audio).

## Get it running (15 minutes)

1. Install Node 20 or newer, then `npm install`.
2. Create a free service on [Tiger Cloud](https://console.cloud.timescale.com) (shared compute, 750 MB is plenty).
   Copy its connection string into `.env` as `DATABASE_URL` (keep `?sslmode=require`): `cp .env.example .env`.
   For your first run, also set `AUTH_DISABLED=true` and `DEMO_MODE=true` so you can test without Auth0.
3. `npm run db:check` confirms the service supports hypertables, continuous aggregates, and compression.
4. `npm run db:schema` creates every table, view, and policy (safe to re-run).
5. `npm run db:seed` (optional) adds a Rank S showcase player with 150 days of history and ~215k heart-rate readings,
   then prints the numbers for the pitch. Use it with the header `x-dev-user: showcase`.
6. `npm run dev`. You should see "Connected to Tiger Data" and "API on http://localhost:4000".
7. `npm test` runs the game-math tests (no database). `npm run test:smoke` runs the whole loop against the database.

No Tiger service yet? A local TimescaleDB works the same:
`docker run -d --name tsdb -e POSTGRES_PASSWORD=test -p 55432:5432 timescale/timescaledb:latest-pg17`
with `DATABASE_URL=postgres://postgres:test@localhost:55432/postgres`.

With `AUTH_DISABLED=true`, every request acts as the user named in the `x-dev-user` header.
Use a new name any time you want a fresh player. **Never set it to true on the Vultr server.**

## How the data is stored

| Table / view | Kind | What it holds |
|---|---|---|
| `users`, `category_progress`, `quests`, `story_chapters` | regular tables | profiles, bars, each day's quests, story |
| `vitals_readings` | hypertable (7-day chunks) | one row per second of a VITALS/FOCUS quest: bpm, breathing, focus |
| `player_events` | hypertable (30-day chunks) | quest completions, closed days, Rift losses, purchases, gate wins, level-ups |
| `daily_player_stats` | continuous aggregate | per player per day: quests by proof, EXP, coins, day result (calendar + 30-day chart) |
| `vitals_per_minute` | continuous aggregate | per quest per minute: avg/min/max bpm, breathing, focus (reward chart) |

Policies: both views refresh on a schedule and include the newest rows in real time; readings compress after 3 days
(about 92% smaller in the seeded demo), events after 30 days; raw readings are dropped after 90 days while
`vitals_per_minute` keeps the history. Schema: `src/db/schema.sql`. Queries: `src/db/*.js`.

## Where things live

| Piece | File(s) |
|---|---|
| Express app / server start | `src/app.js`, `src/server.js`, `src/config.js`, `.env.example` |
| Connection pool, transactions | `src/db/pool.js` |
| Game rules (pure, tested) | `src/game/rules.js`, `test/rules.test.js` |
| Categories, materials, shop items | `src/game/content.js` (kept identical to `frontend/src/api/data.js`) |
| Player JSON for the frontend | `src/game/userView.js` |
| End of day (cron + demo) | `src/jobs/endOfDayJob.js`, `src/game/endOfDay.js` |
| Auth0 middleware | `src/middleware/auth.js` |
| Gemini quests, photo checks, chapters | `src/services/gemini.js`, `quests.js`, `story.js` |
| ElevenLabs voice with caching | `src/routes/voice.js`, `src/services/voice.js` |

## API

| Route | What it does |
|---|---|
| `GET /api/me`, `PATCH /api/me` | player object; update `name`, `look`, `answers`, `chosen` |
| `POST /api/onboarding` | `{ chosen: [10+ ids], look, name?, answers? }` |
| `GET /api/quests/today`, `POST /api/quests/add` | today's quests; one extra once everything listed is done |
| `POST /api/quests/:id/start` / `cancel` | run or give up the timer |
| `POST /api/quests/:id/vitals` | `{ readings: [{ t, bpm?, breathingRate?, focusScore? }] }`, max 60 per batch, every ~5 s |
| `GET /api/quests/:id/vitals` | per-minute series + summary for the reward chart |
| `POST /api/quests/:id/complete` | PHOTO: multipart `photo`; VITALS/FOCUS: verified from stored readings; HONOR: no body |
| `POST /api/rift/seen`, `POST /api/rift/leave` | Rift screen shown; leave once the timer is over |
| `GET /api/shop`, `POST /api/shop/buy` | potions: `{ itemId: "freeze" \| "shield" \| "outfit" }` |
| `POST /api/gate/reward` | arena win, Rank C+, once per game day |
| `GET /api/stats?days=30`, `GET /api/stats/history?month=YYYY-MM` | from `daily_player_stats` |
| `GET /api/stats/db` (public) | row counts, compression, query timings for the "Powered by Tiger Data" panel |
| `GET /api/story` | chapters, newest first |
| `POST /api/demo/next-day` / `add-exp` / `fill-bars` | demo mode only |

## Try the game loop with curl

```bash
API=http://localhost:4000/api
H="x-dev-user: alice"

curl -s -X POST $API/onboarding -H "$H" -H "Content-Type: application/json" -d '{"name":"Alice",
  "chosen":["strength","yoga","running","walk","reading","study","language","meditate","cooking","cleaning"]}'
curl -s $API/quests/today -H "$H"                                   # copy a quest id
curl -s -X POST $API/quests/QUEST_ID/start -H "$H"
curl -s -X POST $API/quests/QUEST_ID/vitals -H "$H" -H "Content-Type: application/json" \
     -d "{\"readings\":[{\"t\":$(date +%s000),\"bpm\":96}]}"        # VITALS quests
curl -s -X POST $API/quests/QUEST_ID/complete -H "$H" -F "photo=@meal.jpg"   # PHOTO quests
curl -s -X POST $API/quests/QUEST_ID/complete -H "$H"                        # everything else
curl -s -X POST $API/demo/next-day -H "$H" -H "Content-Type: application/json" -d '{"outcome":"fail"}'
curl -s "$API/stats?days=7" -H "$H"
```

## Decisions made in the code

- **Game days** are `YYYY-MM-DD` in `APP_TIMEZONE` (default America/Toronto), the same zone `daily_player_stats` buckets by. Changing it means re-running `db:schema` on a fresh database.
- **One transaction per state change:** completing a quest locks the quest and the user, then updates coins, bars, the quest, and writes the event together, so a double click can't pay twice.
- **Vitals are verified on the server** from the stored readings (heart-rate rise for workouts, slower breathing or heart rate for yoga, average focus for FOCUS). Unverified vitals still complete the quest, so a camera hiccup never costs the player their day.
- **Rejected photos** return `422` with Gemini's reason and don't complete the quest; the player can retry. If Gemini itself errors, the photo is accepted without verification.
- **The Rift:** a day without all 4 required quests costs 150 EXP and 25 coins and banishes for 1 hour (+1 hour per failed day in a row); a Ward potion cuts it to 30 minutes and is used up.
- **Quest proof types, durations, and rewards** come from `content.js` and `rules.js`, never from Gemini (it only writes titles and descriptions).
- **Timer check:** outside demo mode, completing before `endsAt` returns `409`.
- **Production:** `pm2 start src/server.js --name levelup-api`; Nginx proxies `/api` and `/audio` to port 4000.
