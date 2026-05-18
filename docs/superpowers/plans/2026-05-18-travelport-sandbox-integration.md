# Travelport Sandbox Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an isolated, read-only prototype that authenticates to the Travelport JSON API sandbox and returns real flight-search results, without touching the live search/booking flow.

**Architecture:** New `travelport` service module (OAuth2 token fetch+cache, flight search, pure response→compact mapper) + two new isolated routes (`/api/travelport/health`, `/api/travelport/test-search`). Optional `TRAVELPORT_*` config mirrors the existing `chat`/`sentry` graceful-when-unset pattern. Credentials absent → `503`; upstream/auth failure → `502` + Sentry. Sandbox/pre-production only.

**Tech Stack:** Node 20 (global `fetch`), Fastify 4 (ESM), Zod, `node:test`/`node:assert`, Sentry (already wired). Deploy: Railway auto-deploy on push to `main`. Spec: `docs/superpowers/specs/2026-05-18-travelport-sandbox-integration-design.md`.

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `backend/src/config.js` | Modify | Add optional `TRAVELPORT_*` to `envSchema`; add `config.travelport` block with `enabled` flag |
| `backend/.env.example` | Modify | Document `TRAVELPORT_*` vars |
| `backend/src/services/travelport.js` | Create | OAuth token fetch+cache; `searchFlights()`; pure exported `mapOffersToCompact()`; typed errors |
| `backend/src/schemas/travelport.js` | Create | Zod query schema for `test-search` |
| `backend/src/routes/travelport.js` | Create | `GET /travelport/health`, `GET /travelport/test-search` (graceful 503 / 502+Sentry) |
| `backend/server.js` | Modify | Register `travelportRoutes` under `/api` (after `setErrorHandler`) |
| `backend/test/fixtures/travelport-search.sample.json` | Create | Real sample air-search response captured from Travelport docs/sandbox (Task 1) |
| `backend/test/travelport.mapper.test.js` | Create | `node:test` unit tests for `mapOffersToCompact` against the fixture |
| `backend/test/travelport.routes.test.js` | Create | `node:test` route tests via `fastify.inject` (503 when disabled; 400 on bad query) |

---

## Task 1: Confirm the Travelport JSON API contract (research — no code)

**Files:**
- Create: `backend/test/fixtures/travelport-search.sample.json`
- Create (notes): `docs/superpowers/plans/travelport-api-notes.md`

The exact OAuth + air-search request/response shape MUST come from official docs, not memory.

- [ ] **Step 1: Fetch the official Travelport JSON API references**

Use `WebFetch` on these (follow links as needed):
- `https://support.travelport.com/webhelp/uapi/uAPI.htm` (legacy ref, for orientation only)
- `https://developer.travelport.com/` → Travelport JSON API ("Travelport+") docs
- Specifically locate: (a) OAuth2 token endpoint + grant type + body params; (b) Air search request (Catalog Product Offerings / "Air Search") endpoint path + JSON body; (c) the required HTTP headers (Accept, Content-Type, `Authorization: Bearer`, and any access-group / PCC / branch header); (d) a full sample air-search **response** JSON.

- [ ] **Step 2: Record exact facts to `docs/superpowers/plans/travelport-api-notes.md`**

Write down verbatim, no guessing:
```
OAUTH: method, token URL path, grant_type, body fields (client_id, client_secret, username, password, scope?), token TTL field name
SEARCH: HTTP method, full path (relative to base), required headers (exact names), request JSON body skeleton (origin, destination, departureDate, ADT pax, cabin=economy)
RESPONSE: JSON path to the list of priced offers; per-offer JSON paths for: flight/segment number, marketing carrier code+name, origin IATA, destination IATA, departure datetime, arrival datetime, total price amount + currency, available seats (if present)
```

- [ ] **Step 3: Save a real sample response as the test fixture**

