# Deployment (Railway)

> Air Guide-г Railway-д deploy хийх алхам алхмаар. VPS, ssh, systemd, Caddy шаардлагагүй.

---

## 1. Архитектур

```
Internet (443) ──► Railway Edge ──► API service (Node.js)
                                          │
                                          └──► Postgres add-on
                          ──► Frontend service (static)
```

**Railway services:**
- **`api`** — Node.js Fastify backend
- **`frontend`** — Static HTML/CSS/JS (Caddy эсвэл `serve`)
- **`postgres`** — Managed Postgres add-on (daily snapshot)

**Үндсэн зарчим:** `git push` → автомат build → автомат deploy.

---

## 2. Урьдчилсан шаардлага

| Зүйл | Заавал | Тайлбар |
|---|---|---|
| Railway account | ✅ | github.com/login-аар |
| Railway CLI | ✅ | `npm i -g @railway/cli` |
| GitHub repo | ✅ | дашка0809-beep/Airguide |
| Custom domain | ❌ | сонголтоор (airguide.mn) |

**Үнэ:**
- **Trial:** $5 free credit/сар (эхэлж туршихад хангалттай)
- **Hobby plan:** $5/сар + ашигласанаар (API ~$3 + Postgres ~$5 = ~$8/сар жижиг traffic-д)
- **Pro plan:** $20/сар + ашигласанаар (production-д)

---

## 3. Эхний deploy (4 алхам)

### 3.1 Project үүсгэх

```bash
railway login
cd /path/to/Airguide
railway init airguide
```

Эсвэл Railway dashboard-аас "New Project" → "Deploy from GitHub repo" → `dashka0809-beep/Airguide`.

### 3.2 Postgres add-on нэмэх

```bash
railway add postgresql
```

Эсвэл dashboard → "+ New" → "Database" → "PostgreSQL".

Railway автоматаар `DATABASE_URL` environment variable үүсгэнэ.

### 3.3 Schema ачаалах

```bash
railway link               # project, environment сонгох
railway run psql < db/schema.sql
railway run psql < db/seed.sql       # анх удаа л
```

Эсвэл Railway dashboard → Postgres service → "Data" tab → SQL editor.

### 3.4 API service deploy

```bash
railway up                 # одоогийн branch-г deploy
```

Эсвэл GitHub push → автомат:
```bash
git push origin main       # main branch deploy
```

Railway нь:
1. Repo clone хийнэ
2. `Nixpacks` (Dockerfile-гүй build tool)-аар Node.js detect хийнэ
3. `npm ci && npm start` ажиллуулна
4. Public URL гарна: `airguide-production.up.railway.app`

---

## 4. Environment variables

Railway dashboard → service → "Variables":

```bash
# Server
NODE_ENV=production
PORT=${{PORT}}                        # Railway автомат оноодог
LOG_LEVEL=info

# Database (Railway автомат оноодог)
DATABASE_URL=${{Postgres.DATABASE_URL}}
DB_POOL_MAX=10

# Auth
JWT_SECRET=<openssl rand -hex 32>     # шинээр үүсгэх
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=2592000
BCRYPT_COST=12

# QPay
QPAY_BASE_URL=https://merchant.qpay.mn/v2
QPAY_USERNAME=<...>
QPAY_PASSWORD=<...>
QPAY_INVOICE_CODE=<...>

# Email
RESEND_API_KEY=<re_...>
EMAIL_FROM=noreply@airguide.mn

# Frontend
FRONTEND_ORIGIN=https://airguide.mn
```

**Чухал:**
- `${{Postgres.DATABASE_URL}}` syntax нь Railway-ийн service reference (DB-н URL-ыг автомат resolve хийнэ).
- `JWT_SECRET` үргэлж шинээр үүсгэ: `openssl rand -hex 32`.
- `PORT`-ыг hardcode хийхгүй — Railway runtime-д оноодог.

---

## 5. `package.json` тохиргоо

`backend/package.json`:

```json
{
  "name": "airguide-api",
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": "20.x" },
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "node --test test/",
    "db:migrate": "dbmate up"
  },
  "dependencies": {
    "fastify": "^4.28.0",
    "@fastify/cors": "^9.0.1",
    "@fastify/rate-limit": "^9.1.0",
    "@fastify/swagger": "^8.14.0",
    "pg": "^8.11.5",
    "zod": "^3.23.8",
    "jose": "^5.6.0",
    "bcrypt": "^5.1.1",
    "pino-pretty": "^11.2.0"
  }
}
```

Railway нь автомат `npm ci && npm start` ажиллуулна.

---

## 6. Frontend deploy

### Сонголт A — Railway-н нэмэлт service (зөвлөмж)

