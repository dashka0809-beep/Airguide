# Local Setup

> Хөгжүүлэлтийн орчныг Windows / macOS / Linux дээр алхам алхмаар тохируулах.

---

## 1. Системийн шаардлага

| Tool | Хувилбар | Үндэслэл |
|---|---|---|
| **Node.js** | ≥ 20 LTS | ESM, native fetch, `--watch` |
| **PostgreSQL** | ≥ 16 | Partial indexes, `jsonb`, `pg_trgm` |
| **Git** | сүүлийн | — |
| **Railway CLI** | сүүлийн | Cloud DB-руу шууд run хийх |
| **VS Code** (санал) | — | EditorConfig, ESLint plugin |

Сонголтоор:
- **dbmate** — migration tool (Phase 1 дээр заавал)
- **k6** — load test
- **Postman** эсвэл **Insomnia** — API туршилт
- **pgAdmin** эсвэл **DBeaver** — GUI

---

## 2. Node.js суулгах

### Windows
```powershell
winget install OpenJS.NodeJS.LTS
node -v   # v20.x.x шалгах
```

### macOS
```bash
brew install node@20
echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc
```

### Linux (Ubuntu)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 3. PostgreSQL суулгах

### Сонголт A — Local Postgres

#### Windows
1. [PostgreSQL Windows installer](https://www.postgresql.org/download/windows/) татах
2. Үндсэн port `5432`, superuser нууц үг (жишээ: `postgres`)
3. pgAdmin 4-ийг сонгох (UI)

#### macOS
```bash
brew install postgresql@16
brew services start postgresql@16
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
```

#### Linux (Ubuntu)
```bash
sudo apt install -y postgresql-16
sudo systemctl enable --now postgresql
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

#### Шалгах
```bash
psql -U postgres -c "SELECT version();"
```

### Сонголт B — Docker Postgres (хамгийн хялбар)

```bash
docker run -d --name pg-airguide \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=airguide_db \
  -p 5432:5432 \
  -v pg-airguide-data:/var/lib/postgresql/data \
  postgres:16-alpine
```

### Сонголт C — Railway-н cloud Postgres (local DB суулгах хэрэггүй)

`railway login` хийгээд `railway run psql` ашиглах — энэ нь local Postgres-гүй ажиллах боломж олгоно.

---

## 4. Railway CLI суулгах

```bash
# macOS / Linux
brew install railway

# Windows (scoop)
scoop install railway

# эсвэл npm
npm i -g @railway/cli

railway login
```

Browser нээгдэж GitHub аккаунтаараа нэвтрэх. Token-ыг local-д хадгална.

---

## 5. Repo татах

```bash
git clone https://github.com/dashka0809-beep/Airguide.git
cd Airguide
```

---

## 6. Өгөгдлийн сан үүсгэх

### 6.1 Local Postgres дээр

```bash
# DB үүсгэх
createdb -U postgres airguide_db

# Schema ачаалах (Phase 1-д хөрвүүлэгдсэн file)
psql -U postgres -d airguide_db -f db/schema.sql

# Sample data
psql -U postgres -d airguide_db -f db/seed.sql
```

### 6.2 Шалгах

```bash
psql -U postgres -d airguide_db -c "\dt"
```

Хүлээгдэх гаралт:
```
              List of relations
 Schema |    Name    | Type  |  Owner
--------+------------+-------+----------
 public | aircraft   | table | postgres
 public | airlines   | table | postgres
 public | airports   | table | postgres
 public | bookings   | table | postgres
 public | customers  | table | postgres
 public | flights    | table | postgres
 public | passengers | table | postgres
 public | payments   | table | postgres
 public | tickets    | table | postgres
 public | users      | table | postgres
```

View шалгах:
```bash
psql -U postgres -d airguide_db -c "\dv"
```

### 6.3 Dev хэрэглэгч үүсгэх (security)

```sql
CREATE USER airguide WITH PASSWORD 'devpassword';
GRANT CONNECT ON DATABASE airguide_db TO airguide;
GRANT USAGE ON SCHEMA public TO airguide;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO airguide;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO airguide;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO airguide;
```

Production-д `postgres` superuser-ээр DB-д орохгүй.

### 6.4 Railway Postgres ашиглах (cloud)

```bash
railway link                # Railway project сонгох
railway run psql           # Cloud DB руу шууд
```

Schema-г cloud руу ачаалах:
```bash
railway run psql -f db/schema.sql
```

---

## 7. Backend бэлдэх

```bash
cd backend
cp .env.example .env
```

`.env` файл (local Postgres):

```bash
# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug

# Database (Postgres URL formats)
DATABASE_URL=postgresql://airguide:devpassword@127.0.0.1:5432/airguide_db
# эсвэл local superuser:
# DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/airguide_db

# Pool
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000

# Auth
JWT_SECRET=change_me_to_long_random_string_min_32_chars
JWT_ACCESS_TTL=900           # 15 минут
JWT_REFRESH_TTL=2592000      # 30 хоног
BCRYPT_COST=12

# QPay (Phase 3)
QPAY_BASE_URL=https://merchant.qpay.mn/v2
QPAY_USERNAME=
QPAY_PASSWORD=
QPAY_INVOICE_CODE=

# Email (Phase 3)
RESEND_API_KEY=
EMAIL_FROM=noreply@airguide.mn

# Frontend origin (CORS)
FRONTEND_ORIGIN=http://localhost:5173
```

Railway-н cloud Postgres ашиглах бол:
```bash
DATABASE_URL=$(railway variables get DATABASE_URL)
```

Эсвэл `.env`-эс `DATABASE_URL`-г `railway run npm run dev`-р хангуулна.

### Dependency суулгах

```bash
npm install
```

### Run

**Local DB:**
```bash
npm run dev
```

**Railway-н DB-тэй:**
```bash
railway run npm run dev
```

→ `http://localhost:3000`
→ `http://localhost:3000/docs` (Swagger UI)

Гаралт:
```
{"level":30,"msg":"Server listening on http://0.0.0.0:3000"}
{"level":30,"msg":"Postgres pool ready"}
```

### Test ажиллуулах

```bash
npm test            # бүх unit + integration
npm run test:watch  # хяналттай
npm run test:cov    # coverage report
```

---

## 8. Frontend ажиллуулах

```bash
cd frontend
npx serve -p 5173
# → http://localhost:5173
```

Эсвэл VS Code Live Server extension хэрэглэж болно.

---

## 9. Database migration (`dbmate`)

### Суулгах

**macOS / Linux:**
```bash
brew install dbmate
```

**Windows:**
```powershell
scoop install dbmate
```

### Тохиргоо

`backend/.env`-д `DATABASE_URL` нь dbmate-ийн стандарт format-той тул шууд ажиллана.

### Хэрэглээ

```bash
cd backend
dbmate new add_seats_table        # Шинэ migration файл
# → db/migrations/20260520120000_add_seats_table.sql

dbmate status                      # Хэрэгжээгүй migration-ы жагсаалт
dbmate up                          # Бүх pending хэрэгжүүлэх
dbmate down                        # Сүүлийн migration буцаах
dbmate rollback                    # = down
```

### Migration файлын жишээ (Postgres)

```sql
-- migrate:up
CREATE TABLE seats (
  seat_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  flight_id    BIGINT NOT NULL REFERENCES flights(flight_id) ON DELETE CASCADE,
  seat_no      VARCHAR(5) NOT NULL,
  status       TEXT NOT NULL DEFAULT 'available'
               CHECK (status IN ('available','held','sold')),
  ticket_id    BIGINT NULL REFERENCES tickets(ticket_id),
  UNIQUE (flight_id, seat_no)
);

CREATE INDEX idx_seats_flight_status ON seats(flight_id, status);

-- migrate:down
DROP TABLE IF EXISTS seats;
```

---

## 10. VS Code тохиргоо (санал)

`.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.tabSize": 2,
  "editor.detectIndentation": false,
  "files.eol": "\n",
  "[sql]": { "editor.tabSize": 2 },
  "javascript.suggest.completeFunctionCalls": true,
  "editor.codeActionsOnSave": { "source.fixAll.eslint": true }
}
```

Зөвлөмжтэй extension:
- EditorConfig
- ESLint
- Prettier
- PostgreSQL (Chris Kolkman)
- REST Client
- Error Lens

---

## 11. Git workflow

```bash
git checkout -b feat/airport-autocomplete
# ... ажил хийх ...
git add .
git commit -m "feat(airports): add autocomplete endpoint"
git push -u origin feat/airport-autocomplete
# → GitHub дээр PR үүсгэх
```

Railway-д PR push хийхэд автомат preview environment үүсгэгдэнэ.

### Commit message формат (Conventional Commits)

| Prefix | Утга |
|---|---|
| `feat:` | Шинэ боломж |
| `fix:` | Алдааны засвар |
| `refactor:` | Шинэ боломж/алдаа биш |
| `docs:` | Зөвхөн баримт |
| `style:` | Зайтай, формат |
| `test:` | Зөвхөн тест |
| `chore:` | Build, dep |
| `db:` | Schema/migration |

---

## 12. Түгээмэл асуудлууд

### "psql: connection refused"
Postgres ажиллаагүй байна.
```bash
# macOS
brew services restart postgresql@16
# Linux
sudo systemctl status postgresql
# Docker
docker start pg-airguide
```

### "role 'postgres' does not exist"
macOS Homebrew нь `$USER`-аар хэрэглэгч үүсгэдэг. `postgres` user-ийг үүсгэх:
```bash
createuser -s postgres
```

### "Cannot find module 'fastify'"
Backend дотроос `npm install` ажиллуулсан эсэхээ шалга.

### Port 5432 эзлэгдсэн
Өөр Postgres ажиллаж байна. `docker ps` шалгана.

### Port 3000 эзлэгдсэн
```bash
# macOS / Linux:
lsof -ti:3000 | xargs kill -9
# Windows PowerShell:
Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

### CORS алдаа frontend → backend
`.env`-ийн `FRONTEND_ORIGIN`-ыг `http://localhost:5173` болгож шалгана. Backend restart хийх.

### Railway CLI "not linked"
```bash
railway link    # project сонгох
```

### `pg_trgm` extension олдоогүй
Local Postgres-д extension идэвхжүүлэх:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Railway-д энэ extension-ууд анхдагчаар idэвхтэй.

---

## 13. Дараагийн алхам

Setup амжилттай дууссан бол:
1. [ARCHITECTURE.md](ARCHITECTURE.md) уншиж стак, dataflow ойлгох.
2. [DATABASE.md](DATABASE.md) уншиж schema-г судлах.
3. [API.md](API.md) уншиж endpoint-уудыг таних.
4. [ROADMAP.md](ROADMAP.md#phase-1) — одоогийн phase-ийн task сонгох.
