# Roadmap

> Air Guide системийг үе шаттайгаар бүтээх төлөвлөгөө. Phase бүр өөрөө ажиллах боломжтой деливерэй.

---

## Тоймтой timeline

| Phase | Хугацаа | Үндсэн үр дүн |
|---|---|---|
| **Phase 0** — Foundation | 1 долоо хоног | Repo цэгцлэх, docs, бүтэц |
| **Phase 1** — Backend API | 2 долоо хоног | Хайлт + захиалга үүсгэх API |
| **Phase 2** — Frontend rewire | 2 долоо хоног | Бодит API дуудаж ажиллах UI |
| **Phase 3** — Payment + e-ticket | 2 долоо хоног | QPay интеграц, имэйл |
| **Phase 4** — Admin panel | 2 долоо хоног | Оператор UI, RBAC |
| **Phase 5** — Production | **2 өдөр** | Railway deploy, custom domain, monitor |

**Нийт ~ 9 долоо хоног (1 хөгжүүлэгчтэй full-time)**.

Railway сонгосны үр дүнд Phase 5 ~1 долоо хоног → 2 өдөр болж бараг бүрэн арилсан.

---

## Phase 0 — Foundation (1 долоо хоног)

**Зорилго:** Шинэ хөгжүүлэгч 1 өдрөөр onboard болохуйц repo.

### Хийх ажил

- [x] Repo clone, structure plan
- [x] Бичиг баримтууд (README, ARCHITECTURE, STRUCTURE, DATABASE, API, SETUP, DEPLOYMENT)
- [ ] `.gitignore`, `LICENSE`, `.editorconfig`
- [ ] `frontend/` хавтас үүсгэж `airguide.html`-г салгасан хувилбараар хуулах:
  - `frontend/index.html` (markup)
  - `frontend/css/{tokens,base,layout,components}.css`
  - `frontend/js/{app,api,i18n}.js`
- [ ] `db/` хавтас үүсгэх (хоосон, Phase 1-д бөглөгдөнө)
- [ ] `backend/` skeleton:
  - `package.json` (Fastify, **pg**, zod, jose, bcrypt, pino)
  - `server.js`, `src/db.js`, `src/config.js`
  - `.env.example`
- [ ] Railway account + project үүсгэх
- [ ] Phase 0 PR merge

### Acceptance criteria

- README уншсан хүн 5 минутад quickstart хийнэ.
- `npm install && npm run dev` ажилладаг (route байхгүй ч 200 OK буцаана).
- Railway-н Postgres add-on connect хийгдсэн.

---

## Phase 1 — Backend API (2 долоо хоног)

**Зорилго:** Frontend нь дуудаж болох REST endpoint-ууд бэлэн.

### Хийх ажил

#### Schema хөрвүүлэлт ба засвар (Phase 1-д заавал)
- [ ] **MySQL → Postgres хөрвүүлэх:** `airguide_database.sql` → `db/schema.sql`
  - `AUTO_INCREMENT` → `GENERATED ALWAYS AS IDENTITY`
  - `ENUM` → `TEXT CHECK (col IN (...))`
  - `DATETIME` → `TIMESTAMPTZ`
  - Trigger syntax → `LANGUAGE plpgsql`
  - `LAST_INSERT_ID()` → `RETURNING id`
- [ ] Extension idэвхжүүлэх: `pg_trgm`, `pgcrypto`, `pg_stat_statements`
- [ ] `db/seed.sql` — sample data Postgres-руу
- [ ] `dbmate` setup, бүх change-ийг migration болгох
- [ ] Migration: `seats` хүснэгт (per-seat inventory)
- [ ] Migration: `tickets` дээр partial unique `UNIQUE(passenger_id, flight_id) WHERE status='issued'` (Postgres native!)
- [ ] Migration: `passengers.passport_no` nullable
- [ ] Migration: `audit_log` хүснэгт
- [ ] Trigger: refund-ийн үед `paid_amount` буурах (`fn_after_payment_change`)
- [ ] Trigram index — `airports.name`, `airports.city` (autocomplete-д)

#### Backend endpoints
- [ ] `GET /airports?q=` (autocomplete)
- [ ] `GET /airlines` (бүх жагсаалт, 1 цаг cache)
- [ ] `GET /flights/search` (covering index ашиглах)
- [ ] `GET /flights/:id`
- [ ] `POST /bookings` (transaction, FOR UPDATE)
- [ ] `GET /bookings/:code`
- [ ] `POST /bookings/:code/cancel`