`frontend/package.json`:
```json
{
  "scripts": {
    "start": "npx serve -l ${PORT:-3000} ."
  }
}
```

Эсвэл `Caddyfile`:
```caddy
:{$PORT} {
  root * /app
  try_files {path} {path}/ /index.html
  file_server
  encode gzip zstd
}
```

Railway dashboard → "+ New" → "Empty Service" → Settings → "Root Directory: `frontend`".

### Сонголт B — Static host (Vercel/Netlify free)

Frontend нь static тул Vercel/Netlify дээр $0-д ажиллана. Backend Railway, frontend Vercel — энэ нь зардал, latency хоёуланд илүү. CORS-оо тохируулна.

---

## 7. Custom domain (airguide.mn)

### 7.1 Railway dashboard

Service → Settings → Networking → "Add Custom Domain":
- `airguide.mn` (frontend)
- `api.airguide.mn` (api)

Railway CNAME заавар өгнө:
```
api.airguide.mn  CNAME  airguide-api-production.up.railway.app
airguide.mn      A      <Railway IPs>     (apex CNAME flattening Cloudflare-д)
```

### 7.2 Cloudflare-д DNS оноох

| Type | Name | Value | Proxy |
|---|---|---|---|
| CNAME | `api` | `airguide-api-production.up.railway.app` | DNS only |
| CNAME | `@` | `airguide-production.up.railway.app` | Proxied (Cloudflare CDN) |
| CNAME | `www` | `airguide.mn` | Proxied |

Railway автоматаар TLS sertificate-аа Let's Encrypt-аас авна (5-10 минут).

### 7.3 Шалгах

```bash
curl -I https://api.airguide.mn/api/health
# HTTP/2 200
# server: Caddy
```

---

## 8. Migration хэрэгжүүлэх

### 8.1 Local-аас Railway руу

```bash
railway run dbmate up
```

`dbmate` нь `DATABASE_URL` уншиж Railway-н Postgres руу шууд хэрэгжүүлнэ.

### 8.2 CI/CD-ийн хэсэг болгох

`backend/package.json`-д:
```json
"scripts": {
  "start": "npm run db:migrate && node server.js",
  "db:migrate": "dbmate up"
}
```

Railway-н "Pre-deploy command" дотор:
```
npm run db:migrate
```

Энэ нь deploy бүрт migration автомат хэрэгжинэ.

⚠️ Том migration-ыг production deploy-аас тусгайлан хийх (`railway run dbmate up`) — урт хугацааны DDL deploy-ийг блоклож магадгүй.

---

## 9. Preview environments

Railway-ийн нэгэн чухал давуу тал: **PR бүрд автомат preview environment**.

Railway dashboard → Settings → "Pull Request Environments" → Enable.

PR нээх бүрд:
- Шинэ environment үүсгэгдэнэ
- Үндсэн environment-ийн Postgres-ыг clone хийнэ (data-тай)
- Public URL гарна: `airguide-pr-42.up.railway.app`
- PR merge/close хийгдэхэд автомат устгана

**QA сайжруулна:** Reviewer URL-аар хандаж туршилт хийнэ.

---

## 10. Monitoring ба logs

### 10.1 Railway dashboard

- **Metrics tab** — CPU, RAM, network, request rate
- **Logs tab** — pino JSON log live stream
- **Observability** — request latency p50/p95/p99

### 10.2 Healthcheck

`backend/server.js`-д:
```js
fastify.get('/api/health', async (req, reply) => {
  await pool.query('SELECT 1');
  return { status: 'ok', timestamp: Date.now() };
});
```

Railway dashboard → service → "Health Check Path: `/api/health`".

### 10.3 Sentry (alert)

```bash
npm i @sentry/node
```

`server.js`:
```js
import * as Sentry from '@sentry/node';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1
});
```

Railway variables дотор `SENTRY_DSN` нэмэх.

### 10.4 Uptime monitor

UptimeRobot эсвэл BetterStack free tier-аар:
```
GET https://api.airguide.mn/api/health  (1 минут тутамд)
```

---

## 11. Backup ба recovery

### 11.1 Автомат

Railway Postgres add-on:
- Daily snapshot 07:00 UTC
- 7 өдрийн retention (Hobby) / 30 өдөр (Pro)
- Point-in-time recovery (Pro)

Dashboard → Postgres → "Backups" tab → "Restore from snapshot".

### 11.2 Гар backup (нэмэлт)

```bash
railway run pg_dump --format=custom airguide_db \
  > backups/airguide_$(date +%F).dump
```

