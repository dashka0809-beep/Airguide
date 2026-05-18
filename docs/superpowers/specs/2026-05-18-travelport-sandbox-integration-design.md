# Travelport Sandbox Integration — Design Spec

**Date:** 2026-05-18
**Status:** Approved (design); pending implementation plan
**Approach:** A — Isolated sandbox prototype (does not touch live search/booking)

---

## Энгийн тайлбар (Plain-language summary, MN)

Travelport-ийн **туршилтын (sandbox)** орчноос **жинхэнэ нислэгийн хайлт**
татдаг **жижиг, тусдаа** туршилтын хэсэг нэмнэ. Одоогийн ажиллаж байгаа
сайт (хайлт, захиалга, харагдах байдал) **огт өөрчлөгдөхгүй**. Нэвтрэх
эрх (credentials) орохгүй бол шинэ хэсэг graceful `503` буцаана — апп
унахгүй. Зорилго: Travelport үнэхээр ажиллаж байгааг бага эрсдэлээр батлах.

---

## 1. Goal & Scope

**Goal:** Prove, end-to-end against the Travelport sandbox / pre-production
environment, that the Airguide backend can authenticate to the Travelport
JSON API and retrieve real flight-search results — without disturbing the
live production site.

**In scope:**
- OAuth2 authentication to Travelport JSON API (token fetch + in-memory cache)
- One read-only operation: air shopping / flight search (origin, destination,
  departure date; economy, 1 adult as the minimal slice)
- Mapping the Travelport response into the project's existing compact flight
  shape (so it is familiar and reusable later)
- Two new isolated endpoints and a graceful "disabled" mode

**Non-goals (YAGNI — explicitly out of scope for this prototype):**
- Booking, pricing confirmation, ticketing, PNR creation via Travelport
- Replacing or modifying the existing `/api/flights/search` or booking flow
- NDC-specific flows, multi-passenger / multi-class pricing nuances
- Caching beyond the OAuth token
- Frontend changes (the website's appearance does not change)
- Production Travelport environment (sandbox/pre-production only)

## 2. Architecture & Components

All new code is **additive and isolated**. No existing file's behavior
changes except: `config.js` (new optional block), `server.js` (register one
new route bundle), `.env.example` (document new vars).

| Component | Path | Responsibility |
|---|---|---|
| Travelport client | `backend/src/services/travelport.js` | OAuth token mgmt (fetch + cache + refresh on expiry); `searchFlights({from,to,departureDate})`; map response → compact shape; never throws app-fatal — surfaces typed errors |
| Travelport routes | `backend/src/routes/travelport.js` | `GET /api/travelport/health` → `{enabled}`; `GET /api/travelport/test-search?from=&to=&departure_date=` → mapped results or `503` |
| Config | `backend/src/config.js` | New `travelport` block following the existing optional-config pattern (mirrors `chat`/`sentry`): `enabled = Boolean(required creds present)` |
| Server wiring | `backend/server.js` | `await fastify.register(travelportRoutes, { prefix: '/api' })` — registered **after** `setErrorHandler` (ordering bug already fixed) |
| Env template | `backend/.env.example` | Document `TRAVELPORT_*` placeholders + comment |

This mirrors patterns the project already uses (the `chat`/Anthropic and
`sentry` optional integrations): conditional config, graceful no-op /
`503` when not configured, isolated module + isolated route.

## 3. Configuration (env vars — user-supplied, like ANTHROPIC_API_KEY)

```
TRAVELPORT_OAUTH_URL     # OAuth2 token endpoint (pre-prod) — from Travelport docs
TRAVELPORT_BASE_URL      # JSON API base URL (pre-prod) — from Travelport docs
TRAVELPORT_CLIENT_ID     # OAuth2 client id
TRAVELPORT_CLIENT_SECRET # OAuth2 client secret
TRAVELPORT_USERNAME      # API username (if grant type requires it)
TRAVELPORT_PASSWORD      # API password (if grant type requires it)
TRAVELPORT_PCC           # Pseudo City Code / branch
TRAVELPORT_ENV=sandbox   # marker; only sandbox/pre-prod for this prototype
```

- Validation via Zod in `config.js`, all **optional**.
- `config.travelport.enabled = true` only when the minimum required set is
  present. Otherwise endpoints return `503 TRAVELPORT_DISABLED` (graceful).
- Exact var names/grant type confirmed against official Travelport developer
  documentation during implementation (see Risks).

## 4. Data Flow

```
Client → GET /api/travelport/test-search?from=ULN&to=ICN&departure_date=2026-07-01
  → travelport.js:
      1. ensureToken(): if cached token valid → reuse; else POST OAuth → cache (with expiry)
      2. POST air-search request to Travelport sandbox JSON API
      3. map response → compact: [{ flight, airline, route, depart, arrive, economy, seats }]
  → JSON { source: "travelport-sandbox", count, results }
```

OAuth token cached in module memory with expiry; refreshed on demand.
Long-running server, so no special flush concerns.

## 5. Error Handling

| Situation | Response |
|---|---|
| Credentials not configured | `503 { error: { code: "TRAVELPORT_DISABLED" } }` (graceful, like `/api/chat`) |
| OAuth failure | `502 { error: { code: "TRAVELPORT_AUTH_FAILED" } }` + Sentry capture |
| Travelport API error / timeout | `502 { error: { code: "TRAVELPORT_UPSTREAM" } }` + Sentry capture; safe message (no secrets/PII) |
| Bad query params | `400 VALIDATION_ERROR` via existing global Zod handler |

Sentry already works end-to-end (handler-ordering + flush fixes shipped), so
upstream failures are observable. Secrets never logged.

## 6. Testing

- Temporary Python script (same style as the audit scripts used this session,
  not committed) hitting the deployed `/api/travelport/health` and
  `/api/travelport/test-search` once sandbox credentials are configured.
- Assert: `health.enabled === true`; `test-search` returns ≥1 real flight for
  a known sandbox route/date; `503` cleanly when creds absent.
- No automated test depends on live Travelport (credentials/network external).

## 7. Risks & Dependencies (stated honestly)

- **Credentials/access risk (primary):** Travelport sandbox/API access is
  granted via the Travelport Developer Portal and may require a developer
  agreement. The integration **code is fully usable without credentials**
  (returns `503`), so nothing in the codebase is blocked; only the live
  sandbox verification depends on the user obtaining credentials. The user
  has a MyTravelport account (agency portal) — API/developer credentials are
  separate and must be obtained; assistant will provide step-by-step guidance.
- **API-spec accuracy:** Exact OAuth grant type, token URL, base URL,
  required headers (e.g. access group / PCC), and the air-search request
  schema will be confirmed from **official Travelport developer
  documentation** (WebFetch) during implementation — not guessed. The design
  is structured so these specifics are localized to `travelport.js`.
- **Mapping fidelity:** Sandbox data shapes may differ from production; the
  mapper is intentionally minimal and tolerant.

## 8. Out-of-Scope / Future (not built now)

- Wiring Travelport into `/api/flights/search` behind a feature flag
  (Approach B) — a natural follow-up if the prototype succeeds.
- Booking / ticketing via Travelport (needs production creds + ticketing
  authority + certification).
