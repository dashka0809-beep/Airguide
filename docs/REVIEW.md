# Air Guide — Системийн бүрэн review

> **Огноо:** 2026-05-17
> **Хамрах хүрээ:** Backend (Node.js + Fastify), Frontend (Vanilla JS), Database (PostgreSQL 16), CI/Docs/Ops
> **Арга:** 4 чиглэлд параллель аудит + HIGH олдвор бүрийг кодоор баталгаажуулсан

---

## Гүйцэтгэлийн хураангуй

Air Guide бол **MVP-ээс production-руу 80% хүрсэн** жижиг бизнесийн нислэгийн тийз захиалгын платформ. Phase 0-4 дууссан, live demo (`airguide-frontend-production.up.railway.app`) ажиллаж байна. Кодын чанар (Fastify schema-first, Zod, parameterized SQL, JWT + RBAC + audit_log) нь production engineering quality-д хүрсэн. Гэвч production-руу шууд push хийхээс өмнө **9 ширхэг HIGH эрсдэл** заавал засагдах ёстой.

Шалгасан findings 95%+ нь кодоор баталгаажсан; 2-3 ангиллын залруулга хийсэн.

---

## 🔴 Production-руу гарахаас өмнө ЗААВАЛ засах (HIGH)

| # | Хаана | Асуудал | Засах |
|---|---|---|---|
| 1 | `backend/src/config.js:24` | `JWT_SECRET`-д default утга бий (`'dev_only_change_in_production_min_32_chars'`). Prod-д env алдвал silently default-ээр sign хийнэ → бүх токен forge боломжтой. | `NODE_ENV='production'` үед default-гүй болгож startup-д `process.exit`. |
| 2 | `README.md:38-43` + `frontend/admin/login.html:22-25` + `db/seed.sql` | Live prod admin credentials (`admin/Admin@123`, `munkh/Manager@123`, `saraa/Agent@123`) public repo + README + login UI-д ил. | Prod seed-ийг bootstrap-аас салгах, README + login hint арилгах. |
| 3 | `db/schema.sql:462-466` | `fn_after_ticket_insert` нь `WHERE available_seats > 0` нөхцөлтэй UPDATE — 0 мөр буцаавал ticket INSERT амжилттай хэвээр → **seat oversell**. | Trigger дотор `IF NOT FOUND THEN RAISE EXCEPTION`, эсвэл `CHECK (available_seats >= 0)`. |
| 4 | `backend/src/services/booking.js:135-138` | `SELECT … FOR UPDATE OF f`-д lock acquisition order баталгаагүй (`WHERE flight_id = ANY($1::bigint[])`) → round-trip захиалга concurrent гарвал deadlock. | `ORDER BY f.flight_id` нэмэх. |
| 5 | `backend/src/services/admin.js:93-109` | `refundBooking` 3 UPDATE-ийг transaction-гүй гүйцэтгэнэ — дунд алдвал payment refunded боловч booking pending үлдэнэ. | `transaction()` wrap-д оруулах. |
| 6 | `frontend/js/booking.js:147` | `max="2026-05-15"` hardcoded (өнөөдрийн огноо) — маргаашаас алдаатай. | Runtime-д `new Date().toISOString().slice(0,10)`. |
| 7 | `frontend/js/booking.js:404` | `trip_type:'one_way'` үргэлж hardcoded — round-trip booking бодитоор хийгдэхгүй (backend схем дэмждэг). | `state.tripType` + `return_flight_id` форвард хийх. |
| 8 | `scripts/apply_db.py:69-71` | TLS бүрэн disable (`ctx.check_hostname=False; ctx.verify_mode=CERT_NONE`). | `sslmode=require` + CA bundle. |
| 9 | `db/migrations/20260517120000_init.sql:638-655` | `migrate:down` нь бүх хүснэгтийг `DROP TABLE CASCADE` — санамсаргүй rollback хийвэл бүх өгөгдөл устана. | `RAISE EXCEPTION 'baseline rollback forbidden';`. |

---

## 🟠 Хэрэглээний/correctness асуудал (MEDIUM)

