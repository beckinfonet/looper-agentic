# Looper — product status & roadmap

Single place for **vision**, **what shipped**, **what’s next**, and **open inputs** from the team.  
**Stack:** `apps/api` (Fastify + MongoDB), `apps/agent` (Telegram + LangChain), `apps/dashboard` (Vite), customer app **LooperMobile** (same API; sibling repo).

### Build order (locked)

1. **Mobile owner MVP first** — LooperMobile business auth + owner flows (mirror dashboard) on the same API.  
2. **Reminders + customer ping** — implement **after** owner MVP, on **automated setup** (e.g. Railway cron / worker + idempotent sends), not as a manual-only path.

### Channels for business notifications (locked for now)

- **Telegram only** for owner-facing alerts (book/modify/cancel, later reminders and ping). Email/SMS/in-app can layer in later.

---

## Vision (agreed direction)

| Area                              | Direction                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Clients**                       | One API + one DB; **mobile first**; web/dashboard gains **more options later**.                                                                                                                                                                                                                                                                    |
| **Channels**                      | **Mobile + Telegram** now; **WhatsApp** after Meta approval.                                                                                                                                                                                                                                                                                       |
| **Scheduling**                    | **15-minute** grid; tables/rooms **not** blocked for arbitrary full service length; **~2h default turn** (configurable later); bot can clarify **exact time** with the customer.                                                                                                                                                                   |
| **Staff**                         | If the business maintains technician schedules → customer can **choose** a technician; else **“any available”**.                                                                                                                                                                                                                                   |
| **Timezone**                      | **Business location → business timezone** (needs explicit **IANA** `Europe/Paris`, etc.—raw address string is not enough for math).                                                                                                                                                                                                                |
| **Owner data (by business type)** | **Gather as much relevant, structured information as the vertical allows** — requirements differ by type (restaurant vs spa vs clinic, etc.). Rich, accurate owner-supplied data **helps customers compare and book confidently** and **keeps the chatbot from stalling** (fewer unknowns; less guessing; answers come from tools, not invention). |
| **Bot**                           | Answer as much as possible from **data exposed via API/tools** (structured first; richer text/RAG later if needed). Same contract: if owners did not supply it, the bot should say so or offer booking/search—not fabricate.                                                                                                                       |
| **Payments**                      | **Stripe** + optional **prepay** later. **Product:** **confirmations**, **T−24h / T−1h reminders**, **customer → business ping** — **delivery** of reminders/ping follows **Phase 3** after owner MVP + worker (see build order above).                                                                                                            |

---

## Current state (repository reality)

### Customers

- **LooperMobile:** phone register, browse businesses, services, book from availability, my bookings, Telegram deep link.
- **Telegram bot:** linked user, tools for search, business details, availability (single + bulk), bookings; schemas tuned for OpenAI tool JSON.

### Business owners

- **Dashboard:** business auth (`/v1/business-auth/*`), profile, **services**, **specialists**, **availability** (PUT = explicit **slot** list per date / optional specialist scope), booking inbox.
- **LooperMobile:** business **register / login** against the same API (`/v1/business-auth/register`, `/v1/business-auth/login`); JWT stored separately from the customer token. **OwnerHome** and related screens are a **partial** step toward the full owner MVP (parity with dashboard owner tools is still Phase 1).

### Authentication (MVP)

- **No external identity provider** — the API issues **JWTs** signed with **`JWT_SECRET`** (`apps/api/.env`); clients send `Authorization: Bearer <token>`.
- **Customers:** `POST /v1/users/register` with phone + name (creates or updates user by phone; **no separate login route** — MVP “sign-in” is the same call). Access token payload `typ: user` (**30d** expiry in API code).
- **Business owners:** `POST /v1/business-auth/register` (creates `Business` + `BusinessUser`, bcrypt password hash) and `POST /v1/business-auth/login`. Access token payload `typ: business` + `businessId` (**7d** expiry in API code).
- **Planned:** **Firebase** as the hosted identity provider in a **later phase** (verify Firebase ID tokens on the API and/or align accounts); until then, first-party email/password + JWT is intentional MVP scope.

### Data & rules

- **Availability:** stored **slot ISO strings**; not yet derived from table count + 15m grid + turn rules.
- **Bookings:** `partySize` stored; conflict logic is **per time + specialist lane** (incl. `null` specialist), **not** table-capacity-aware.
- **Reminders / ping / Stripe:** **not implemented**.

---

## Done (recent / notable)

Use git history for detail; high level:

