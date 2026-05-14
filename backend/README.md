# Air Guide API

> Fastify + PostgreSQL backend.

## Хэрэглэх

### 1. Шаардлага

- Node.js ≥ 20
- PostgreSQL ≥ 16 (local эсвэл Railway)

### 2. Эхний тохиргоо

```bash
cd backend
cp .env.example .env
# .env-ийн DATABASE_URL, JWT_SECRET засах

npm install
```

### 3. Server асаах

```bash
npm run dev        # node --watch (өөрчлөлт хийхэд автомат restart)
# эсвэл
npm start          # production хэлбэрээр
```

Default: `http://localhost:3000`

### 4. Шалгах

```bash
curl http://localhost:3000/api/health
# { "status": "ok", "database": "connected", "env": "development", ... }

curl http://localhost:3000/
# { "name": "Air Guide API", "version": "0.1.0", ... }
```

---

## Бүтэц (Phase 0 хувилбар)

```
backend/
├── package.json           Dependency, scripts
├── server.js              Fastify entry, plugin бүртгэл
├── .env.example           Тохиргооны template
├── .env                   (gitignore-д) бодит утга
└── src/
    ├── config.js          process.env → typed config (Zod-оор valid хийсэн)
    ├── db.js              PostgreSQL Pool, query helper
    ├── routes/            (Phase 1) — airports, flights, bookings, ...
    ├── plugins/           (Phase 1) — auth, error formatter
    ├── services/          (Phase 1) — booking, pricing, email
    ├── schemas/           (Phase 1) — Zod validation schema
    └── utils/             (Phase 1) — crypto, date helpers
```

---

## Endpoint жагсаалт

**Phase 0 (одоо):**
- `GET /` — API мэдээлэл
- `GET /api/health` — health check (DB холболт)

**Phase 1-д нэмэгдэх:**
- `GET /api/airports?q=` — autocomplete
- `GET /api/flights/search` — нислэг хайх
- `POST /api/bookings` — захиалга үүсгэх
- ... (нийт 13 endpoint, [docs/API.md](../docs/API.md) үзнэ үү)

---

## Тест

```bash
npm test           # node:test framework
```

---

## Зөвлөмж

- **Алдаа:** `Cannot find module 'fastify'` → `npm install` ажиллуулсан эсэхийг шалга
- **Алдаа:** `ECONNREFUSED 127.0.0.1:5432` → Postgres асаагаагүй байна
- **Алдаа:** `Invalid environment variables` → `.env`-ийн `DATABASE_URL` буруу

Дэлгэрэнгүй: [docs/SETUP.md](../docs/SETUP.md#12-түгээмэл-асуудлууд)
