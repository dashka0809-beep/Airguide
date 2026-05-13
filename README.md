# Air Guide

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

**Сонголт A — Local Postgres:**
```bash
createdb airguide_db
psql airguide_db < db/schema.sql
psql airguide_db < db/seed.sql
```

**Сонголт B — Railway-н Postgres (cloud, dev-д шууд):**
```bash
railway login
railway link
railway run psql < db/schema.sql
```

Энэ нь 10 хүснэгт, view, trigger, sample data үүсгэнэ.

### 4. Backend асаах (Phase 1 дууссан үед)

```bash
cd backend
cp .env.example .env       # DATABASE_URL, JWT_SECRET тохируул
npm install
npm run dev                # http://localhost:3000
```

### 5. Frontend нээх

`frontend/index.html`-г browser-аар нээх эсвэл хөнгөн static server-ээр serve хийх:

```bash
cd frontend
npx serve -p 5173
```

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

| Хэсэг | Төлөв |
|---|---|
| Landing page (frontend) | ✅ Бэлэн ([airguide.html](airguide.html)) |
| Database schema (MySQL legacy) | ✅ Бэлэн ([airguide_database.sql](airguide_database.sql)) |
| Database schema (Postgres) | ⏳ Phase 1 эхэнд хөрвүүлэх |
| Backend API | ⏳ Phase 1 |
| Захиалгын flow | ⏳ Phase 2 |
| Admin panel | ⏳ Phase 3 |
| Төлбөрийн интеграц (QPay) | ⏳ Phase 4 |

Дэлгэрэнгүй [docs/ROADMAP.md](docs/ROADMAP.md) дотор.

---

## License

MIT — [LICENSE](LICENSE) үзнэ үү.

## Холбоо барих

- Email: info@airguide.mn
- GitHub: https://github.com/dashka0809-beep/Airguide