#### Infrastructure
- [ ] `pg` Pool (limit 10), `DATABASE_URL` ашиглах
- [ ] `zod` schema-аар Fastify route validate
- [ ] `pino` redact PII (passport_no, password)
- [ ] `@fastify/rate-limit` (60 req/min)
- [ ] `@fastify/cors`
- [ ] `@fastify/swagger` (dev only)
- [ ] Алдааны formatter middleware
- [ ] `node:test` test 6 endpoint бүрт

### Acceptance criteria

- Postman collection-оор бүх endpoint амжилттай.
- p95 latency < 100 ms (k6 шалгалт).
- Test coverage > 70%.
- OpenAPI spec `http://localhost:3000/docs` дээр.

---

## Phase 2 — Frontend rewire (2 долоо хоног)

**Зорилго:** Хэрэглэгч бодит хайлт хийж захиалга үүсгэдэг болох.

### Хийх ажил

- [ ] `js/api.js` — Fetch wrapper (timeout, retry, error format)
- [ ] `js/i18n.js` — MN/EN dictionary, `localStorage`
- [ ] `index.html`:
  - Хайлтын форм submit handler
  - Airport autocomplete (debounce 200ms)
  - Огноо валидаци (return ≥ departure)
  - From ↔ To swap товч
- [ ] `search.html` — үр дүн жагсаалт, filter (price, airline, time)
- [ ] `booking.html` — 3-алхамт state machine (passengers → review → pay)
- [ ] `confirmation.html` — booking_code-р harах, polling 5 секунд
- [ ] Mobile responsive шалгалт (320/375/768/1280)
- [ ] Accessibility audit (Lighthouse > 95)
- [ ] `airguide.html`-г устгах

### Acceptance criteria

- Бодит хайлт → захиалга → "pending" төлөв.
- Lighthouse performance > 90, accessibility > 95.
- Бүх texts MN/EN switching ажиллана.
- 320px дэлгэц дээр хэрэглэгдэх.

---

## Phase 3 — Payment + e-ticket (2 долоо хоног)

**Зорилго:** Төлбөр төлж e-ticket авах flow.

### Хийх ажил

#### QPay интеграц
- [ ] QPay sandbox account
- [ ] `services/qpay.js` (auth, invoice, check)
- [ ] `POST /payments/qpay/invoice`
- [ ] `POST /payments/qpay/webhook` (signature verify)
- [ ] `GET /payments/:code/status` (polling)
- [ ] Frontend: QR харах, real-time status update

#### E-ticket
- [ ] PDF template (puppeteer эсвэл `pdfkit`)
- [ ] `services/email.js` — Resend/SendGrid
- [ ] Webhook payment success → email job
- [ ] HTML email template MN/EN

#### Орон зайн дүрэм
- [ ] Cancellation policy engine (`pricing.js`)
- [ ] Refund flow — QPay refund API
- [ ] Refund-ийн trigger DB-д ажиллах шалгах

### Acceptance criteria

- QPay sandbox-аар бүтэн flow ажиллана.
- Төлбөр хийгдсэний дараа e-ticket 30 секунд дотор email рүү ирнэ.
- Cancellation төлбөрийн буцаалт зөв.

---

## Phase 4 — Admin panel (2 долоо хоног)

**Зорилго:** Оператор захиалга, нислэг удирдах.

### Хийх ажил

#### Backend
- [ ] `POST /auth/login`, `/auth/refresh`, `/auth/logout`
- [ ] `plugins/auth.js` — JWT verify, role decorator
- [ ] `GET /admin/bookings` (filter, pagination)
- [ ] `PATCH /admin/bookings/:id` (cancel, refund)
- [ ] CRUD `/admin/flights`
- [ ] `GET /admin/reports/revenue`
- [ ] `audit_log`-д бүх change-ыг бичих

#### Frontend
- [ ] `admin/login.html`
- [ ] `admin/index.html` — KPI dashboard
- [ ] `admin/bookings.html` — table, filter, action
- [ ] `admin/flights.html` — CRUD form
- [ ] `admin/reports.html` — chart (Chart.js нэмэх)

#### Security
- [ ] CSRF тохиргоо
- [ ] Admin route-уудад rate limit
- [ ] Session timeout 30 минут
- [ ] Login attempt log

### Acceptance criteria

- 3 role (admin, manager, agent) тус бүр correct permission-той.
- Manager → flight CRUD; Agent → зөвхөн харах; Admin → бүх.
- `audit_log`-д 100% хяналт.

---

## Phase 5 — Production (2 өдөр)