| Хаана | Асуудал | Засах |
|---|---|---|
| `backend/src/services/admin.js:202-209` | `updateFlight` нь `${k}=$i` динамик SQL бичнэ. Одоо Zod whitelist хамгаална, гэхдээ хэврэг pattern. | Explicit `Set` allowlist шалгалт. |
| `backend/src/services/auth.js:50-67` | User олдоогүй үед bcrypt.compare ажиллахгүй → timing oracle (user enumeration). | Dummy compare үргэлж хийх + `/auth/login`-д per-username throttle. |
| `backend/src/db.js:21` | `ssl: { rejectUnauthorized: false }` — MITM эрсдэл. | Railway CA bundle ашиглах. |
| `backend/src/routes/chat.js` | Anthropic API endpoint per-IP daily quota байхгүй — зардал хяналтгүй. | Per-IP/per-day quota нэмэх. |
| `backend/src/sentry.js:36-39` | Boot self-test prod-д restart бүрд `captureException` дуудна — Sentry quota шаталт, false-positive alert. (Зориудаар `dccace2`-аар нэмсэн ч prod-д тохиромжгүй.) | `NODE_ENV !== 'production'` хязгаарлах. |
| `db/schema.sql:198-201` | `economy_price/business_price/first_price` + `available_seats` нэг flight мөрөнд — класс тус бүрийн үлдэгдэл ялгаагүй. | `flight_inventory(flight_id, class_type, …)` хүснэгт. |
| `db/schema.sql:289-306` | `tickets.booking_id`, `tickets.passenger_id`, `payments.received_by` FK дээр index байхгүй → cascade/join seq scan. | `CREATE INDEX` 3 ширхэг. |
| `db/schema.sql:492-531` | `fn_after_payment_change` нь `total_amount=0` үед `status='confirmed'` болгож алдаа гарна. | `total_amount > 0` шалгалт нэмэх. |
| `frontend/admin/js/core.js:98-99` | `renderShell` нь `user.full_name/username/role` талбаруудыг **escape хийлгүй** `insertAdjacentHTML`-руу шууд оруулна → XSS вектор. | `esc(user.full_name)` ашиглах. |
| `frontend/js/api.js` + `frontend/admin/js/core.js` | JWT `localStorage`-д → XSS гарвал шууд алдагдана. | `httpOnly` cookie. |
| `frontend/js/i18n.js` | JS-аар render хийгдсэн контент (modal, search results, flight cards) хатуу MN-аар бичигдсэн, `applyTranslations` хүрэхгүй → хэл солих хагас ажиллана. | JS render-сэн хэсгийг `t()`-аар орлуулах. |

---

## 🟡 Гүйцэтгэл / Архитектур

- **Per-route rate limit байхгүй.** `backend/server.js:80-85` нь нэг л global (60/мин). `docs/API.md:494` нь booking 10/мин, auth 5/мин, admin 120/мин амласан — хэрэгжээгүй.
- **`@fastify/helmet` ачаалаагүй** → CSP/HSTS/X-Frame-Options дутуу. ARCHITECTURE.md L234 амласан.
- **`getBookingByCode` 4 RTT**, `flights.search` outbound+inbound 2 RTT — `json_agg`/`UNION ALL`-аар нэгтгэх боломжтой.
- **Refresh token denylist байхгүй** — хулгайлсан токен TTL дуустал хүчинтэй.
- **Airlines query бүх request-д DB-ээс уншигдана** — in-memory cache боломж.

---

## 🔵 Бичиг баримт vs. код (drift)

| Файл | Асуудал |
|---|---|
| `docs/STRUCTURE.md:14-17, 95-122` | `airguide.html`, `airguide_database.sql`, `railway.toml`, `db/queries/*.sql`, `scripts/seed.js`, `services/{pricing,email,qpay,code}.js` зэрэг **байхгүй файлууд** жагсаасан. |
| `backend/README.md:44-60` | "Phase 0 хувилбар, зөвхөн /api/health" гэж бичсэн, бодит Phase 4 дууссан. |
| `db/README.md` | "Phase 1-д бөглөгдөнө" stale текст; schema/seed аль хэдийн бэлэн. |
| `docs/DATABASE.md:64`, `docs/SETUP.md:142-156` | "10 хүснэгт" гэсэн, бодит **11** (`audit_log` дутуу). |
| `docs/API.md:13` | `api.airguide.mn` амласан, бодит Railway subdomain. |
| `docs/API.md:65-90` | QPay endpoint жагсаасан, бодит Phase 3 implement хийгээгүй. |
| `docs/ROADMAP.md:30-43` | Phase 0 checklist бүгд `[ ]` unchecked, бодит дууссан. |
| `.github/workflows/ci.yml` | Зөвхөн 3 unit test (code/crypto/schemas). **Integration test, eslint, npm audit, lighthouse, deploy gate байхгүй**. `actions/setup-node` cache идэвхгүй. |
| `frontend/js/chatbot.js:20-26` | Comment `localStorage-д хадгална`, код `sessionStorage` хэрэглэнэ. |

