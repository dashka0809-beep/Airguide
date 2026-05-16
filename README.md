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

## 🌐 Live demo

| Үйлчилгээ | URL |
|---|---|
| **Вэбсайт** | https://airguide-frontend-production.up.railway.app/ |
| **API** | https://airguide-production-ec87.up.railway.app/api/health |

Хэрэглэгчийн аялал: **хайх → захиалах (3 алхам) → шалгах → цуцлах** бүрэн ажиллана.
20 чиглэл, 3,200+ нислэг (2026-05-20 ~ 09-30).

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
| 0 | Foundation (repo, docs, бүтэц) | ✅ Дууссан |
| 1 | Database (MySQL→Postgres, 11 хүснэгт) | ✅ Дууссан |
| 1 | Backend API (7 public endpoint) | ✅ Дууссан |
| 2 | Frontend — хайлт + autocomplete | ✅ Дууссан |
| 2 | Захиалгын flow (3-алхамт modal) | ✅ Дууссан |
| 2 | Захиалга шалгах / цуцлах | ✅ Дууссан |
| 2 | Filter / эрэмбэлэлт | ✅ Дууссан |
| 2 | MN/EN i18n (бүрэн) | ⏳ Хэсэгчилсэн |
| 5 | Railway deploy (live) | ✅ Дууссан |
| 3 | Төлбөр (QPay) + e-ticket email | ⏳ Дараагийнх |
| 4 | Admin panel + RBAC | ⏳ Хүлээгдэж буй |

Дэлгэрэнгүй [docs/ROADMAP.md](docs/ROADMAP.md) дотор.

---

## License

MIT — [LICENSE](LICENSE) үзнэ үү.

## Холбоо барих

- Email: info@airguide.mn
- GitHub: https://github.com/dashka0809-beep/Airguide
