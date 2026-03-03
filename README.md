# WellnessZ — AI-Powered CRM for Wellness Coaches

Full-stack lead management CRM built with **Next.js 16**, **Express**, **MongoDB**, **Redis**, and **Gemini 2.5 Flash**. Designed for solo wellness coaches and small studios to manage leads, track interactions, and generate AI-powered follow-up messages — all from a single, polished interface.

---

## Stack

| Layer       | Tech                                               |
| ----------- | -------------------------------------------------- |
| Frontend    | Next.js 16 (App Router), Tailwind CSS, Recharts    |
| Backend     | Express.js, Mongoose ODM                           |
| Database    | MongoDB Atlas (or local)                           |
| Cache       | Redis (ioredis) — optional, degrades gracefully    |
| AI          | Google Gemini 2.5 Flash (`@google/generative-ai`)  |
| Auth        | JWT (7-day expiry), bcryptjs password hashing      |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **MongoDB** — Atlas cluster or local `mongod` instance
- **Redis** — local `redis-server` (optional — the app works without it)
- **Gemini API Key** — [Get one here](https://aistudio.google.com/apikey)

### 1. Clone & install

```bash
git clone <repo-url> && cd WellnessZ

# Backend
cd server && npm install

# Frontend
cd ../client && npm install
```

### 2. Configure environment

Create `server/.env`:

```env
PORT=5001
MONGO_URI=mongodb://localhost:27017/wellnessz
JWT_SECRET=your_jwt_secret_here
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
GEMINI_API_KEY=your_gemini_api_key
```

> **Note:** If Redis isn't running, the server still starts — caching and rate limiting are skipped silently.

### 3. Run

```bash
# Terminal 1 — Backend
cd server && npm run dev      # nodemon on :5001

# Terminal 2 — Frontend
cd client && npm run dev      # Next.js on :3000
```

Open [http://localhost:3000](http://localhost:3000). Register an account and start adding leads.

---

## Project Structure

```
WellnessZ/
├── client/                     # Next.js 16 (App Router)
│   └── app/
│       ├── dashboard/page.js   # Analytics dashboard w/ Recharts
│       ├── leads/page.js       # Leads pipeline table
│       ├── leads/[id]/page.js  # Dedicated lead detail + timeline
│       ├── login/page.js       # Auth — login
│       └── register/page.js    # Auth — register
│
└── server/                     # Express API
    ├── models/
    │   ├── User.js             # bcrypt pre-save hook
    │   ├── Lead.js             # Core lead schema
    │   ├── LeadActivity.js     # Timeline events (compound index)
    │   └── AiFollowup.js       # Persisted AI outputs
    ├── routes/
    │   ├── auth.js             # POST /register, /login
    │   ├── dashboard.js        # GET /analytics (cached)
    │   └── leads.js            # Full CRUD + timeline + AI
    ├── lib/
    │   ├── redis.js            # ioredis wrapper w/ fallback
    │   └── gemini.js           # Gemini 2.5 Flash integration
    └── middleware/auth.js      # JWT verification
```

---

## Architecture Notes

### Collections & Indexes

The database has four collections. Indexes are chosen to support the exact query patterns used by the API — nothing speculative.

| Collection       | Key Fields                                                    | Indexes                                                                 |
| ---------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `users`          | `name`, `email`, `password`, `createdAt`                      | `{ email: 1 }` — unique, for login lookups                             |
| `leads`          | `name`, `phone`, `source`, `status`, `tags[]`, `nextFollowUpAt`, `assignedTo` | Default `_id` — queries are filtered in-memory (low volume per user)   |
| `leadactivities` | `leadId`, `type`, `content`, `createdBy`, `createdAt`         | **`{ leadId: 1, createdAt: -1 }`** — compound, powers cursor pagination |
| `aifollowups`    | `leadId`, `whatsappMessage`, `callScript[]`, `objectionHandler`, `createdBy` | `{ leadId: 1 }` — lookup by lead                                       |

> **Why the compound index matters:** The timeline query filters on `leadId` and sorts by `createdAt DESC`. Without `{ leadId: 1, createdAt: -1 }`, MongoDB would need to do a full collection scan + in-memory sort for every pagination request. With the compound index, it's a single B-tree range scan — O(log n) regardless of how deep into the timeline the user scrolls.

### Caching Strategy Overview

```
┌──────────────────────────────────────────────────────────┐
│                     Redis                     │
├──────────────┬───────────────────────────────────────────┤
│  Dashboard   │  Cache aggregated analytics for 60s       │
│  Caching     │  Key: dashboard:{userId}:{YYYY-MM-DD}     │
│              │  Prevents repeated $facet + $group queries │
├──────────────┼───────────────────────────────────────────┤
│  AI Rate     │  INCR + EXPIRE counter per user            │
│  Limiting    │  Key: ai_ratelimit:{userId}  TTL: 3600s   │
│              │  Hard cap: 5 AI generations per hour       │
├──────────────┼───────────────────────────────────────────┤
│  Fallback    │  App works without Redis — caching is      │
│              │  skipped, rate limiting is bypassed         │
└──────────────┴───────────────────────────────────────────┘
```

### Timeline Cursor Pagination

The activity timeline uses **cursor-based pagination** instead of skip/offset. This performs well at scale because MongoDB doesn't need to scan and discard rows.

The `LeadActivity` model has a **compound index**:

```js
leadActivitySchema.index({ leadId: 1, createdAt: -1 });
```

This is the critical index that makes the timeline query efficient. It covers both the filter (`leadId`) and the sort/cursor (`createdAt: -1`) in a single B-tree scan. The query pattern:

```js
LeadActivity.find({ leadId, createdAt: { $lt: cursor } })
  .sort({ createdAt: -1 })
  .limit(limit)
```

The `nextCursor` returned to the client is the `createdAt` timestamp of the last document in the batch. The client passes it back as `?cursor=<ISO timestamp>` to fetch the next page. No offset tracking, no page numbers, no performance cliff at depth.

### Dashboard Aggregations

The `/api/dashboard/analytics` endpoint runs **four MongoDB aggregations in parallel** via `Promise.all`:

1. **Funnel + Conversion** — single `$facet` pipeline to get status distribution and conversion rate in one pass
2. **Overdue Follow-ups** — counts leads where `nextFollowUpAt < now` and status is not terminal
3. **Top Sources** — grouped source counts
4. **7-Day Activity Graph** — `$dateToString`-grouped activity counts

The frontend pads the activity graph to always show 7 days, so even a single data point renders as a full chart.

---

## Redis Strategy

Redis is used for two distinct purposes, and the app is designed to **work without it**.

### 1. Dashboard Caching (`lib/redis.js`)

The analytics endpoint caches the full response for **60 seconds** using a per-user, per-day key:

```
Key:    dashboard:{userId}:{YYYY-MM-DD}
TTL:    60 seconds
```

This prevents repeated heavy aggregation queries when a user refreshes the dashboard. The daily key component ensures stale data from yesterday doesn't leak into today's view.

### 2. AI Rate Limiting (`routes/leads.js`)

The AI follow-up generation endpoint is rate-limited to **5 requests per user per hour** using Redis `INCR` + `EXPIRE`:

```
Key:    ai_ratelimit:{userId}
TTL:    3600 seconds (1 hour, set on first request)
```

Each request increments the counter. If `INCR` returns > 5, the request is rejected with `429 Too Many Requests`. The TTL is set only on the first increment (`current === 1`) so the window doesn't slide.

### Graceful Degradation

The Redis client (`lib/redis.js`) is wrapped in try/catch with `maxRetriesPerRequest: 1` and a retry strategy that gives up after 3 attempts. If Redis is down:
- Dashboard queries hit MongoDB directly (no cache)
- AI rate limiting is bypassed
- The app continues to function normally

---

## API Reference

All endpoints (except auth) require a `Bearer` token in the `Authorization` header.

### Auth

| Method | Endpoint              | Description     |
| ------ | --------------------- | --------------- |
| POST   | `/api/auth/register`  | Create account  |
| POST   | `/api/auth/login`     | Get JWT token   |

### Leads

| Method | Endpoint                          | Description                |
| ------ | --------------------------------- | -------------------------- |
| GET    | `/api/leads`                      | List leads (filterable)    |
| GET    | `/api/leads/:id`                  | Single lead                |
| POST   | `/api/leads`                      | Create lead                |
| PATCH  | `/api/leads/:id`                  | Update lead                |
| DELETE | `/api/leads/:id`                  | Delete lead                |
| GET    | `/api/leads/:id/timeline`         | Paginated activities       |
| POST   | `/api/leads/:id/activities`       | Log an activity            |
| POST   | `/api/leads/:id/ai-followup`      | Generate AI follow-up      |

### Dashboard

| Method | Endpoint                      | Description                |
| ------ | ----------------------------- | -------------------------- |
| GET    | `/api/dashboard/analytics`    | Aggregated analytics       |

---

## Example `curl` Requests

**Register a new user:**
```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Ashhar", "email": "ash@example.com", "password": "secret123"}'
```

**Create a lead (use the token from register/login response):**
```bash
curl -X POST http://localhost:5001/api/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_token>" \
  -d '{
    "name": "Priya Sharma",
    "phone": "+91-9876543210",
    "source": "Instagram",
    "status": "NEW",
    "tags": ["yoga", "premium"]
  }'
```

**Generate AI follow-up for a lead:**
```bash
curl -X POST http://localhost:5001/api/leads/<lead_id>/ai-followup \
  -H "Authorization: Bearer <your_token>"
```

---

## Design Decisions

- **No ORM abstraction** — Mongoose is used directly. For a CRM of this scale, an extra abstraction layer adds complexity without benefit.
- **Cursor over offset** — The timeline can grow unbounded. Offset pagination degrades at depth; cursor pagination is O(log n) via the compound index.
- **Redis is optional** — A deployed Redis instance shouldn't be a hard requirement for local development. The app needs to be runnable with just `npm run dev`.
- **Gemini 2.5 Flash** — Chosen over GPT for the structured JSON output mode (`responseMimeType: "application/json"`) which eliminates parsing failures.
- **No component library** — All UI is built with Tailwind utility classes directly. No shadcn, no Radix, no runtime CSS-in-JS. Keeps the bundle lean and the styling explicit.

---

## License

MIT
