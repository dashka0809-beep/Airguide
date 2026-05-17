# Database

> PostgreSQL 16 schema, migration, sample data.

Доор бичигдсэн файлууд **Phase 1**-д бөглөгдөнө. Phase 0-д зөвхөн **хавтасны бүтэц** болон тогтвортой extensions.sql л байна.

---

## Файлын бүтэц

```
db/
├── README.md            Энэ файл
├── extensions.sql       pg_trgm, pgcrypto, pg_stat_statements (тогтвортой)
├── schema.sql           (Phase 1) — PostgreSQL DDL, 10 хүснэгт + view + trigger
├── seed.sql             (Phase 1) — Sample data (airlines, airports, эхний flights)
├── migrations/          (Phase 1) — dbmate migration файлууд
│   └── YYYYMMDDHHMMSS_*.sql
└── queries/             (Phase 1) — analytical query, report SQL
    └── *.sql
```

---

## Phase 1-д хийгдэх ажил

[`docs/ROADMAP.md#phase-1`](../docs/ROADMAP.md#phase-1--backend-api-2-долоо-хоног) дотроос:

1. **MySQL → Postgres хөрвүүлэх:** `../airguide_database.sql` → `schema.sql`
   - `AUTO_INCREMENT` → `GENERATED ALWAYS AS IDENTITY`
   - `ENUM` → `TEXT CHECK (col IN (...))`
   - `DATETIME` → `TIMESTAMPTZ`
   - Trigger syntax → `LANGUAGE plpgsql`
2. **dbmate migration tool** суулгах
3. **`seats` хүснэгт** нэмэх migration — per-seat inventory (double-booking сэргийлэх)
4. **`tickets`-д partial unique** — `UNIQUE(passenger_id, flight_id) WHERE status='issued'`
5. **`audit_log` хүснэгт** — захиалга өөрчлөлтийн түүх
6. **`passengers.passport_no` nullable** — дотоодын нислэг, нярай
7. **Refund trigger** — `paid_amount` буурах
8. **Trigram index** — `airports.name`, `airports.city` (autocomplete)

---

## Жишээ хэрэглэх (Phase 1 дууссаны дараа)

```bash
# Local Postgres-д
createdb -U postgres airguide_db
psql -U postgres -d airguide_db -f db/extensions.sql
psql -U postgres -d airguide_db -f db/schema.sql
psql -U postgres -d airguide_db -f db/seed.sql

# Шалгах:
psql -U postgres -d airguide_db -c "\dt"  # 10 хүснэгт
psql -U postgres -d airguide_db -c "\dv"  # view-үүд
```

---

## Migration хийх

`db/migrations/` нь **dbmate-нийцтэй** формат (`-- migrate:up` /
`-- migrate:down`). Applied version-ууд `schema_migrations` хүснэгтэд
бүртгэгдэнэ. `schema.sql` нь fresh setup-ийн нэг файлт reference;
**өөрчлөлт бүр шинэ migration файлаар** ороход source of truth болно.

### Одоогийн migration-ууд
| Version | Файл | Тайлбар |
|---|---|---|
| `20260517120000` | `init.sql` | Анхны schema baseline (extensions + 11 хүснэгт + 2 view + 4 trigger fn) |
| `20260517120100` | `add_bookings_created_by_index.sql` | `bookings.created_by` FK index |

Production DB нь init-ээс өмнө apply хийгдсэн тул init-ийг **baseline**
(run-гүй бүртгэх)-ээр оруулсан.

### A. Python helper (Node/dbmate binary шаардахгүй)
```bash
export DATABASE_URL="postgresql://user:pass@host:port/db"
python scripts/apply_db.py migrate-status          # төлөв
python scripts/apply_db.py migrate                  # бүх pending apply
# Одоо байгаа DB-д init-г baseline, бусдыг apply:
python scripts/apply_db.py migrate --baseline 20260517120000
```
Apply нь transaction дотор ажиллана; алдаа гарвал rollback + зогсоно.

### B. dbmate binary (Railway дээр Node бий)
```bash
cd backend
npm run db:migrate     # = dbmate up (package.json script)
dbmate new <name>      # шинэ migration файл үүсгэх
dbmate status / rollback
```

### Шинэ migration нэмэх
1. `db/migrations/<YYYYMMDDHHMMSS>_<name>.sql` файл үүсгэ
2. `-- migrate:up` ба `-- migrate:down` хэсэгтэй бич
3. `python scripts/apply_db.py migrate` (эсвэл `dbmate up`)

[`docs/DATABASE.md#10-migration-дүрэм`](../docs/DATABASE.md#10-migration-дүрэм-dbmate) -г үзнэ үү.
