# Файлын бүтэц

> Хавтас, файлуудын зохион байгуулалт ба тэдгээрийн үүрэг.

---

## 1. Бүтэн модны харагдац

```
airguide/
├── README.md                       # Төслийн оршил
├── LICENSE                         # MIT license
├── .gitignore                      # Git-д орохгүй файлууд
├── .editorconfig                   # IDE-н нэгдсэн тохиргоо
├── airguide.html                   # (legacy) одоогийн single-page demo
├── airguide_database.sql           # (legacy) MySQL dump — Phase 1-д Postgres руу хөрвүүлэх
├── railway.toml                    # Railway service конфиг (Phase 5)
│
├── docs/                           # Бичиг баримтууд
│   ├── ARCHITECTURE.md             # Архитектур, тех стак
│   ├── STRUCTURE.md                # Энэ файл
│   ├── DATABASE.md                 # Schema design, ER, indexing
│   ├── API.md                      # REST endpoint жагсаалт
│   ├── ROADMAP.md                  # Үе шаттай төлөвлөгөө
│   ├── SETUP.md                    # Local dev environment
│   ├── DEPLOYMENT.md               # Production deploy
│   └── assets/
│       └── er-diagram.png          # ER зураг
│
├── db/                             # Өгөгдлийн сан (PostgreSQL)
│   ├── schema.sql                  # Postgres schema (Phase 1-д хөрвүүлсэн)
│   ├── seed.sql                    # Жишээ өгөгдөл
│   ├── extensions.sql              # pg_trgm, pgcrypto, pg_stat_statements
│   ├── migrations/                 # dbmate migration файлууд
│   │   ├── 20260513000001_init.sql
│   │   ├── 20260520000001_add_seats_table.sql
│   │   └── 20260601000001_add_promo_codes.sql
│   └── queries/                    # Хадгалсан analytical query
│       ├── monthly_revenue.sql
│       └── route_popularity.sql
│
├── frontend/                       # Static frontend
│   ├── index.html                  # Landing + search
│   ├── search.html                 # Хайлтын үр дүн
│   ├── booking.html                # 3-алхамт захиалга
│   ├── confirmation.html           # E-ticket
│   ├── login.html                  # Customer/admin login
│   ├── admin/
│   │   ├── index.html              # Admin dashboard
│   │   ├── bookings.html
│   │   ├── flights.html
│   │   └── reports.html
│   ├── css/
│   │   ├── tokens.css              # CSS Custom Properties (өнгө, font, spacing)
│   │   ├── base.css                # Reset, typography
│   │   ├── components.css          # Button, card, modal, form
│   │   └── layout.css              # Container, grid, header, footer
│   ├── js/
│   │   ├── api.js                  # Fetch wrapper
│   │   ├── auth.js                 # JWT localStorage management
│   │   ├── i18n.js                 # MN/EN translation
│   │   ├── search.js               # Search form + results
│   │   ├── booking.js              # Booking flow state machine
│   │   ├── admin.js                # Admin RBAC handlers
│   │   └── utils.js                # Date format, currency, debounce
│   ├── assets/
│   │   ├── logo.svg
│   │   ├── favicon.ico
│   │   ├── og-image.jpg            # Open Graph 1200×630
│   │   └── destinations/           # Хотын зургууд (WebP)
│   │       ├── seoul.webp
│   │       └── tokyo.webp
│   └── locales/
│       ├── mn.json                 # Монгол текст
│       └── en.json
│
├── backend/                        # Node.js API
│   ├── package.json
│   ├── package-lock.json
│   ├── .env.example                # Тохиргооны template
│   ├── server.js                   # Fastify entry point
│   ├── src/
│   │   ├── db.js                   # pg Pool
│   │   ├── config.js               # process.env → typed config
│   │   ├── routes/
│   │   │   ├── airports.js
│   │   │   ├── flights.js
│   │   │   ├── bookings.js
│   │   │   ├── payments.js
│   │   │   ├── auth.js
│   │   │   └── admin/
│   │   │       ├── bookings.js
│   │   │       ├── flights.js
│   │   │       └── reports.js
│   │   ├── plugins/
│   │   │   ├── auth.js             # JWT verify decorator
│   │   │   ├── cors.js
│   │   │   ├── rate-limit.js
│   │   │   ├── error.js            # Алдааны formatter
│   │   │   └── logger.js           # pino redact PII
│   │   ├── services/
│   │   │   ├── booking.js          # Захиалгын transaction
│   │   │   ├── pricing.js          # Үнэ тооцоолох
│   │   │   ├── email.js            # E-ticket илгээх
│   │   │   ├── qpay.js             # QPay API client
│   │   │   └── code.js             # booking_code generator
│   │   ├── schemas/                # Zod schema
│   │   │   ├── booking.js
│   │   │   ├── flight.js
│   │   │   └── auth.js
│   │   └── utils/
│   │       ├── crypto.js
│   │       └── date.js
│   └── test/
│       ├── airports.test.js
│       ├── flights.test.js
│       └── booking.test.js
│
├── scripts/                        # Тусгай скриптүүд
│   ├── seed.js                     # Sample data ачаалах
│   ├── backup.sh                   # pg_dump + S3 (нэмэлт)
│   └── healthcheck.sh
│
└── railway.toml                    # Railway service config (root-д)
```