**Зорилго:** airguide.mn-г Railway дээр deploy + мониторинг.

Railway-ийн ачаар энэ phase бараг бүхэлдээ арилсан. VPS, ssh, systemd, Caddy шаардлагагүй.

### Хийх ажил

#### 1-р өдөр: Deploy
- [ ] Railway project үүсгэх (хэрэв Phase 0-д үүсгэгдээгүй бол)
- [ ] Postgres add-on production environment-д нэмэх
- [ ] `db/schema.sql` cloud Postgres-руу ачаалах (`railway run psql`)
- [ ] Environment variables бүгдийг тохируулах:
  - `JWT_SECRET` (шинээр `openssl rand -hex 32`)
  - `QPAY_*`, `RESEND_API_KEY`
  - `FRONTEND_ORIGIN=https://airguide.mn`
- [ ] `git push main` → автомат deploy
- [ ] `/api/health` шалгах
- [ ] Frontend service (static) дугаарлах

#### 2-р өдөр: Domain + Monitor
- [ ] Custom domain нэмэх (airguide.mn, api.airguide.mn)
- [ ] Cloudflare DNS CNAME record
- [ ] TLS шалгах (SSL Labs A grade)
- [ ] Healthcheck path тохируулах (`/api/health`)
- [ ] Sentry DSN environment variable нэмэх
- [ ] UptimeRobot 1 минут tutamd healthcheck
- [ ] Email DNS (SPF/DKIM via Resend) тохируулах
- [ ] Privacy policy, terms (нууцлал/үйлчилгээний нөхцөл)
- [ ] Production seed: airlines, airports, эхний 5-10 нислэг
- [ ] Cost monitor (Railway dashboard usage)

### Acceptance criteria

- https://airguide.mn ажиллана, SSL A grade.
- Бүх API < 200 ms p95 (Railway dashboard метрик).
- Uptime 99.5% (схemes 14 цаг/сар downtime).
- Railway daily snapshot ажиллана.
- Sentry error tracking идэвхтэй.

---

## Phase 6+ — Сайжруулалт (priority queue)

Энэ нь roadmap-ийн "тогтоогдоогүй" хэсэг. Phase 5 хүртэл хүрсний дараа дараах prio-р хийнэ:

### Бизнес шинэ боломж
- Promo code, discount
- Loyalty program (mile)
- Multi-city, connection flight
- Ancillary services (тээш, suudal, daatgal)
- Корпорацын account, дансаар үлдсэн төлбөр
- Visa цуглуулах service (3rd party)

### Технологи сайжруулалт
- PWA (offline ticket харах)
- Push notification (нислэг саатах үед)
- Server-sent events (real-time төлөв)
- ElasticSearch (нислэгийн хайлт fuzzy)
- DB read replica
- CDN-р frontend assets serve хийх

### Дотоод хэрэгсэл
- Sales report dashboard
- Customer 360° view
- Бэлдмэл template имэйл (Marketing)
- API дотоод хэрэглэгчдэд (B2B)

---

## Эрсдэлийн хяналт

| Эрсдэл | Магадлал | Үр дагавар | Mitigation |
|---|---|---|---|
| QPay integration саатал | Дунд | 1-2 долоо хоног | Phase 3-ийг хувааж эхлээд "cash only" deploy |
| Double-booking | Бага | Их (бизнес итгэл) | `seats` table + partial unique index + `FOR UPDATE` |
| Schema breaking change | Дунд | Дунд | dbmate migration test, Railway PR preview env-д |
| Railway downtime | Бага | Дунд | Daily snapshot + manual `pg_dump` + self-host план |
| Railway зардал гэнэт өсөх | Дунд | Бага | Cost alert, usage monitor долоо хоног бүр |
| Singapore region latency Монголд | Дунд | Дунд | Cloudflare proxy, edge cache; ноцтой бол local VPS |
| GDPR/PII асуудал | Бага | Их | Log-д PII redact, retention policy |

---

## Sprint cadence

- **Sprint duration:** 1 долоо хоног
- **Demo:** Баасан өдөр
- **Retro:** 30 минут, Баасан
- **Planning:** Даваа, 1 цаг

Phase бүр 2 sprint, гэхдээ багасч/өсч болно.

---

## Definition of Done

Бүх phase-ийн ажил "Done" гэхэд:
1. Code merged to `main` (PR review pass)
2. Test green (CI Pass)
3. Doc шинэчилсэн (README/API/STRUCTURE)
4. Manual QA pass (staging)
5. Demo recording (1-2 минут)