- API: Mongo `MONGODB_DB_NAME`, expanded `/health`, agent **`/v1/agent/search-businesses`** (optional type, location fallback, `hours` + `description` in results), **`get-availability-bulk`**, public business detail includes `description` / `hours`.
- Agent: API base URL normalization, fetch error hints, phone / E.164 linking, **plain-Zod tool schemas** (OpenAI JSON Schema–safe), `getBusinessDetails`, `getAvailabilityBulk`, prompts for hours + multi-day availability.
- Seed: realistic multi-city businesses, `description`, **7 days** of sample availability per business.
- Mobile: `getBusiness`, list/detail UI for description; Telegram POST body fix for link tokens; iOS export compliance plist key.

---

## Pending (by phase)

### Phase 1 — Spine (mobile + API)

- [ ] **`Business.timezone`** (IANA) required in owner onboarding / settings; document how mobile collects it (picker vs inferred from address).
- [ ] **Type-aware owner profile:** `Business` type/category drives **required + optional fields** (hours, policies, accessibility, deposit rules, what’s included in a service, etc.—scoped per vertical). Dashboard + **LooperMobile owner MVP** should **prompt completion** (not just a single free-text blurb). Persist structured fields; **expose them on public business detail and agent tools** so customers and the bot share one source of truth.
- [ ] **LooperMobile:** business auth + owner screens mirroring dashboard capabilities (profile, services, specialists, availability)—**same REST API**. *(Auth + early owner UI exist; full parity with dashboard is still open.)*
- [ ] **Agent:** `listSpecialists` (or equivalent) + **`Business` flag** for staff choice (`required` / `optional` / `none`) and prompt updates; tool payloads include **type-specific attributes** once the API stores them.

### Phase 2 — Scheduling engine

- [ ] **15m grid** + **default turn (~2h)** + optional **capacity** per business (or per “table pool”); validate or generate `Availability.slots`.
- [ ] **Booking:** enforce **partySize** vs capacity where defined; clarify **“any available”** vs **named specialist** in `scopeKey` / booking writes.

### Phase 3 — Notifications *(after Phase 1 owner MVP; automated worker)*

- [ ] **On book/modify/cancel:** message **customer + business** via **Telegram** (only channel for v1).
- [ ] **Worker (Railway cron or queue):** **T−24h** and **T−1h** reminders; idempotent sends.
- [ ] **`POST /v1/bookings/:id/ping`** (or similar): customer nudges business; rate limits; optional ack from business.

### Phase 4 — Payments (later)

- [ ] Stripe Checkout / webhooks; link to `bookingId`; prepay gates when enabled.

### Phase 5 — WhatsApp

- [ ] Same agent patterns; Meta Cloud API **after Meta approval** (aligned when that path is live).

---

## Open decisions (fill in as you go)

Short answers here over time remove ambiguity for implementers.

| # | Question | Your answer (when ready) |
|---|-----------|---------------------------|
| 1 | **Default turn length:** global constant vs per-business `defaultTableTurnMinutes`? | *Revisit when ready.* |
| 2 | **“Any available” spa:** book with `specialistId: null` only, or **server auto-assigns** first free specialist? | *Revisit when ready.* |
| 3 | **Business notifications:** Telegram bot to owner, email, SMS, or in-app only for v1? | **Telegram only** for now. |
| 4 | **Timezone collection on mobile:** owner picks from IANA list only, or address + geocode fallback? | *Revisit when ready.* |
| 5 | **Ping / ack:** does business need a **“confirmed on schedule”** boolean visible to customer? | *Revisit when ready.* |
| 6 | **Per-type field matrix:** which **required vs optional** owner fields for each `Business` category (and validation rules)? | *Define incrementally; start with 1–2 verticals you care about first.* |
| 7 | **Hosted identity (post-MVP):** move sign-in to **Firebase** (or keep hybrid)? | **Firebase** when implemented; today = first-party JWT + owner email/password + customer phone register. |

---

## What we need from you (optional, when convenient)

**Locked:** mobile owner MVP first; reminders + ping on automated worker after that; business notifications **Telegram only** for now.

Nothing blocks **starting Phase 1** in code except **#4 (timezone UX)** and **#2 (any-available semantics)**—reasonable defaults exist until you fill the table.

Still helpful later:

- **Vertical field matrix (#6):** as you lock categories, list must-have owner questions per type so onboarding and API stay strict enough for good UX and bot coverage.
- **Linked Telegram per business:** assume owner links same as today for alerts, or document exceptions.
- **Legal / copy:** SMS wording if SMS is added later.
- **Stripe:** test vs live account timing (only when Phase 4 starts).

---

## Maintenance

- After each meaningful release: update **Done** / **Pending** checkboxes and this file’s date in a commit message.
- If scope shifts, edit **Vision** and **Open decisions** first so implementation stays aligned.

*Last compiled from team discussion; edit inline as the single source of truth.*