**Тайлбар:** Railway-ийн ачаар `deploy/` хавтас шаардлагагүй болсон — Caddyfile, systemd, Nginx, ssh, ufw тохиргооны файлууд бүгдэн арилсан. `railway.toml`-д services, build, deploy command зэргийг тодорхойлно.

---

## 2. Хавтас бүрийн зорилго

### `docs/`
Бүх Markdown бичиг баримт. Шинээр баримт нэмэхэд **prefix байхгүй**, `UPPER_CASE.md` форматтай (стандарт practice).

### `db/`
Өгөгдлийн сангийн бүх SQL файл.
- `schema.sql` — current schema (idempotent: `DROP IF EXISTS` → `CREATE`)
- `seed.sql` — dev/staging-д ачаалах sample data
- `migrations/` — production-д хэрэглэх версийн хяналттай өөрчлөлт (`dbmate`)
- `queries/` — analytical query, reporting view-уудын эх

### `frontend/`
Static файлууд. **Build step байхгүй**, browser шууд унших боломжтой.
- `*.html` — page тус бүр
- `css/` — каскад дарааллаар (tokens → base → layout → components)
- `js/` — ES module, нэг файл = нэг үүрэг
- `assets/` — зураг, лого
- `locales/` — i18n JSON

### `backend/`
Node.js Fastify апп.
- `server.js` — entry, `pg` Pool үүсгэх
- `src/routes/` — URL зам бүр нэг файл
- `src/plugins/` — Fastify plugin (auth, cors, rate-limit)
- `src/services/` — Бизнес логик, transaction
- `src/schemas/` — Zod validation
- `test/` — `node:test` test файлууд

### `scripts/`
Нэг удаагийн эсвэл cron-р ажиллах скриптүүд. Файл бүр shebang + self-contained.

### `railway.toml`
Railway service-ийн конфиг. Жишээ:
```toml
[build]
builder = "NIXPACKS"
buildCommand = "cd backend && npm ci"

[deploy]
startCommand = "cd backend && npm start"
healthcheckPath = "/api/health"
restartPolicyType = "ON_FAILURE"
```

---

## 3. Нэр өгөх дүрэм

| Зүйл | Дүрэм | Жишээ |
|---|---|---|
| Markdown файл | `SCREAMING_SNAKE.md` | `README.md`, `ARCHITECTURE.md` |
| HTML файл | `kebab-case.html` | `search.html`, `booking-confirm.html` |
| JS/CSS файл | `kebab-case.js` | `booking.js`, `api.js` |
| SQL файл | `snake_case.sql` | `monthly_revenue.sql` |
| Migration | `YYYYMMDDhhmmss_name.sql` | `20260513000001_init.sql` |
| Хүснэгт | `snake_case` (олон тоо) | `bookings`, `passengers` |
| Багана | `snake_case` (нэг тоо) | `booking_id`, `created_at` |
| URL зам | `/api/{plural}` | `/api/bookings`, `/api/flights` |
| Env хувьсагч | `SCREAMING_SNAKE` | `DB_HOST`, `JWT_SECRET` |

---

## 4. Файлын хязгаарлалт

- **JS module ≤ 300 мөр** — давсан үед хэсэглэх
- **SQL view ≤ 50 мөр** — нийлмэл бол view-уудыг compose хийх
- **CSS файл ≤ 400 мөр** — давсан үед `components/` дотор хуваах
- **HTML файл ≤ 200 мөр** — давсан үед хэсгүүдийг include-р оруулах

---

## 5. Git workflow

| Зорилго | Branch | Жишээ |
|---|---|---|
| Feature | `feat/<name>` | `feat/qpay-integration` |
| Bugfix | `fix/<name>` | `fix/seat-overcommit` |
| Refactor | `refactor/<name>` | `refactor/booking-service` |
| Docs | `docs/<name>` | `docs/api-update` |
| Migration | `db/<name>` | `db/add-promo-codes` |

Бүх PR-ыг `main` руу. Squash merge default.

---

## 6. Шилжилтийн төлөвлөгөө

**Phase 0 (одоо):**
- `airguide.html` — Root дотор үлдээх (legacy demo)
- `airguide_database.sql` — Root дотор үлдээх

**Phase 1 (Sprint 1):**
- `frontend/index.html` руу шилжүүлэх (CSS/JS салгасан)
- `airguide_database.sql` (MySQL) → `db/schema.sql` (Postgres) хөрвүүлэх
- `backend/` хавтсыг үүсгэх + `pg` driver

**Phase 2:**
- `airguide.html`-г устгах (frontend/index.html-аар орлуулсан)
- `airguide_database.sql`-г устгах (db/schema.sql + migrations-аар орлуулсан)

**Phase 5:**
- `railway.toml` нэмэх
