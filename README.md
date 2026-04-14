# Looper backend (`looper-agentic`)

Monorepo for the **Looper** platform backend: **REST API** (source of truth), **business web dashboard**, **Telegram agent** (LangChain.js), and minimal shared types.

The customer **React Native** app lives next to this repo: **[`../LooperMobile`](../LooperMobile/)**.

**Roadmap / status:** [docs/PRODUCT_STATUS.md](docs/PRODUCT_STATUS.md) — vision, shipped vs pending, open decisions.

## Layout

| Path              | Description                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `apps/api`        | Railway + MongoDB (Mongoose): users, businesses, bookings, agent routes, link tokens      |
| `apps/dashboard`  | Vite + React: business login, profile, services, specialists, availability, booking inbox |
| `apps/agent`      | Telegram bot + LangChain tool-calling; calls the API with `X-Internal-Key`                |
| `packages/shared` | Shared TypeScript types (minimal)                                                         |

## Prerequisites

- **Node.js** ≥ 20
- **MongoDB** — [Atlas](https://www.mongodb.com/atlas) or any reachable cluster (`MONGODB_URI`)
- **npm** (workspaces)

Optional: Telegram bot token + OpenAI API key for `apps/agent`.

## Quick start

```bash
cd /path/to/LooperProject/looper-agentic
npm install
```

### API

```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env (MONGODB_URI, JWT_SECRET, AGENT_INTERNAL_KEY, CORS_ORIGIN)
npm run dev:api
```

`GET http://127.0.0.1:3000/health` → `{ "ok": true }`.

### Seed (optional)

Inserts several realistic businesses (restaurants, spas, barbershops) across the Bay Area and Brooklyn, each with services and **the same sample slots for the next 7 UTC days** (so Telegram `getAvailabilityBulk` has data). Re-running removes prior seed rows (`contactInfo` ending in `@seed.looper.dev`) and legacy **Demo Bistro**.

```bash
npm run seed -w @looper/api
```

Dashboard login after seed: **`owner+kinjo@seed.looper.dev`** / **`password123`** (Kinjo Ramen). Demo customer phone: **`+10000000000`**.

### Dashboard

```bash
npm run dev:dashboard
```

Open **http://localhost:5173** (keep the API running; Vite proxies `/v1` to the API).

### Telegram agent (optional)

```bash
cp apps/agent/.env.example apps/agent/.env
# Set API_BASE_URL, AGENT_INTERNAL_KEY (match API), TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, TELEGRAM_BOT_USERNAME
npm run dev:agent
```

## Mobile app

See **[`../LooperMobile/README.md`](../LooperMobile/README.md)** — configure `src/config.ts` to reach this API (`http://127.0.0.1:3000` on iOS sim, `http://10.0.2.2:3000` on Android emulator, or your LAN IP on a physical device).

## Production

```bash
npm run build
```

Run the API from compiled output with `npm run start -w @looper/api` after building `@looper/api` if you use `dist/`.

## Architecture

```text
LooperMobile ──HTTP──► API ◄──HTTP── Dashboard
                             │
                             ▼
                          MongoDB

Telegram ──► Agent ──HTTP (tools)──► API
```

## Deploy to Railway (HTTPS API for real devices)

See **[docs/RAILWAY.md](docs/RAILWAY.md)** for step-by-step Railway setup, env vars, and pointing **LooperMobile** at the public URL.

```bash
npm run lint
```