Copy a complete sample air-search response (from the docs' examples or a sandbox call) into `backend/test/fixtures/travelport-search.sample.json`. It must contain at least one priced offer with the fields listed above. This file is the source of truth for the mapper test.

- [ ] **Step 4: Commit**

```bash
cd /d/Airguide && git add docs/superpowers/plans/travelport-api-notes.md backend/test/fixtures/travelport-search.sample.json && git commit -m "docs(travelport): record confirmed JSON API contract + sample fixture"
```

---

## Task 2: Optional config block

**Files:**
- Modify: `backend/src/config.js`
- Modify: `backend/.env.example`

- [ ] **Step 1: Add `TRAVELPORT_*` to `envSchema`**

In `backend/src/config.js`, inside the `z.object({ ... })` passed to `envSchema`, add after the `CHAT_MODEL` line:

```js
  ,
  // Travelport (sandbox прототайп) — optional. Бүгд байхгүй бол
  // /api/travelport/* нь 503 буцаана (chat/sentry-тэй ижил graceful).
  TRAVELPORT_OAUTH_URL: z.string().url().optional(),
  TRAVELPORT_BASE_URL: z.string().url().optional(),
  TRAVELPORT_CLIENT_ID: z.string().optional(),
  TRAVELPORT_CLIENT_SECRET: z.string().optional(),
  TRAVELPORT_USERNAME: z.string().optional(),
  TRAVELPORT_PASSWORD: z.string().optional(),
  TRAVELPORT_PCC: z.string().optional(),
  TRAVELPORT_ENV: z.enum(['sandbox', 'production']).default('sandbox')
```

(Note: the existing object ends with `CHAT_MODEL: z.string().default('claude-sonnet-4-6')` — replace that line's trailing `})` so the new keys are inside the object. Concretely: change `  CHAT_MODEL: z.string().default('claude-sonnet-4-6')\n});` to `  CHAT_MODEL: z.string().default('claude-sonnet-4-6'),` then the block above, then `});`.)

- [ ] **Step 2: Add the `travelport` block to the exported `config` object**

In `backend/src/config.js`, inside `export const config = { ... }`, add after the `chat: { ... }` block:

```js
  ,
  travelport: (() => {
    const req = [
      parsed.TRAVELPORT_OAUTH_URL, parsed.TRAVELPORT_BASE_URL,
      parsed.TRAVELPORT_CLIENT_ID, parsed.TRAVELPORT_CLIENT_SECRET,
      parsed.TRAVELPORT_USERNAME, parsed.TRAVELPORT_PASSWORD,
      parsed.TRAVELPORT_PCC
    ];
    return {
      enabled: req.every(v => typeof v === 'string' && v.length > 0),
      env:          parsed.TRAVELPORT_ENV,
      oauthUrl:     parsed.TRAVELPORT_OAUTH_URL,
      baseUrl:      parsed.TRAVELPORT_BASE_URL,
      clientId:     parsed.TRAVELPORT_CLIENT_ID,
      clientSecret: parsed.TRAVELPORT_CLIENT_SECRET,
      username:     parsed.TRAVELPORT_USERNAME,
      password:     parsed.TRAVELPORT_PASSWORD,
      pcc:          parsed.TRAVELPORT_PCC
    };
  })()
```

(The existing `chat` block ends with `};` then `}`. Add a comma after the chat block's closing `}` and insert the above before the final `}` of the `config` object.)

- [ ] **Step 3: Document vars in `.env.example`**

Append to `backend/.env.example`:

```
# ----- Travelport (sandbox прототайп) — optional, байхгүй бол /api/travelport 503 -----
# Travelport Developer Portal-аас sandbox/pre-production эрх авна.
TRAVELPORT_ENV=sandbox
TRAVELPORT_OAUTH_URL=
TRAVELPORT_BASE_URL=
TRAVELPORT_CLIENT_ID=
TRAVELPORT_CLIENT_SECRET=
TRAVELPORT_USERNAME=
TRAVELPORT_PASSWORD=
TRAVELPORT_PCC=
```

- [ ] **Step 4: Verify config loads and is disabled by default**

Run: `cd /d/Airguide/backend && node -e "import('./src/config.js').then(m => console.log('enabled=', m.config.travelport.enabled, 'env=', m.config.travelport.env))"`
Expected: `enabled= false env= sandbox` (no crash, no `process.exit`).

- [ ] **Step 5: Commit**

```bash
cd /d/Airguide && git add backend/src/config.js backend/.env.example && git commit -m "feat(travelport): optional config block (graceful when unset)"
```

---

## Task 3: Pure response mapper (TDD)

**Files:**
- Create: `backend/src/services/travelport.js`
- Test: `backend/test/travelport.mapper.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/test/travelport.mapper.test.js`. Derive the `expected` values BY READING the real `backend/test/fixtures/travelport-search.sample.json` saved in Task 1 (use its actual first offer's values — replace the placeholder values below with the real ones from the fixture):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mapOffersToCompact } from '../src/services/travelport.js';

const sample = JSON.parse(readFileSync(
  fileURLToPath(new URL('./fixtures/travelport-search.sample.json', import.meta.url)), 'utf8'
));

test('mapOffersToCompact returns a non-empty compact array', () => {
  const out = mapOffersToCompact(sample);
  assert.ok(Array.isArray(out));
  assert.ok(out.length >= 1);
});

test('each compact item has the expected shape', () => {
  const [f] = mapOffersToCompact(sample);
  assert.equal(typeof f.flight, 'string');
  assert.equal(typeof f.airline, 'string');
  assert.equal(typeof f.route, 'string');
  assert.equal(typeof f.depart, 'string');
  assert.equal(typeof f.arrive, 'string');
  assert.ok(f.economy_mnt === null || typeof f.economy_mnt === 'number');
  assert.ok(f.seats_left === null || typeof f.seats_left === 'number');
});

test('maps the first offer from the real fixture', () => {
  const [f] = mapOffersToCompact(sample);
  // REPLACE these with the actual first-offer values read from the fixture:
  assert.equal(f.flight, 'REPLACE_WITH_FIXTURE_FLIGHT_NUMBER');
  assert.equal(f.route.includes('→'), true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /d/Airguide/backend && node --test test/travelport.mapper.test.js`
Expected: FAIL — `Cannot find module ... services/travelport.js` or `mapOffersToCompact is not a function`.

- [ ] **Step 3: Implement the mapper (minimal)**

Create `backend/src/services/travelport.js` with ONLY the mapper for now. Adjust the JSON accessor paths to match the real fixture and the paths recorded in `travelport-api-notes.md` (Travelport+ JSON API "CatalogProductOfferings" response). Use defensive optional chaining so a missing field yields `null`, never a throw:

```js
/**
 * services/travelport.js — Travelport JSON API (sandbox прототайп)
 *
 * API contract: docs/superpowers/plans/travelport-api-notes.md
 * (Task 1-д албан ёсны баримтаас баталгаажуулсан).
 */

/**
 * Travelport air-search хариуг манай товч хэлбэрт хөрвүүлнэ.
 * ЦЭВЭР функц — сүлжээ хөндөхгүй, алдаа шиднэхгүй (дутуу талбар → null).
 *
 * NOTE: Доорх замуудыг Task 1-ийн fixture болон api-notes-тай тулгаж
 * тааруул. Travelport+ JSON: ихэвчлэн
 *   root.CatalogProductOfferingsResponse.CatalogProductOfferings.CatalogProductOffering[]
 * @param {object} api  Travelport-ийн JSON хариу
 * @returns {Array<{flight,airline,route,depart,arrive,economy_mnt,business_mnt,seats_left}>}
 */
export function mapOffersToCompact(api) {
  const root =
    api?.CatalogProductOfferingsResponse?.CatalogProductOfferings?.CatalogProductOffering
    ?? api?.CatalogProductOfferings?.CatalogProductOffering
    ?? api?.offers
    ?? [];
  const offers = Array.isArray(root) ? root : [];

  return offers.map((o) => {
    const seg =
      o?.ProductBrandOptions?.[0]?.flightRefs
        ? o
        : o?.segments?.[0] ?? o?.Segment?.[0] ?? o;
    const carrierCode = seg?.carrier ?? seg?.marketingCarrier ?? o?.carrier ?? null;
    const carrierName = seg?.carrierName ?? o?.carrierName ?? carrierCode ?? '';
    const flightNum   = seg?.number ?? seg?.flightNumber ?? o?.flightNumber ?? '';
    const orig        = seg?.origin ?? seg?.from ?? o?.origin ?? '';
    const dest        = seg?.destination ?? seg?.to ?? o?.destination ?? '';
    const depart      = seg?.departure ?? seg?.departureTime ?? o?.departure ?? null;
    const arrive      = seg?.arrival ?? seg?.arrivalTime ?? o?.arrival ?? null;

    const price =
      o?.BestCombinablePrice?.TotalPrice
      ?? o?.totalPrice?.amount
      ?? o?.price?.total
      ?? null;
    const seats =
      o?.availableSeats
      ?? o?.Seats
      ?? null;

    return {
      flight:  carrierCode ? `${carrierCode}${flightNum}` : String(flightNum || ''),
      airline: carrierName ? `${carrierCode ?? ''} ${carrierName}`.trim() : String(carrierCode ?? ''),
      route:   `${orig} → ${dest}`,
      depart:  depart ? String(depart) : null,
      arrive:  arrive ? String(arrive) : null,
      economy_mnt:  price != null ? Number(price) : null,
      business_mnt: null,
      seats_left:   seats != null ? Number(seats) : null
    };
  });
}
```

- [ ] **Step 4: Reconcile accessors with the real fixture, run the test until green**

Run: `cd /d/Airguide/backend && node --test test/travelport.mapper.test.js`
Edit the accessor paths in `mapOffersToCompact` and the `REPLACE_WITH_*` assertions in the test so they match the actual `travelport-search.sample.json`. Iterate until: Expected PASS (all 3 tests).

- [ ] **Step 5: Commit**

```bash
cd /d/Airguide && git add backend/src/services/travelport.js backend/test/travelport.mapper.test.js && git commit -m "feat(travelport): TDD response→compact mapper against real fixture"
```

---

## Task 4: OAuth token cache + `searchFlights` (network)

**Files:**
- Modify: `backend/src/services/travelport.js`

- [ ] **Step 1: Add the token cache + `getAccessToken()`**

Append to `backend/src/services/travelport.js`. Use the exact OAuth URL/grant/body recorded in `travelport-api-notes.md`:

```js
import { config } from '../config.js';

class TravelportError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

let _token = null;          // { value, expiresAt }

async function getAccessToken() {
  if (_token && Date.now() < _token.expiresAt - 30_000) return _token.value;

  // Body fields per travelport-api-notes.md (confirmed in Task 1).
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id:     config.travelport.clientId,
    client_secret: config.travelport.clientSecret,
    username:      config.travelport.username,
    password:      config.travelport.password
  });

  let res;
  try {
    res = await fetch(config.travelport.oauthUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body,
      signal: AbortSignal.timeout(15_000)
    });
  } catch (e) {
    throw new TravelportError('TRAVELPORT_AUTH_FAILED', `OAuth network error: ${e.message}`);
  }
  if (!res.ok) {
    throw new TravelportError('TRAVELPORT_AUTH_FAILED', `OAuth HTTP ${res.status}`);
  }
  const j = await res.json();
  const ttlSec = Number(j.expires_in ?? 1800);
  _token = { value: j.access_token, expiresAt: Date.now() + ttlSec * 1000 };
  if (!_token.value) throw new TravelportError('TRAVELPORT_AUTH_FAILED', 'No access_token in response');
  return _token.value;
}

export const _resetTokenForTests = () => { _token = null; };
```

- [ ] **Step 2: Add `searchFlights()`**

Append to `backend/src/services/travelport.js`. Use the exact path/headers/body recorded in `travelport-api-notes.md`:

```js
/**
 * Travelport sandbox-аас нислэг хайх (1 том, economy, нэг чиглэл).
 * @param {{from:string,to:string,departureDate:string}} p  IATA, IATA, YYYY-MM-DD
 */
export async function searchFlights({ from, to, departureDate }) {
  const token = await getAccessToken();

  // Request body per travelport-api-notes.md (Catalog Product Offerings).
  const reqBody = {
    CatalogProductOfferingsQueryRequest: {
      CatalogProductOfferingsRequest: {
        '@type': 'CatalogProductOfferingsRequestAir',
        maxNumberOfUpsellsToReturn: 0,
        contentSourceList: ['GDS'],
        PassengerCriteria: [{ '@type': 'PassengerCriteria', number: 1, passengerTypeCode: 'ADT' }],
        SearchCriteriaFlight: [{
          '@type': 'SearchCriteriaFlight',
          departureDate,
          From: { value: from },
          To: { value: to }
        }],
        SearchModifiersAir: { '@type': 'SearchModifiersAir', CabinPreference: [{ '@type': 'CabinPreference', cabin: 'Economy', preferenceType: 'Preferred' }] }
      }
    }
  };

  let res;
  try {
    res = await fetch(`${config.travelport.baseUrl}/catalog/search/catalogproductofferings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'XAUTH_TRAVELPORT_ACCESSGROUP': config.travelport.pcc
      },
      body: JSON.stringify(reqBody),
      signal: AbortSignal.timeout(30_000)
    });
  } catch (e) {
    throw new TravelportError('TRAVELPORT_UPSTREAM', `Search network error: ${e.message}`);
  }
  if (!res.ok) {
    throw new TravelportError('TRAVELPORT_UPSTREAM', `Search HTTP ${res.status}`);
  }
  const json = await res.json();
  return mapOffersToCompact(json);
}
```

(The endpoint path, header name `XAUTH_TRAVELPORT_ACCESSGROUP`, and request body `@type` values are the documented Travelport+ shapes — confirm/adjust to the exact values in `travelport-api-notes.md` from Task 1. The mapper is already fixture-verified.)

- [ ] **Step 3: Verify the module imports cleanly**

Run: `cd /d/Airguide/backend && node -e "import('./src/services/travelport.js').then(m=>console.log(typeof m.searchFlights, typeof m.mapOffersToCompact))"`
Expected: `function function`

- [ ] **Step 4: Re-run mapper tests (no regression)**

Run: `cd /d/Airguide/backend && node --test test/travelport.mapper.test.js`
Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
cd /d/Airguide && git add backend/src/services/travelport.js && git commit -m "feat(travelport): OAuth token cache + searchFlights (sandbox)"
```

---

## Task 5: Query schema + routes (TDD route gating)

**Files:**
- Create: `backend/src/schemas/travelport.js`
- Create: `backend/src/routes/travelport.js`
- Test: `backend/test/travelport.routes.test.js`

- [ ] **Step 1: Create the query schema**

Create `backend/src/schemas/travelport.js`:

```js
import { z } from 'zod';

/** GET /travelport/test-search — query */
export const travelportSearchQuerySchema = z.object({
  from:           z.string().trim().length(3).transform(s => s.toUpperCase()),
  to:             z.string().trim().length(3).transform(s => s.toUpperCase()),
  departure_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'departure_date must be YYYY-MM-DD')
});
```

- [ ] **Step 2: Write the failing route test**

Create `backend/test/travelport.routes.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import travelportRoutes from '../src/routes/travelport.js';

async function buildApp() {
  const app = Fastify();
  await app.register(travelportRoutes, { prefix: '/api' });
  return app;
}

test('GET /api/travelport/health returns enabled flag', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/api/travelport/health' });
  assert.equal(r.statusCode, 200);
  const j = r.json();
  assert.equal(typeof j.enabled, 'boolean');
  await app.close();
});

test('GET /api/travelport/test-search → 503 when disabled (no creds)', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/api/travelport/test-search?from=ULN&to=ICN&departure_date=2026-07-01' });
  assert.equal(r.statusCode, 503);
  assert.equal(r.json().error.code, 'TRAVELPORT_DISABLED');
  await app.close();
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd /d/Airguide/backend && node --test test/travelport.routes.test.js`
Expected: FAIL — `Cannot find module ... routes/travelport.js`.

- [ ] **Step 4: Implement the routes**

Create `backend/src/routes/travelport.js`:

```js
/**
 * routes/travelport.js — Travelport sandbox прототайп (тусгаарласан)
 *
 * GET /travelport/health        → { enabled, env }
 * GET /travelport/test-search   → mapped sandbox results | 503 | 502
 * Одоогийн /api/flights/search, захиалгад ОГТ хүрэхгүй.
 */
import { config } from '../config.js';
import { travelportSearchQuerySchema } from '../schemas/travelport.js';
import { searchFlights } from '../services/travelport.js';
import { captureException } from '../sentry.js';

export default async function travelportRoutes(fastify) {
  fastify.get('/travelport/health', async () => ({
    enabled: config.travelport.enabled,
    env: config.travelport.env
  }));

  fastify.get('/travelport/test-search', async (req, reply) => {
    if (!config.travelport.enabled) {
      reply.code(503);
      return { error: { code: 'TRAVELPORT_DISABLED', message: 'Travelport credentials not configured' } };
    }
    const q = travelportSearchQuerySchema.parse(req.query); // bad query → ZodError → global 400
    try {
      const results = await searchFlights({
        from: q.from, to: q.to, departureDate: q.departure_date
      });
      return { source: `travelport-${config.travelport.env}`, count: results.length, results };
    } catch (err) {
      captureException(err, { method: req.method, url: req.url, ip: req.ip });
      reply.code(502);
      return { error: { code: err.code || 'TRAVELPORT_UPSTREAM', message: 'Travelport request failed' } };
    }
  });
}
```

- [ ] **Step 5: Run the route tests to verify they pass**

Run: `cd /d/Airguide/backend && node --test test/travelport.routes.test.js`
Expected: PASS (both tests). `health` returns `enabled:false`; `test-search` returns `503 TRAVELPORT_DISABLED`.

- [ ] **Step 6: Commit**

```bash
cd /d/Airguide && git add backend/src/schemas/travelport.js backend/src/routes/travelport.js backend/test/travelport.routes.test.js && git commit -m "feat(travelport): test-search + health routes (TDD; graceful 503)"
```

---

## Task 6: Wire routes into the server

**Files:**
- Modify: `backend/server.js`

- [ ] **Step 1: Add the import**

In `backend/server.js`, in the Phase 6 routes import area (next to `import chatRoutes from './src/routes/chat.js';`), add:

```js
import travelportRoutes from './src/routes/travelport.js';
```

- [ ] **Step 2: Register the route bundle**

In `backend/server.js`, immediately AFTER the line `await fastify.register(chatRoutes, { prefix: '/api' });`, add:

```js
// Travelport sandbox прототайп (тусгаарласан — амьд хайлт/захиалгад хүрэхгүй)
await fastify.register(travelportRoutes, { prefix: '/api' });
```

(Note: route registration is already AFTER `fastify.setErrorHandler(...)` because the handler-ordering fix moved the error handler above all routes — Zod 400 / Sentry capture will apply to these routes correctly.)

- [ ] **Step 3: Syntax-check the server entrypoint**

Run: `cd /d/Airguide/backend && node --check server.js`
Expected: no output, exit 0.

- [ ] **Step 4: Run the full backend test suite (no regression)**

Run: `cd /d/Airguide/backend && node --test test/`
Expected: all tests PASS (Travelport mapper + routes included; existing tests unaffected).

- [ ] **Step 5: Commit**

```bash
cd /d/Airguide && git add backend/server.js && git commit -m "feat(travelport): register isolated routes under /api"
```

---

## Task 7: Deploy + verify graceful mode in production (no credentials yet)

**Files:**
- (none committed — temporary verification script only)

- [ ] **Step 1: Push to deploy**

```bash
cd /d/Airguide && git push origin main
```
Railway auto-deploys `main`. Wait ~140s for build+deploy.

- [ ] **Step 2: Create the temporary verification script**

Create `D:\Airguide\_tp_verify.py` (NOT committed):

```python
import json, urllib.request, urllib.error
API = "https://airguide-production-ec87.up.railway.app"
def g(url):
    try:
        with urllib.request.urlopen(url, timeout=20) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()
s,b = g(f"{API}/api/travelport/health"); print("health", s, b)
s,b = g(f"{API}/api/travelport/test-search?from=ULN&to=ICN&departure_date=2026-07-01"); print("search", s, b[:200])
s,b = g(f"{API}/api/health"); print("MAIN health (regression)", s, b[:120])
s,b = g(f"{API}/api/flights/search?from=ULN&to=ICN&departure_date=2026-06-01"); print("MAIN flights (regression)", s, ("ok" if '"outbound"' in b else b[:120]))
```

- [ ] **Step 3: Run it after the deploy completes**

Run: `cd /d/Airguide && python -X utf8 _tp_verify.py && rm -f _tp_verify.py`
Expected:
- `health 200 {"enabled": false, "env": "sandbox"}`
- `search 503 {"error":{"code":"TRAVELPORT_DISABLED",...}}`
- `MAIN health (regression) 200 ...` (live site unaffected)
- `MAIN flights (regression) 200 ok` (live search unaffected)

- [ ] **Step 4: Commit (none — script deleted)**

No commit; confirm `git status` shows clean working tree.

---

## Task 8: Credentials guidance + live sandbox verification (user-dependent)

**Files:**
- (none committed — temporary verification script only)

- [ ] **Step 1: Produce step-by-step credential instructions (Mongolian) for the user**

Deliver a plain-language message instructing the user to:
1. Go to the Travelport Developer Portal (`https://developer.travelport.com/`), sign in with their Travelport account, request/open **Travelport JSON API** sandbox / pre-production access.
2. Copy: OAuth token URL, API base URL, client id, client secret, API username, password, PCC.
3. In Railway → `Airguide` (backend) → Variables, add `TRAVELPORT_OAUTH_URL`, `TRAVELPORT_BASE_URL`, `TRAVELPORT_CLIENT_ID`, `TRAVELPORT_CLIENT_SECRET`, `TRAVELPORT_USERNAME`, `TRAVELPORT_PASSWORD`, `TRAVELPORT_PCC`, `TRAVELPORT_ENV=sandbox` (same flow they used for `ANTHROPIC_API_KEY`/`SENTRY_DSN`). Secrets stay in Railway, never pasted into chat.

- [ ] **Step 2: After the user confirms vars are set, re-verify live**

Recreate `D:\Airguide\_tp_verify.py` (Task 7 Step 2) and run:
`cd /d/Airguide && python -X utf8 _tp_verify.py && rm -f _tp_verify.py`
Expected once credentials are configured:
- `health 200 {"enabled": true, "env": "sandbox"}`
- `search 200 {"source":"travelport-sandbox","count":<n>,"results":[ ... real flights ... ]}`
- Both MAIN regression lines still `200` (live site unaffected).

- [ ] **Step 3: If `search` returns 502**

Inspect Sentry (already wired) for the captured `TRAVELPORT_AUTH_FAILED` / `TRAVELPORT_UPSTREAM` error; reconcile the OAuth body / endpoint path / headers / request `@type` values in `backend/src/services/travelport.js` against `docs/superpowers/plans/travelport-api-notes.md`; fix, commit, redeploy, re-run Step 2.

- [ ] **Step 4: Final commit (code only, if Step 3 required fixes)**

```bash
cd /d/Airguide && git add backend/src/services/travelport.js && git commit -m "fix(travelport): align request to confirmed sandbox API contract" && git push origin main
```

---

## Self-Review

**1. Spec coverage:**
- OAuth2 auth + token cache → Task 4 ✓
- Read-only flight search (econ, 1 ADT) → Task 4 ✓
- Map to compact shape → Task 3 (TDD) ✓
- `/travelport/health` + `/travelport/test-search` → Task 5 ✓
- Graceful `503` when unset → Task 5 (TDD) ✓; verified live Task 7 ✓
- `502` + Sentry on failure → Task 5 (route catch + `captureException`) ✓
- Optional `TRAVELPORT_*` config mirroring chat/sentry → Task 2 ✓
- `.env.example` documented → Task 2 ✓
- Server wiring after `setErrorHandler` → Task 6 ✓
- No change to live search/booking/frontend → Tasks isolated; regression checks Task 7/8 ✓
- API specifics confirmed from official docs, not guessed → Task 1 (research + fixture) ✓
- Non-goals (booking/ticketing, feature-flag into main search) → not in any task ✓ (correctly excluded)

**2. Placeholder scan:** The only intentional "REPLACE_WITH_*" tokens are in Task 3 Step 1, explicitly instructed to be filled from the real fixture before the test is finalized (Task 3 Step 4 closes this) — this is a TDD reconciliation step against real data, not an unresolved plan placeholder. No "TBD/TODO/handle edge cases" vagueness elsewhere.

**3. Type consistency:** `mapOffersToCompact(api)` defined Task 3, consumed in `searchFlights` Task 4 and tested Task 3 — consistent. `searchFlights({from,to,departureDate})` defined Task 4, called with the same keys in route Task 5. `config.travelport.{enabled,env,oauthUrl,baseUrl,clientId,clientSecret,username,password,pcc}` defined Task 2, used Tasks 4–5 consistently. Error codes `TRAVELPORT_DISABLED`/`TRAVELPORT_AUTH_FAILED`/`TRAVELPORT_UPSTREAM` consistent across Tasks 4–5/8. Route paths `/travelport/health` + `/travelport/test-search` (under `/api` prefix) consistent Tasks 5–8.

No issues requiring changes.
