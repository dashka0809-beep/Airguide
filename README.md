# Air Guide

[![CI](https://github.com/dashka0809-beep/Airguide/actions/workflows/ci.yml/badge.svg)](https://github.com/dashka0809-beep/Airguide/actions/workflows/ci.yml)

> Нислэгийн тийз захиалгын хөнгөн, хурдан вэб систем.

Air Guide бол Монголын нислэгийн тийзний агентлагт зориулсан захиалга, төлбөр, удирдлагын платформ юм. Систем нь **хамгийн бага хамаарал**, **build step байхгүй frontend**, **нэг жижиг VPS дээр ажиллах** зарчмаар бүтээгдсэн.

---

## Хурдан тойм

- **Frontend** — Vanilla HTML/CSS/ES modules (build байхгүй)
- **Backend** — Node.js 20 + Fastify 4
- **Database** — PostgreSQL 16
- **Auth** — JWT (`jose`) + bcrypt
- **Hosting** — **Railway** (managed Postgres + Node, auto-HTTPS, git push deploy)
- **Сар тутмын зардал** — $0 эхлэхэд (free credit), MAU 1k үед ~$10

Хөнгөн стак сонгосон шалтгаан: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#стак-сонголтын-үндэслэл).

---

## 🌐 Live demo

| Үйлчилгээ | URL |
|---|---|
| **Вэбсайт** | https://airguide-frontend-production.up.railway.app/ |
| **Admin panel** | https://airguide-frontend-production.up.railway.app/admin/login.html |
| **API** | https://airguide-production-ec87.up.railway.app/api/health |
| **API docs (Swagger)** | https://airguide-production-ec87.up.railway.app/docs |

Хэрэглэгчийн аялал: **хайх → шүүх → захиалах (3 алхам) → шалгах → цуцлах**,
MN/EN хэлээр. 20 чиглэл, 3,200+ нислэг (2026-05-20 ~ 09-30).

**Admin dev нэвтрэлт** (зөвхөн demo — production-д солих):

| Хэрэглэгч | Нууц үг | Эрх |
|---|---|---|
| `admin` | `Admin@123` | Бүх (орлогын тайлан) |
| `munkh` | `Manager@123` | Захиалга/нислэг засах |
| `saraa` | `Agent@123` | Зөвхөн харах |

---

## Quickstart

### 1. Шаардлага

| Tool | Хувилбар |
|---|---|
| Node.js | ≥ 20 LTS |
| PostgreSQL | ≥ 16 |
| Git | сүүлийн |
| Railway CLI (сонголтоор) | сүүлийн |

### 2. Repo татах

```bash
git clone https://github.com/dashka0809-beep/Airguide.git
cd Airguide
```

### 3. Өгөгдлийн сан бэлдэх

**Сонголт A — Local Postgres (psql):**
```bash
createdb airguide_db
psql airguide_db < db/extensions.sql
psql airguide_db < db/schema.sql
psql airguide_db < db/seed.sql
```

**Сонголт B — Python helper (psql суулгахгүй):**
```bash
pip install pg8000
export DATABASE_URL="postgresql://user:pass@host:port/dbname"
python scripts/apply_db.py extensions schema seed verify
```

Энэ нь 11 хүснэгт, 2 view, 14 trigger, 3,200+ нислэг үүсгэнэ.

### 4. Backend асаах

```bash
cd backend
cp .env.example .env       # DATABASE_URL, JWT_SECRET тохируул
npm install
npm run dev                # http://localhost:3000/api/health
```

### 5. Frontend нээх

```bash
cd frontend
node server.js             # http://localhost:3000 ($PORT-г уншина)
# эсвэл: python -m http.server 5173
```

`frontend/js/config.js`-н `API_BASE`-г локал backend руу заавал
(`http://localhost:3000/api`) солино.

---

## Бичиг баримтууд

| Файл | Агуулга |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Системийн архитектур, тех стак, dataflow |
| [docs/STRUCTURE.md](docs/STRUCTURE.md) | Файл/хавтасны бүтэц |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema загвар, ER диаграм, indexing |
| [docs/API.md](docs/API.md) | REST endpoint жагсаалт, request/response жишээ |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Үе шатуудтай хөгжүүлэлтийн төлөвлөгөө |
| [docs/SETUP.md](docs/SETUP.md) | Local dev environment-ийг тохируулах гарын авлага |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deploy (Railway) |

---

## Одоогийн төлөв

| Phase | Хэсэг | Төлөв |
|---|---|---|
| **0** | Foundation (repo, docs, бүтэц) | ✅ 100% |
| **1** | DB (MySQL→Postgres, 11 хүснэгт, 14 trigger) | ✅ 100% |
| **1** | Backend API (13 endpoint), node:test, Swagger, CI | ✅ 100% |
| **2** | Frontend — хайлт, autocomplete, filter/эрэмбэ | ✅ 100% |
| **2** | Захиалгын flow (3-алхамт modal), шалгах/цуцлах | ✅ 100% |
| **2** | MN/EN i18n (статик chrome) | ✅ 100% |
| **4** | Admin panel + JWT + RBAC + audit_log | ✅ 100% |
| **5** | Railway deploy (frontend+API+DB live) | ✅ ~50% |
| **3** | Төлбөр (QPay) + e-ticket email | ⏳ Дараагийнх |
| **5** | Custom domain (airguide.mn), Sentry, UptimeRobot | ⏳ Үлдсэн |

**Нийт ~80%.** Phase 0/1/2/4 бүрэн. Phase 3, 5-д гадны бүртгэл
(QPay sandbox, domain) шаардлагатай.

### Endpoint-ууд (live)

```
Public   GET  /api/airports?q=        GET /api/airlines
         GET  /api/flights/search     GET /api/flights/:id
Booking  POST /api/bookings           GET /api/bookings/:code
         POST /api/bookings/:code/cancel
Auth     POST /api/auth/login         POST /api/auth/refresh
         POST /api/auth/logout        GET  /api/auth/me
Admin    GET  /api/admin/bookings     PATCH /api/admin/bookings/:id
         GET  /api/admin/flights      POST  /api/admin/flights
         PATCH /api/admin/flights/:id GET  /api/admin/reports/revenue
```

Бүрэн интерактив: [/docs](https://airguide-production-ec87.up.railway.app/docs) (Swagger UI).

Дэлгэрэнгүй [docs/ROADMAP.md](docs/ROADMAP.md) дотор.

---

## License

MIT — [LICENSE](LICENSE) үзнэ үү.

## Холбоо барих

- Email: info@airguide.mn
- GitHub: https://github.com/dashka0809-beep/Airguide