S3 руу:
```bash
railway run pg_dump --format=custom airguide_db | \
  gzip | aws s3 cp - s3://airguide-backups/$(date +%F).dump.gz
```

### 11.3 Restore тест

Сард 1 удаа preview environment дээр:
```bash
railway run --service postgres-test pg_restore -d airguide_db backups/airguide_2026-05-13.dump
```

---

## 12. Rollback

### 12.1 Code rollback

Railway dashboard → service → "Deployments" tab → өмнөх deployment дээр "..." → "Redeploy".

Эсвэл CLI:
```bash
railway redeploy <deployment-id>
```

### 12.2 DB rollback

```bash
railway run dbmate down       # сүүлийн migration буцаах
```

⚠️ Schema rollback нь data алдагдах магадлалтай. Илүү аюулгүй арга:
1. Snapshot restore: Dashboard → Postgres → Backups → restore
2. Production duplicate environment үүсгэж, test хийгээд swap.

---

## 13. Performance tuning

### 13.1 API service
- **Replicas:** Settings → "Replicas: 2" (Pro plan, HA-д)
- **Memory:** Default 512 MB → 1 GB шаардлагатай бол
- **CPU:** auto (Hobby), guaranteed (Pro)

### 13.2 Postgres
- **Connection pool:** App түвшинд `DB_POOL_MAX=10` (Railway-ийн max connections-ын дотор багтах)
- **Statement timeout:** `ALTER DATABASE airguide_db SET statement_timeout = '30s';`
- **Slow log:** `pg_stat_statements` extension idэвхтэй

### 13.3 Frontend
- Static files-д `Cache-Control: public, max-age=31536000, immutable`
- Cloudflare CDN (free plan) — edge cache
- Image WebP, `loading="lazy"`

---

## 14. Зардлын тооцоо

**Эхлэлийн үед (0-100 MAU):**
- Trial credit $5/сар → $0
- Postgres ашиглалт минимум ($2)
- API service idle ($1)
- **Нийт: ~$3/сар** (credit-аар бүрэн хучигдана)

**100-1k MAU:**
- API: ~$5/сар (24/7 running)
- Postgres: ~$5/сар (1 GB storage)
- Bandwidth: ~$1
- **Нийт: ~$11/сар**

**1k-10k MAU:**
- API: ~$10–15/сар
- Postgres: ~$10/сар (5–10 GB)
- Bandwidth: ~$3
- **Нийт: ~$25–30/сар**

**Cost monitoring:** Railway dashboard → "Usage" tab.

---

## 15. Production checklist

Бэлэн төлөв болохын тулд:

- [ ] `DATABASE_URL` энц reference (`${{Postgres.DATABASE_URL}}`)
- [ ] `JWT_SECRET` өвөрмөц, 32+ тэмдэгт
- [ ] `NODE_ENV=production`
- [ ] `LOG_LEVEL=info` (debug биш)
- [ ] Healthcheck path тохируулсан
- [ ] Custom domain TLS зөв (SSL Labs A grade)
- [ ] Sentry DSN тохируулсан
- [ ] Uptime monitor 1 минут tutamd
- [ ] Backup retention баталгаажуулсан
- [ ] `db/seed.sql` нь production-д хийгдээгүй (зөвхөн `schema.sql` + жинхэнэ data)
- [ ] Rate limit идэвхтэй
- [ ] CORS зөвхөн frontend origin
- [ ] CSP, security headers
- [ ] Email DNS (SPF/DKIM) тохируулсан

---

## 16. Self-host руу шилжих (ирээдүйд)

Хэрэв Railway-ээс гарах хэрэгцээ гарвал:

### 16.1 DB export
```bash
railway run pg_dump --format=custom airguide_db > airguide.dump
```

### 16.2 Шинэ Postgres-руу restore
```bash
pg_restore -d airguide_db airguide.dump
```

### 16.3 Code-ыг VPS дээр клон хийх
Code-д Railway-specific зүйл байхгүй (зөвхөн `DATABASE_URL` environment variable). `pg` driver standard, ямар ч Postgres provider руу холбогдоно.

### 16.4 Шилжүүлэх target-ууд
- **Hetzner CX22** (€4.51/сар + managed DB $15/сар = €18.5/сар)
- **DigitalOcean App Platform** ($5 + $15 = $20/сар)
- **Fly.io** (Railway-тэй ижил DX, бага зардал)
- **AWS/GCP** (enterprise)

---

## 17. Дараагийн алхам

Deploy амжилттай дууссан бол:
1. [Phase 5 checklist](ROADMAP.md#phase-5--production-1-долоо-хоног)-ийг шалгах.
2. Анхны үйлчлүүлэгчид 1 долоо хоног invite-only.
3. Public launch.