---

## ✅ Системийн давуу талууд

- **SQL injection хамгаалалт нийтлэг сайн** — бараг бүх query parameterized (1 хэсэгчилсэн dynamic build л үлдсэн, тэр нь Zod-оор хамгаалагдсан).
- **Zod schema-аар хатуу input validation**, error handler-аар Zod→400 цэвэрхэн.
- **JWT (`jose`) + bcrypt-12 + RBAC + audit_log** — production-grade auth foundation.
- **Postgres-ийн давуу талыг зөв ашигласан**:
  - `pg_trgm` autocomplete
  - Partial unique index `tickets WHERE status='issued'`
  - `jsonb` + GIN
  - `TIMESTAMPTZ`
  - CHECK constraints бүх хүснэгтэд жигд
- **`escapeHtml` frontend бүх render-д жигд хэрэглэгдсэн** (admin core.js нь 1 исключение).
- **Build-step байхгүй frontend, ESM, Fastify4, Railway PaaS** — ARCHITECTURE.md-д амласан "хөнгөн" зарчим хадгалагдсан.
- **dbmate migration + baseline режим** зөв тохируулсан.
- **Idempotent seed** (`NOT EXISTS` guard, `generate_series`).
- **Graceful shutdown, Sentry hook, pino redact (PII), CORS allowlist** — операцийн соёл боловсронгуй.

---

## 🎯 Дараагийн алхамын тэргүүлэх дараалал

1. **Дээрх 🔴 9 HIGH-ийг засах** (1-2 өдөр).
2. **FK index нэмэх**: `tickets.booking_id`, `tickets.passenger_id`, `payments.received_by` (1 migration).
3. **`@fastify/helmet` + per-route rate-limit** (booking/auth/admin) — 2 цаг.
4. **CI чангатгах**: eslint + npm audit + Postgres service контейнер дээр integration test — хагас өдөр.
5. **Docs drift цэвэрлэх**: STRUCTURE.md, ROADMAP.md, backend/README.md, db/README.md, DATABASE.md — хагас өдөр.

---

## Ерөнхий дүгнэлт

Кодын бааз нь Phase 1 booking платформын хувьд **боловсронгуй, ойлгомжтой бичигдсэн**. Хэдхэн долоо хоногийн дотор Phase 0-4 дууссан, live demo ажиллаж байгаа нь шуурхай хөгжүүлэлтийн нэгэн жишээ юм. Гэвч production-руу шууд push хийхэд **3 ноцтой эрсдэл** үлдсэн:

1. `JWT_SECRET` default утга silently асах
2. DB trigger дотор seat oversell race condition
3. README + UI-д ил dev credentials

Эдгээр гурав нь нэг өдрийн ажил. Хоёрдугаар тэргүүлэлт нь docs/код drift — STRUCTURE.md, ROADMAP.md, backend/README.md, db/README.md бүгд Phase 0-1 үеийн "ирээдүйд" текст агуулсан хэвээр учир шинэ хөгжүүлэгч 30 минутад онбоард болохгүй. Гуравдугаар нь CI: 3 unit test л байгаа, integration/lint/audit/deploy gate байхгүй — Railway main руу шууд push хийхэд safety net дутуу.

Эдгээрийг засчихвал **B+ → A-** үнэлгээтэй, бодит ашиглалтад орохуйц жижиг бизнесийн платформ болно.

---

## Шалгасан findings-ийн баталгаажуулалт

Бүх HIGH-зэрэг олдвор кодоор тус тусад нь баталгаажсан. Дараах 2 залруулга хийсэн:

- **`services/admin.js:202-209` `updateFlight` SQL** — анх HIGH гэж тэмдэглэсэн, гэхдээ Zod schema талбаруудыг хатуу whitelist хийдэг тул одоогоор active injection vector байхгүй. **Зөв ангилал: MEDIUM (defense-in-depth gap).**
- **Sentry boot self-test** — анх "prod-д орхисон debug код" гэж тэмдэглэсэн, гэхдээ commit `dccace2` нь зориудаар нэмсэн delivery test болохыг тогтоосон. Эрсдэл хэвээр (quota burn, false alert) — **MEDIUM.**

12 ширхэг бусад HIGH/MEDIUM findings нь яг бичсэнчлэн кодоор баталгаажсан.
