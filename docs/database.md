# Database

Level Up stores everything in one Tiger Data service (PostgreSQL + TimescaleDB).
Regular tables hold profiles and game state; two hypertables hold time-series data; two continuous aggregates
summarize them for the charts. Source of truth: [`backend/src/db/schema.sql`](../backend/src/db/schema.sql).

- A **hypertable** is a PostgreSQL table split into time chunks, built for time-series data.
- A **continuous aggregate** is a summary view the database keeps up to date on a schedule.
  Both views here also include the newest raw rows in real time (`materialized_only = false`).

## Entity relationships

```mermaid
erDiagram
  users ||--o{ category_progress : "has one bar per chosen category"
  users ||--o{ quests : "gets quests each game day"
  users ||--o{ story_chapters : "unlocks"
  users ||--o{ player_events : "produces"
  users ||--o{ vitals_readings : "produces"
  quests ||--o{ vitals_readings : "recorded during (logical link, no FK)"

  users {
    bigint id PK
    text auth0_id UK
    text name
    boolean onboarded
    text_array chosen "10+ category ids"
    jsonb look "avatar"
    jsonb answers "onboarding answers"
    int level
    int xp "0 to 999 inside the level"
    int coins "CHECK >= 0"
    jsonb materials "material name to count"
    jsonb stats "proof type to count"
    jsonb items "freeze, shield, outfit"
    int quests_done
    int failed_days_in_row
    jsonb rift "until, hours, days, seen, returned, lost"
    date game_date "day the current quests belong to"
    int extra_today
    date gate_won_on
    date started
    timestamptz created_at
  }

  category_progress {
    bigint user_id PK, FK
    text category PK
    int count "0 to target"
    int target "10"
  }

  quests {
    bigint id PK
    bigint user_id FK
    date date "UNIQUE with user_id, category"
    text category
    text kind "required, extra (bonus: older days only)"
    int position
    text difficulty "hard, medium, medium-easy, easy (required quests)"
    text title
    text description
    int duration_minutes
    text proof "VITALS, FOCUS, PHOTO, HONOR"
    text status "pending, active, completed, failed"
    timestamptz started_at
    timestamptz ends_at
    timestamptz completed_at
    jsonb rewards
    jsonb proof_result "verified, reason, attempts, summary"
    timestamptz created_at
  }

  story_chapters {
    bigint id PK
    bigint user_id FK
    text type "intro, rankUp, banished, returned"
    text title
    text text
    text audio_url
    text audio_status "pending, ready, failed, none"
    timestamptz created_at
  }

  player_events {
    timestamptz time "hypertable partition, 30-day chunks"
    bigint user_id FK
    text type "quest_completed, day_closed, rift, purchase, gate_win, level_up"
    text category
    text proof
    int xp "negative for Rift losses"
    int coins "negative for losses and purchases"
    text result "day_closed: cleared, partial, missed"
    jsonb data
  }

  vitals_readings {
    timestamptz time "hypertable partition, 7-day chunks"
    bigint user_id FK
    bigint quest_id "UNIQUE with time"
    smallint bpm "25 to 250"
    real breathing_rate "0 to 80"
    real focus_score "0 to 1"
  }
```

All foreign keys use `ON DELETE CASCADE`, so deleting a user removes their quests, bars, chapters, events, and readings.

## Time-series flow

```mermaid
flowchart LR
  subgraph writers [Writers]
    Timer["QuestTimer: 1 reading per second"]
    Complete["POST /quests/:id/complete"]
    EndOfDay["End-of-day job and demo next-day"]
    Shop["Shop, Gates, level-ups"]
  end

  subgraph hyper [Hypertables]
    Vitals["vitals_readings"]
    Events["player_events"]
  end

  subgraph caggs [Continuous aggregates]
    PerMinute["vitals_per_minute: avg, min, max bpm per quest per minute"]
    Daily["daily_player_stats: quests by proof, EXP, coins, day result per player per day"]
  end

  subgraph readers [Readers]
    Reward["Reward popup heart-rate chart"]
    Verify["Vitals verification"]
    Profile["Profile: 30-day chart and history calendar"]
    Panel["Powered by Tiger Data panel"]
  end

  Timer -->|"POST /quests/:id/vitals, batches of up to 60 every 5s"| Vitals
  Complete -->|"quest_completed, level_up"| Events
  EndOfDay -->|"day_closed, rift"| Events
  Shop -->|"purchase, gate_win, level_up"| Events

  Vitals --> PerMinute
  Events --> Daily

  PerMinute -->|"GET /quests/:id/vitals"| Reward
  Vitals -->|"summary: start, peak, avg bpm, breathing, focus"| Verify
  Daily -->|"GET /stats, GET /stats/history"| Profile
  Vitals --> Panel
  Events --> Panel
```

## Background policies

```mermaid
flowchart TB
  subgraph vitalsLife [vitals_readings chunk lifecycle]
    V1["New chunk: uncompressed, accepts inserts"] -->|"older than 3 days"| V2["Compressed: about 92% smaller in the demo seed"]
    V2 -->|"older than 90 days"| V3["Dropped by the retention policy"]
  end

  subgraph eventsLife [player_events chunk lifecycle]
    E1["New chunk"] -->|"older than 30 days"| E2["Compressed, kept forever"]
  end

  subgraph refresh [Continuous aggregate refresh]
    R1["vitals_per_minute: every 5 minutes, window of the last day"]
    R2["daily_player_stats: every 15 minutes, window of the last 3 days"]
  end

  V3 -.->|"per-minute summary survives the drop"| R1
```

Because `vitals_per_minute` only refreshes the last day, the per-minute history outlives the raw readings.
Never refresh it over a window older than 90 days: that would recompute it from dropped chunks and erase it
(the seed script refreshes only inside the retention window for this reason).

## Storage budget

| Data | Size | Notes |
|---|---|---|
| One heart-rate reading | about 100 bytes raw | including its index |
| Demo seed (85 days of readings) | about 215,000 rows, 29 MB raw, 2.2 MB compressed | measured on TimescaleDB 2.30 |
| 100 players, 30 min of vitals a day, 30 days | about 5.4 million rows, 540 MB raw, about 45 MB compressed | estimate from the seed ratio |
| Free tier | 750 MB | compression plus 90-day retention keeps this comfortable |

## Queries worth knowing

| Question | Where | Reads |
|---|---|---|
| Today's quests | `db/quests.js` `listForDay` | `quests` by `(user_id, date)` |
| Complete a quest | `routes/quests.js` | one transaction: `quests` and `users` `FOR UPDATE`, `category_progress`, `player_events` |
| Close a game day | `game/endOfDay.js` | one transaction per user: `quests`, `player_events`, `users` |
| Verify vitals | `db/vitals.js` `summary` | raw `vitals_readings` for one quest, `time_bucket('10 seconds')` for the peak |
| Reward chart | `db/vitals.js` `perMinute` | `vitals_per_minute` |
| 30-day chart | `db/events.js` `dailyStats` | `daily_player_stats` joined to a `generate_series` of days |
| History calendar | `db/events.js` `history` | `daily_player_stats.day_result` |
| Tiger Data panel | `db/storage.js` | row counts, `hypertable_compression_stats`, timed summary vs raw query |
