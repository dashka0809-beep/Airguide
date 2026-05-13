# Архитектур

> Air Guide системийн дизайны зарчим, тех стак, бүрэлдэхүүн хэсгүүд, dataflow.

---

## 1. Дизайны зарчим

Air Guide-ийг бүтээхдээ дараах **5 зарчмыг** дагана:

1. **Хөнгөн (Lightweight)** — Шаардлагагүй framework, build step, dependency хэрэглэхгүй.
2. **Хурдан (Fast)** — Backend p95 < 100ms, frontend FCP < 1s.
3. **Ойлгомжтой (Simple)** — Шинэ хөгжүүлэгч 1 өдөрт repo-г бүрэн ойлгох.
4. **Босоо scale (Vertical first)** — 10k MAU хүртэл нэг VPS дээр явна.
5. **Боломжтой үед SQL ашиглах** — Бизнес логик-ыг view/trigger-т шилжүүлэх (app code-ыг хөнгөн байлгах).

---

## 2. Тех стак

### 2.1 Frontend

| Зүйл | Сонголт | Тайлбар |
|---|---|---|
| Markup | HTML5 | Semantic landmarks, ARIA |
| Style | CSS (Custom Properties + Grid/Flex) | Tailwind/SCSS байхгүй |
| Script | Vanilla JS, ES modules | `<script type="module">` |
| HTTP client | Fetch API | axios байхгүй |
| Routing | Multi-page (.html файлууд) | SPA байхгүй |
| Build | **Байхгүй** | `npx serve` шууд |

**Хэмжээ хязгаар:** Үндсэн page < 100 KB gzipped.

### 2.2 Backend

| Зүйл | Сонголт | Тайлбар |
|---|---|---|
| Runtime | Node.js 20 LTS | ESM, native fetch, `node --watch` |
| Framework | **Fastify 4** | Express-ээс ~2× хурдан, schema-first |
| DB driver | `pg` (node-postgres) | Native Postgres driver, prepared statements |
| Validation | `zod` | Type-safe input |
| Auth | `jose` (JWT) + `bcrypt` | Stateless |
| Logger | `pino` (Fastify default) | JSON, маш хурдан |
| Test | `node:test` + `supertest` | Standard lib |

**ORM байхгүй шалтгаан:** Запрос гар бичих нь схем дээр гүн ойлголт өгөх, performance тааруулахад хялбар. Ирээдүйд хэрэг гарвал `kysely` (query builder) нэмж болно.

### 2.3 Database

| Зүйл | Сонголт |
|---|---|
| Engine | **PostgreSQL 16** |
| Encoding | `UTF8` |
| Collation | `en_US.UTF-8` (хайлтад `pg_trgm` extension) |
| Extensions | `pg_trgm` (fuzzy search), `pgcrypto` (UUID/random), `pg_stat_statements` |
| Migration tool | `dbmate` (нэг бинарь, dep-гүй) |
| Backup | Railway автомат daily snapshot (7 хоног retention) |

### 2.4 Infrastructure

