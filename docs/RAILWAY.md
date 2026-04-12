# Deploy Looper backend on Railway

Use this when you want a **public HTTPS API** (e.g. real iPhone hitting prod instead of LAN).

You keep **MongoDB on Atlas** (already `mongodb+srv://...`). Railway only runs **Node** processes.

## What to deploy

| Service | Purpose |
|---------|---------|
| **API** (`apps/api`) | Required — mobile app + dashboard talk to this |
| **Agent** (`apps/agent`) | Optional — Telegram bot (long polling works on Railway) |
| **Dashboard** | Optional — see [Dashboard on Railway](#dashboard-on-railway) |

## 1. Prepare the repo

- Push **`LooperProject`** (or at least **`looper-agentic`**) to GitHub/GitLab if Railway should deploy from git.
- In Railway, you will set **Root Directory** to **`looper-agentic`** (when the repo root is `LooperProject`).

## 2. Create the API service

1. Open [Railway](https://railway.app) → **New Project** → **Deploy from GitHub repo** (or **Empty Project** → **GitHub**).
2. Select the repo, then open the new service → **Settings**:
   - **Root Directory:** `looper-agentic`
3. **Settings → Build** (or use **Nixpacks / Railpack** defaults and override):
   - **Build command:**

     ```bash
     npm install && npm run build -w @looper/shared && npm run build -w @looper/api
     ```

   - **Start command:**

     ```bash
     npm run start -w @looper/api
     ```

4. **Settings → Networking → Generate Domain** (or add a custom domain).  
   Note the public URL, e.g. `https://looper-api-production-xxxx.up.railway.app`.

5. **Variables** (same names as `apps/api/.env.example`):

   | Variable | Notes |
   |----------|--------|
   | `MONGODB_URI` | Your Atlas URI (include `/looper` or DB name before `?`) |
   | `JWT_SECRET` | Long random string (signing tokens) |
   | `AGENT_INTERNAL_KEY` | Long random string (agent + internal routes); **save it** for the agent service |
   | `CORS_ORIGIN` | `*` for quick tests, or your dashboard URL(s), comma-separated |
   | `PORT` | **Do not set** — Railway injects this automatically |

6. **Deploy** and wait for the build. Check logs for errors.

7. Verify:

   ```bash
   curl https://YOUR-RAILWAY-URL/health
   ```

   Expect: `{"ok":true}`

## 3. Point the mobile app at Railway

In **`LooperMobile/src/config.ts`**, set production `API_BASE` to your Railway URL **with no trailing slash**, e.g.:

```ts
export const API_BASE = __DEV__
  ? Platform.select({ ... })!
  : 'https://looper-api-production-xxxx.up.railway.app';
```

Or use a single URL for both dev and prod while testing:

```ts
export const API_BASE = 'https://YOUR-RAILWAY-URL';
```

Rebuild/install the app on the device. All requests go to `https://.../v1/...` over TLS (fine for iOS ATS).

## 4. Optional: Telegram agent on Railway

Add a **second service** in the same Railway project, same repo:

- **Root Directory:** `looper-agentic`
- **Build command:**

  ```bash
  npm install && npm run build -w @looper/agent
  ```

- **Start command:**

  ```bash
  npm run start -w @looper/agent
  ```

- **Variables:**

  | Variable | Value |
  |----------|--------|
  | `API_BASE_URL` | `https://YOUR-RAILWAY-API-URL` (no trailing slash) |
  | `AGENT_INTERNAL_KEY` | **Same** as on the API service |
  | `TELEGRAM_BOT_TOKEN` | From BotFather |
  | `OPENAI_API_KEY` | Your key |
  | `OPENAI_MODEL` | e.g. `gpt-4o-mini` |
  | `TELEGRAM_BOT_USERNAME` | Without `@` |

Long polling is fine; no webhook URL required for a first deployment.

## 5. Dashboard on Railway

The dashboard’s `fetch('/v1/...')` calls are **relative** — they only work when the UI is served from the same host as the API (or via dev proxy).

**Practical options:**

- **A.** Run the dashboard **locally** (`npm run dev -w @looper/dashboard`) and temporarily point API calls at Railway (needs a small code change: a `VITE_API_BASE_URL` prefix for all `fetch` URLs), **or**
- **B.** Deploy API + dashboard behind one public origin using a **reverse proxy** (more setup), **or**
- **C.** Use **only the mobile app** against Railway for now.

If you want **A** with env-based API URL, add something like:

```ts
const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
// fetch(`${BASE}/v1/...`)
```

Then build with `VITE_API_BASE_URL=https://your-api.up.railway.app` and deploy the `dist/` folder as a **static** Railway service (or any static host).

## 6. Troubleshooting

| Problem | What to check |
|--------|----------------|
| Build fails on `@looper/shared` | Root directory is **`looper-agentic`**, not repo root |
| App crashes on start | Logs: missing `MONGODB_URI` / Atlas IP allowlist (`0.0.0.0/0` for Atlas “anywhere” in dev) |
| Mobile still “network failed” | Exact `API_BASE`, HTTPS, no typo; Railway service **running** and domain **public** |
| CORS in browser | Set `CORS_ORIGIN` to the site origin or `*` |
| 502 / crash loop | Wrong **start** command or `PORT` — let Railway set `PORT` |

## 7. Security checklist (prod)

- Strong `JWT_SECRET` and `AGENT_INTERNAL_KEY` (no defaults).
- Atlas: dedicated DB user with least privilege; rotate password if it was ever committed.
- Tighten `CORS_ORIGIN` when you know your dashboard URL.
- Consider Railway **private networking** only if you add more internal services later.
