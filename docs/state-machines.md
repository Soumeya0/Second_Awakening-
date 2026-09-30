# State machines

How each piece of game state moves, and which route or job moves it. Rules live in
[`backend/src/game/rules.js`](../backend/src/game/rules.js); transitions happen in the routes and in
[`backend/src/game/endOfDay.js`](../backend/src/game/endOfDay.js).

## Player lifecycle

```mermaid
stateDiagram-v2
  [*] --> New: first authenticated request creates the users row
  New --> Onboarded: POST /api/onboarding with 10+ categories
  Onboarded --> Playing: first day of quests generated

  state Playing {
    [*] --> DayOpen
    DayOpen --> DayOpen: complete quests
    DayOpen --> InRift: day closed without 4 required quests
    DayOpen --> DayOpen: day cleared, next game day starts
    InRift --> RiftOver: timer runs out
    RiftOver --> DayOpen: POST /api/rift/leave
  }
```

`New` players can only call `/api/me`, `/api/onboarding`, and `/api/voice`; every other route answers `409 Finish onboarding first`.

## Quest status

```mermaid
stateDiagram-v2
  [*] --> pending: generated for the game day
  pending --> active: POST start, sets started_at and ends_at
  active --> pending: POST cancel, Give up
  active --> active: POST vitals, readings stored
  active --> active: photo rejected, 422, attempts + 1
  active --> completed: POST complete, timer done or demo mode
  pending --> failed: day closes
  active --> failed: day closes
  completed --> [*]
  failed --> [*]
```

- Completing before `ends_at` returns `409` outside demo mode.
- `completed` is final: the completion transaction locks the quest row, so a second request gets `409 Quest already completed`.
- Quests are unique per `(user, date, category)`, so a category never repeats in one day.

## Quest verification by proof type

```mermaid
stateDiagram-v2
  [*] --> CheckProof: POST complete

  CheckProof --> PhotoReceived: PHOTO with a photo file
  CheckProof --> Summarize: VITALS or FOCUS
  CheckProof --> Honor: HONOR

  PhotoReceived --> NoGemini: Gemini not configured
  PhotoReceived --> AskGemini: Gemini configured
  AskGemini --> Approved: photo matches
  AskGemini --> Rejected: photo does not match
  AskGemini --> GeminiError: request failed

  Summarize --> NoReadings: 0 stored samples
  Summarize --> Checked: rules.verifyVitals on the SQL summary

  Rejected --> [*]: 422, quest stays active
  NoGemini --> Rewarded: verified
  Approved --> Rewarded: verified
  GeminiError --> Rewarded: accepted, not verified
  NoReadings --> Rewarded: not verified
  Checked --> Rewarded: verified or not
  Honor --> Rewarded: not verified
  Rewarded --> [*]: one transaction, quest completed
```

Verification rules for stored readings:

| Category | Verified when |
|---|---|
| strength, running, cycling | peak 10-second average bpm is at least 15 above the first-minute average |
| yoga | breathing in the last minute is slower than in the first; without breathing data, average bpm below the start |
| FOCUS categories | average focus score is at least 0.7 |

Unverified quests still pay their reward, so a camera hiccup never costs the player their day.

## Game day

```mermaid
stateDiagram-v2
  [*] --> Open: game_date set, 4 required + 1 bonus quest
  Open --> Open: POST quests/add, once everything listed is done
  Open --> Judge: midnight cron in APP_TIMEZONE, or POST demo/next-day
  Judge --> cleared: all 4 required completed
  Judge --> partial: at least one quest completed
  Judge --> missed: nothing completed

  cleared --> NextDay: failed_days_in_row = 0
  partial --> Banished
  missed --> Banished
  Banished --> NextDay: Rift losses applied, banished chapter
  NextDay --> Open: game_date + 1, extra_today = 0, new quests
```

Each close runs in one transaction per user: open quests become `failed`, a `day_closed` event is written at noon of that game day, and the user row moves to the next date. If the server was down for several days, the job closes each missed day in order.

## The Rift

```mermaid
stateDiagram-v2
  [*] --> Free: rift is null
  Free --> Trapped: day not cleared, sendToRift
  Trapped --> Trapped: POST rift/seen, dashboard stops redirecting
  Trapped --> Released: rift.until passes
  Released --> Released: GET /api/me plays the returned chapter once
  Released --> Free: POST rift/leave
  Trapped --> Trapped: another failed day, longer banishment
```

- Losses per failed day: 150 EXP (levels can drop, never below level 1) and 25 coins (never below 0).
- Duration: 1 hour for each failed day in a row. A Ward potion (`items.shield`) is used up and cuts it to 30 minutes.
- `POST /api/rift/leave` answers `409 Still trapped` until `rift.until` has passed.

## Level and rank

```mermaid
stateDiagram-v2
  [*] --> Gaining
  Gaining --> Gaining: gain EXP, bars not all full
  Gaining --> LevelUp: xp at least 1000 and every chosen bar at 10
  LevelUp --> Gaining: level + 1, xp - 1000, every bar reset to 0
  LevelUp --> RankUp: new level crosses a rank threshold
  RankUp --> Gaining: rankUp chapter
  Gaining --> LevelDown: Rift takes more EXP than the level holds
  LevelDown --> Gaining: level - 1, xp + 1000
```

```mermaid
stateDiagram-v2
  direction LR
  E --> D: level 5
  D --> C: level 10, Gates open
  C --> B: level 20
  B --> A: level 35
  A --> S: level 50
  S --> A: Rift losses
  A --> B: Rift losses
  B --> C: Rift losses
  C --> D: Rift losses
  D --> E: Rift losses
```

## Category bar

```mermaid
stateDiagram-v2
  [*] --> Filling: count 0
  Filling --> Filling: quest completed, count + 1
  Filling --> Full: count reaches 10
  Full --> Full: more quests, stays at 10
  Full --> Filling: level-up resets every bar to 0
```

## Vitals recording on the frontend

```mermaid
stateDiagram-v2
  [*] --> Resolving: VITALS quest timer opens
  Resolving --> LocalOnly: backend off or quest not found
  Resolving --> Streaming: server quest started

  state Streaming {
    [*] --> Buffering
    Buffering --> Uploading: every 5 seconds
    Uploading --> Buffering: saved
    Uploading --> Buffering: failed, readings kept for retry, max 600
  }

  LocalOnly --> Finishing: player completes
  Streaming --> Finishing: player completes, last batches sent
  Resolving --> Discarded: Give up
  Streaming --> Discarded: Give up
  LocalOnly --> Discarded: Give up
  Finishing --> [*]: reward popup chart, Tiger Data series if uploaded
  Discarded --> [*]
```

## Story chapter audio

```mermaid
stateDiagram-v2
  [*] --> none: ElevenLabs not configured
  [*] --> pending: chapter created, audio requested in the background
  pending --> ready: synthesized or found in the audio cache
  pending --> failed: ElevenLabs error
  none --> [*]
  ready --> [*]
  failed --> [*]
```

The frontend polls `GET /api/story` while a chapter is `pending`.