| Зүйл | Сонголт |
|---|---|
| Hosting | **Railway** (PaaS) |
| Compute | Railway service (Node.js auto-build via Nixpacks) |
| Database | Railway Postgres add-on |
| TLS | Railway автомат (Let's Encrypt) |
| Domain | Railway-н үнэгүй subdomain эсвэл custom domain |
| DNS | Cloudflare эсвэл шууд CNAME Railway руу |
| Email | Resend (free tier) |
| Logs/Metrics | Railway dashboard (native), Sentry error tracking |

---

## 3. Дээд түвшний бүтэц

```
┌─────────────────────────────────────────────────────────────┐
│                          Internet                            │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS (443)
                               ▼
              ┌────────────────────────────────────┐
              │       Railway Edge (TLS, CDN)      │
              └────────┬───────────────────────────┘
                       │ Private network
              ┌────────┴────────────┐
              │                     │
              ▼                     ▼
   ┌────────────────────┐   ┌──────────────────────┐
   │  Frontend service  │   │  API service         │
   │  (Caddy static)    │   │  Node.js + Fastify   │
   │  airguide.mn       │   │  api.airguide.mn     │
   └────────────────────┘   └──────────┬───────────┘
                                       │ private DATABASE_URL
                                       ▼
                            ┌──────────────────────┐
                            │  Postgres 16         │
                            │  (Railway add-on)    │
                            │  daily snapshot      │
                            └──────────────────────┘
```

**Railway service бүр нэг процесс:**
- Frontend — static files-ыг Caddy эсвэл `serve` (хөнгөн)
- API — Node.js Fastify (1 instance, шаардлагатай үед `replicas: 2`)
- Postgres — Railway managed

**Local development бүр нэг процесс:**
- `npm run dev` → Node.js :3000
- `psql` → Local Postgres :5432

---

## 4. Бүрэлдэхүүн хэсгүүд

### 4.1 Frontend modules

| Module | Үүрэг |
|---|---|
| `index.html` | Landing + хайлтын форм |
| `search.html` | Хайлтын үр дүн |
| `booking.html` | Захиалга үүсгэх 3 алхам |
| `confirmation.html` | E-ticket үзүүлэх |
| `admin/` | Оператор panel |
| `js/api.js` | Fetch wrapper, error handling |
| `js/i18n.js` | MN/EN dictionary |
| `js/auth.js` | JWT хадгалах, refresh |

### 4.2 Backend modules

| Module | Үүрэг |
|---|---|
| `server.js` | Fastify entry, plugin бүртгэл |
| `db.js` | `pg` Pool |
| `routes/airports.js` | Airport autocomplete |
| `routes/flights.js` | Search, detail |
| `routes/bookings.js` | Create, retrieve, cancel |
| `routes/payments.js` | QPay webhook, status |
| `routes/auth.js` | Login, refresh, logout |
| `routes/admin/*` | RBAC-тэй удирдлага |
| `plugins/auth.js` | JWT verify decorator |
| `plugins/error.js` | Алдаа format |
| `services/booking.js` | Захиалга үүсгэх transaction |
| `services/email.js` | E-ticket илгээх |

---

## 5. Гол dataflow

### 5.1 Нислэг хайх

```
[Browser]
   │  GET /api/flights/search?from=ULN&to=ICN&date=2026-06-15
   ▼
[Fastify route: flights.js]
   │  1. Zod validation
   │  2. pg query → v_flight_details
   │  3. Хариу JSON
   ▼
[Browser] (frontend/js/search.js → DOM render)
```

**Query (хялбаршуулсан, Postgres):**
```sql
SELECT * FROM v_flight_details
WHERE origin_code = $1 AND dest_code = $2
  AND departure_time::date = $3
  AND status = 'scheduled'
ORDER BY departure_time;
```
**Index ашиглалт:** `idx_flights_route (origin_airport_id, destination_airport_id, departure_time)` — covering index.

### 5.2 Захиалга үүсгэх

```
[Browser]
   │  POST /api/bookings
   │  { customer: {...}, passengers: [...], flight_id, class_type }
   ▼
[Fastify route: bookings.js]
   │  Zod validation
   ▼
[Service: services/booking.js]
   │  BEGIN TRANSACTION
   │    1. INSERT customers (UPSERT by phone)
   │    2. INSERT bookings (booking_code = generateCode())
   │    3. INSERT passengers (× N)
   │    4. INSERT tickets (× N)  ← trigger -1 seat
   │    5. SELECT booking_code
   │  COMMIT
   ▼
[Хариу] { booking_code, payment_url }
```

**ACID баталгаа:** `tickets.INSERT` нь trigger-ээр `flights.available_seats--` хийдэг тул transaction дотор хийх ёстой; concurrent захиалгын үед `SELECT … FOR UPDATE` ашиглана. Postgres-ийн `RETURNING` clause-аар insert-ийн ID-г шууд авна (`LAST_INSERT_ID()` шаардлагагүй).

### 5.3 Төлбөр (QPay)

```
[Browser]                                      [QPay API]
   │  GET /api/payments/qpay/invoice          │
   │  ───────────────────────────────────────►│
   │                                          │  invoice үүсгэх
   │  ◄───────────────────────────────────────│
   │  { qr_code, invoice_id }                 │
   │  ▼                                       │
   │  QR-ийг харуулах                         │
   │  (хэрэглэгч банкны апп-аар төлбөрлөнө)   │
   │                                          │
   │                                       [QPay → callback]
   │                                          │  POST /api/payments/qpay/webhook
   │                                          ▼
   │                                  [bookings.status = 'confirmed']
   │                                          │
   │  (polling эсвэл SSE)                     │
   │  GET /api/bookings/:code                 │
   │  status: 'confirmed' → e-ticket илгээх   │
```

---

## 6. Аюулгүй байдал

| Threat | Mitigation |
|---|---|
| SQL injection | `pg` parameterized queries (`$1, $2` placeholders) |
| XSS | Frontend-д `textContent` ашиглах; `innerHTML` бараг хэрэглэхгүй |
| CSRF | JWT in `Authorization` header (cookie-гүй) |
| Brute-force | `@fastify/rate-limit` 100 req/min/IP |
| Password storage | bcrypt cost 12 |
| Secrets | Railway environment variables (git-д **орохгүй**) |
| TLS | Railway auto Let's Encrypt, HSTS header app түвшинд |
| Headers | CSP, X-Frame-Options, Referrer-Policy (Fastify plugin) |
| PII | passport, register_no — log-д орохгүй (pino redact) |

---

## 7. Performance target

| Metric | Target | Хэмжих хэрэгсэл |
|---|---|---|
| Backend p50 | < 30 ms | pino-log + ELK эсвэл grafana |
| Backend p95 | < 100 ms | мөн |
| Frontend FCP | < 1.0 s | Lighthouse |
| Frontend LCP | < 2.0 s | Lighthouse |
| DB query p99 | < 50 ms | `pg_stat_statements` |
| Concurrent users | 500 хүртэл нэг VPS дээр | k6 load test |

---

## 8. Стак сонголтын үндэслэл

**Яагаад Fastify, Express биш?**
- Fastify нь request/s 2× илүү (benchmark).
- Schema-first (JSON Schema/Zod) автомат валидаци, OpenAPI generate.
- Plugin система cleaner.

**Яагаад Postgres, MySQL биш?**
- `tickets UNIQUE(passenger_id, flight_id) WHERE status='issued'` гэх **partial unique index** Postgres-д шууд ажилладаг (double-ticket урьдчилан сэргийлэх).
- `jsonb` нь нэмэлт metadata (booking_metadata, fare_rules) хадгалахад flexible.
- `pg_trgm`-аар fuzzy search ("улаа" → "Ulaanbaatar") маш хялбар.
- CTE, window function — analytical query цэвэрхэн.
- Transactional DDL — migration atomic, fail safe.
- Railway managed Postgres нь maintenance free.

**Яагаад ORM байхгүй?**
- Схем нь нарийн (10 хүснэгт, view, trigger) → SQL гар бичиж сурахад тус.
- ORM-н N+1, lazy loading, identity map зэрэг "далд" зүйл байхгүй.
- DBA debug хийхэд хялбар.

**Яагаад React/Vue биш?**
- Landing + хайлт + захиалга = 5–10 хуудас. SPA шаардлагагүй.
- Build pipeline + CDN + bundler complexity байхгүй.
- Reload хийх үед state алддаггүй (DOM-ын анхдагч төлөв).

**Яагаад Railway, VPS биш?**
- Phase 5 (deployment) ажил бараг бүрэн арилна — ssh, ufw, systemd, Caddy, log rotation, backup cron гээд ~40 цаг хэмнэгдэнэ.
- Git push → автомат deploy.
- Managed Postgres (daily backup, point-in-time recovery).
- Preview environments PR бүрд.
- Free credit ($5/сар) эхлэхэд хангалттай.

**Яагаад Docker анх удаа байхгүй?**
- Railway Nixpacks-ээр Node-г шууд build хийнэ (Dockerfile хэрэггүй).
- Phase 6+ (self-hosting эсвэл K8s рүү шилжихэд) Docker оруулна.

---

## 9. Ирээдүйн өөрчлөлтийн хэлхээ

| Үе шат | Trigger | Шилжүүлэх руу |
|---|---|---|
| < 1k MAU | — | Railway Hobby plan ($5 service + $5 DB) |
| 1k–10k MAU | Latency Монголд > 200ms | Singapore region руу хатгах, эсвэл local VPS-руу шилжих |
| 10k–100k MAU | DB CPU > 50% | Railway Pro plan, эсвэл self-host (Hetzner + managed Postgres) |
| > 100k MAU | Custom infra | Docker + read replica + CDN |

**Railway-ээс өөр стак руу шилжүүлэх хялбар:** code (Node.js) болон DB (Postgres) хоёулаа стандарт тул `pg_dump` + `git clone` хийгээд хүссэн hosting-руу зөөнө.

---

## 10. Хязгаарлалт ба trade-off

- **SPA байхгүй** → анх удаа реактив UI (drag-drop seat map гэх мэт) хязгаартай. Hyperscript / Alpine.js phase 3 дээр оруулж болно.
- **ORM байхгүй** → joins гар бичих, type safety багатай. Compensate хийхдээ Zod-р DB schema-г mirror хийнэ.
- **Single Railway region** → Singapore-аас Монголд RTT 100–150ms. Phase 6-д CDN эсвэл local edge cache.
- **Email queue байхгүй** → Resend-ийн өөрийн retry-д найдна. Хэрэгцээ гарвал Railway Redis + BullMQ.
- **Railway зардал scale-тэй өсөх** → MAU 10k+ үед managed costs $50+/сар болж магадгүй. Шаардлагатай үед self-host руу шилжих план тодорхой.
