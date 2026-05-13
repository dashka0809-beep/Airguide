# Database

> PostgreSQL schema загвар, ER харилцаа, indexing, transaction, шинэ migration нэмэх дүрэм.

---

## 1. Үндсэн мэдээлэл

| Параметр | Утга |
|---|---|
| Engine | **PostgreSQL 16+** |
| Database | `airguide_db` |
| Encoding | `UTF8` |
| Collation | `en_US.UTF-8` |
| Timezone | `UTC` (DB), Asia/Ulaanbaatar (app түвшинд convert) |
| Extensions | `pg_trgm` (fuzzy search), `pgcrypto` (random/UUID), `pg_stat_statements` (perf) |

**Хостинг:** Railway managed Postgres. Production-д snapshot daily, retention 7 хоног, point-in-time recovery боломжтой.

---

## 2. ER харилцаа

```
┌─────────────┐
│   users     │   (admin, manager, agent)
└──────┬──────┘
       │ 1
       │
       │ N
       ▼
┌─────────────┐      ┌──────────────┐
│  bookings   │◄─────┤  customers   │  1
│             │ N    │              │
└──┬──┬──┬────┘ 1    └──────────────┘
   │  │  │
 N │  │ N│ N
   ▼  │  ▼
┌──────┐│┌──────────┐
│passen││ payments │
│ gers ││└──────────┘
└──┬───┘│
 N │    │
   ▼    ▼
┌──────────┐    ┌──────────┐    ┌──────────┐
│ tickets  ├───►│ flights  ├───►│ airlines │
└──────────┘ N  └────┬─────┘ N  └──────────┘
                  N  │
                     ├──► airports (origin)
                     └──► airports (dest)
```

**Гол санаа:**
- `users` нь системийн ажилтан (нэвтэрдэг).
- `customers` нь үйлчлүүлэгч (захиалга өгдөг).
- `bookings` нэг `customer`-т хамаардаг, олон `passengers`, `tickets`, `payments` агуулна.
- `tickets` нэг `passenger` + нэг `flight`-той холбоотой.

---

## 3. Хүснэгтийн тойм

| Хүснэгт | Зорилго | Мөрийн тоо (тооцоо/жил) |
|---|---|---|
| `users` | Ажилтан, админ | ~ 50 |
| `customers` | Үйлчлүүлэгч | ~ 50,000 |
| `airlines` | Агаарын компани | ~ 20 |
| `airports` | Нисэх буудал | ~ 500 |
| `aircraft` | Онгоц (option) | ~ 100 |
| `flights` | Нислэгийн хуваарь | ~ 50,000 |
| `bookings` | Захиалга | ~ 200,000 |
| `passengers` | Зорчигч | ~ 500,000 |
| `tickets` | Билет | ~ 600,000 |
| `payments` | Төлбөр | ~ 250,000 |

**5 жилийн дараа:** нийт DB хэмжээ ~ 5 GB (Railway Pro plan-ын дотор асуудалгүй).

---

## 4. MySQL → Postgres хөрвүүлэлт (Phase 1 эхэнд)

Анхны `airguide_database.sql` нь MySQL-д бичигдсэн. Postgres руу хөрвүүлэхэд гол өөрчлөлтүүд:

| MySQL | Postgres |
|---|---|
| `INT UNSIGNED AUTO_INCREMENT PRIMARY KEY` | `BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY` |
| `TINYINT UNSIGNED` | `SMALLINT CHECK (col >= 0)` |
| `ENUM('a','b','c')` | `TEXT CHECK (col IN ('a','b','c'))` эсвэл native `CREATE TYPE` |
| `DATETIME DEFAULT CURRENT_TIMESTAMP` | `TIMESTAMPTZ DEFAULT NOW()` |
| `ON UPDATE CURRENT_TIMESTAMP` | trigger-ээр гар хийх |
| `BOOLEAN` | `BOOLEAN` (адил) |
| `LAST_INSERT_ID()` | `RETURNING id` clause |
| `DELIMITER //` | байхгүй, `$$ ... $$` block |
| `CONCAT(a,b)` | `a || b` эсвэл `CONCAT()` |
| `IFNULL(a,b)` | `COALESCE(a,b)` |
| `DATE_FORMAT(d,'%Y-%m')` | `TO_CHAR(d,'YYYY-MM')` |
| `idx_*` (manual) | `CREATE INDEX` (нэр сонголтын) |
| Partial unique (workaround) | `UNIQUE … WHERE` шууд |

---

## 5. Хүснэгт бүрийн дэлгэрэнгүй

### 5.1 `users`

```sql
CREATE TABLE users (
  user_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username       VARCHAR(50) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  full_name      VARCHAR(100) NOT NULL,
  email          VARCHAR(120) NOT NULL UNIQUE,
  phone          VARCHAR(20),
  role           TEXT NOT NULL DEFAULT 'agent'
                 CHECK (role IN ('admin','manager','agent')),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
```

**Анхаар:** `password_hash` нь bcrypt cost ≥ 12.

### 5.2 `customers`

```sql
CREATE TABLE customers (
  customer_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  last_name     VARCHAR(60) NOT NULL,
  first_name    VARCHAR(60) NOT NULL,
  register_no   VARCHAR(20) UNIQUE,
  passport_no   VARCHAR(20) UNIQUE,
  birth_date    DATE,
  gender        CHAR(1) CHECK (gender IN ('M','F','O')),
  nationality   VARCHAR(60) DEFAULT 'Mongolian',
  email         VARCHAR(120) UNIQUE,
  phone         VARCHAR(20) NOT NULL,
  address       VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_name ON customers(last_name, first_name);

-- Trigram нэр хайхад
CREATE INDEX idx_customers_name_trgm
  ON customers USING gin ((last_name || ' ' || first_name) gin_trgm_ops);
```

### 5.3 `airlines`

`iata_code` (CHAR 2) + `icao_code` (CHAR 3) — IATA стандарт.

### 5.4 `airports`

```sql
CREATE TABLE airports (
  airport_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  iata_code   CHAR(3) NOT NULL UNIQUE,
  icao_code   CHAR(4) UNIQUE,
  name        VARCHAR(150) NOT NULL,
  city        VARCHAR(80) NOT NULL,
  country     VARCHAR(60) NOT NULL,
  timezone    VARCHAR(40) DEFAULT 'UTC',
  latitude    NUMERIC(9,6),
  longitude   NUMERIC(9,6)
);

CREATE INDEX idx_airports_city ON airports(city);
CREATE INDEX idx_airports_country ON airports(country);

-- Autocomplete-д: fuzzy match
CREATE INDEX idx_airports_name_trgm ON airports USING gin (name gin_trgm_ops);
CREATE INDEX idx_airports_city_trgm ON airports USING gin (city gin_trgm_ops);
```

**Хайлтын query:**
```sql
SELECT iata_code, name, city
FROM airports
WHERE city ILIKE $1 || '%'
   OR name ILIKE '%' || $1 || '%'
   OR iata_code ILIKE $1 || '%'
ORDER BY similarity(city, $1) DESC
LIMIT 10;
```

### 5.5 `flights`

```sql
CREATE TABLE flights (
  flight_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  flight_number          VARCHAR(10) NOT NULL,
  airline_id             BIGINT NOT NULL REFERENCES airlines(airline_id),
  aircraft_id            BIGINT REFERENCES aircraft(aircraft_id),
  origin_airport_id      BIGINT NOT NULL REFERENCES airports(airport_id),
  destination_airport_id BIGINT NOT NULL REFERENCES airports(airport_id),
  departure_time         TIMESTAMPTZ NOT NULL,
  arrival_time           TIMESTAMPTZ NOT NULL,
  duration_minutes       INTEGER NOT NULL CHECK (duration_minutes > 0),
  economy_price          NUMERIC(10,2) NOT NULL DEFAULT 0,
  business_price         NUMERIC(10,2),
  first_price            NUMERIC(10,2),
  available_seats        SMALLINT NOT NULL DEFAULT 0 CHECK (available_seats >= 0),
  status                 TEXT NOT NULL DEFAULT 'scheduled'
                         CHECK (status IN ('scheduled','boarding','departed','arrived','cancelled','delayed')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (departure_time < arrival_time),
  CHECK (origin_airport_id <> destination_airport_id)
);

CREATE INDEX idx_flights_departure ON flights(departure_time);
CREATE INDEX idx_flights_route
  ON flights(origin_airport_id, destination_airport_id, departure_time);
CREATE INDEX idx_flights_status ON flights(status);
```

### 5.6 `bookings`

```sql
CREATE TABLE bookings (
  booking_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_code      VARCHAR(10) NOT NULL UNIQUE,
  customer_id       BIGINT NOT NULL REFERENCES customers(customer_id),
  created_by        BIGINT REFERENCES users(user_id),
  booking_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trip_type         TEXT NOT NULL DEFAULT 'one_way'
                    CHECK (trip_type IN ('one_way','round_trip','multi_city')),
  total_passengers  SMALLINT NOT NULL DEFAULT 1 CHECK (total_passengers > 0),
  total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','cancelled','completed','refunded')),
  metadata          JSONB DEFAULT '{}',
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_metadata ON bookings USING gin (metadata);
```

**`metadata` jsonb-н хэрэглээ:** marketing campaign, referral source, special requests гэх мэт schema-гүй өгөгдөл.

### 5.7 `passengers`

`passport_no` нь Phase 1-д **nullable** болоно (дотоодын нислэг, нярай).

### 5.8 `tickets`

**Postgres-ийн чухал давуу тал — partial unique index:**

```sql
CREATE UNIQUE INDEX uniq_passenger_flight_issued
  ON tickets (passenger_id, flight_id)
  WHERE status = 'issued';
```

Энэ нь нэг зорчигч нэг нислэгт зөвхөн нэг идэвхтэй билет авахыг баталгаажуулна. Cancel хийсэн билет-уудыг зөвшөөрнө.

### 5.9 `payments`

`status` нь `pending|success|failed|refunded`. Currency default `MNT`.

---

## 6. Views

### `v_booking_details`

Захиалгын дэлгэрэнгүй (хэрэглэгчийн нэр, төлбөрийн үлдэгдэл) join хийсэн.

```sql
CREATE OR REPLACE VIEW v_booking_details AS
SELECT
  b.booking_id,
  b.booking_code,
  b.booking_date,
  b.status                              AS booking_status,
  c.last_name || ' ' || c.first_name    AS customer_name,
  c.phone                               AS customer_phone,
  b.total_passengers,
  b.total_amount,
  b.paid_amount,
  b.total_amount - b.paid_amount        AS balance_due,
  u.full_name                           AS agent_name
FROM bookings b
JOIN customers c ON c.customer_id = b.customer_id
LEFT JOIN users u ON u.user_id = b.created_by;
```

### `v_flight_details`

Нислэг + airline + origin + destination нэрс. Хайлтын API-д ашиглана.

### `mv_monthly_revenue` (materialized view, Phase 4)

```sql
CREATE MATERIALIZED VIEW mv_monthly_revenue AS
SELECT
  TO_CHAR(paid_at, 'YYYY-MM') AS month,
  SUM(amount)                  AS total_revenue,
  COUNT(*)                     AS payment_count
FROM payments
WHERE status = 'success'
GROUP BY 1
ORDER BY 1 DESC;

CREATE UNIQUE INDEX ON mv_monthly_revenue(month);

-- Refresh өдөр бүр:
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_revenue;
```

---

## 7. Trigger-үүд

Postgres-д `LANGUAGE plpgsql` дотор:

```sql
-- Шинэ билет нэмэгдэхэд suudal -1
CREATE OR REPLACE FUNCTION fn_after_ticket_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'issued' THEN
    UPDATE flights
       SET available_seats = available_seats - 1
     WHERE flight_id = NEW.flight_id
       AND available_seats > 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_after_ticket_insert
  AFTER INSERT ON tickets
  FOR EACH ROW EXECUTE FUNCTION fn_after_ticket_insert();
```

**Шинэчлэгдсэн payment trigger (refund мөн handle хийдэг):**

```sql
CREATE OR REPLACE FUNCTION fn_after_payment_change()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT success
  IF TG_OP = 'INSERT' AND NEW.status = 'success' THEN
    UPDATE bookings
       SET paid_amount = paid_amount + NEW.amount,
           status = CASE
             WHEN paid_amount + NEW.amount >= total_amount THEN 'confirmed'
             ELSE status
           END
     WHERE booking_id = NEW.booking_id;
  END IF;

  -- UPDATE success → refunded
  IF TG_OP = 'UPDATE' AND OLD.status = 'success' AND NEW.status = 'refunded' THEN
    UPDATE bookings
       SET paid_amount = paid_amount - OLD.amount
     WHERE booking_id = NEW.booking_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_after_payment_change
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION fn_after_payment_change();
```

**`updated_at` авто-шинэчлэх (бүх хүснэгтэд):**

```sql
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
-- (бусад хүснэгтэд адил)
```

---

## 8. Indexing зарчим

1. **PK байгалийн B-tree** (IDENTITY).
2. **FK багана бүрт** index гар үүсгэх (Postgres автоматаар үүсгэдэггүй MySQL-аас ялгаатай!).
3. **WHERE/ORDER BY-д орох** баганад нэмэлт.
4. **Compound index** баруунаас зүүн тийш query-ийн нөхцөлийг тааруулах.
5. **GIN index** `jsonb`, `tsvector`, trigram-д.
6. **Partial index** статус шүүлттэй query-д (`WHERE status='active'`).
7. **EXPLAIN ANALYZE** ашиглан `Seq Scan` биш `Index Scan`/`Bitmap Index Scan` болохыг шалга.

**Үндсэн query-ийн index ашиглалт:**

```sql
EXPLAIN ANALYZE
SELECT * FROM v_flight_details
WHERE origin_code='ULN' AND dest_code='ICN'
  AND departure_time::date='2026-06-15';
-- → Index Scan using idx_flights_route
```

---

## 9. Transaction-ы хэв маяг

### Захиалга үүсгэх (Postgres atomic)

```js
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const client = await pool.connect();
try {
  await client.query('BEGIN');

  // 1) Seat lock
  const flightRes = await client.query(
    'SELECT available_seats FROM flights WHERE flight_id=$1 FOR UPDATE',
    [flightId]
  );
  if (flightRes.rows[0].available_seats < passengers.length) {
    throw new Error('SEATS_UNAVAILABLE');
  }

  // 2) UPSERT customer
  const custRes = await client.query(`
    INSERT INTO customers (last_name, first_name, phone, email)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (phone) DO UPDATE
      SET email = EXCLUDED.email,
          updated_at = NOW()
    RETURNING customer_id
  `, [lastName, firstName, phone, email]);
  const customerId = custRes.rows[0].customer_id;

  // 3) INSERT booking
  const bkRes = await client.query(`
    INSERT INTO bookings (booking_code, customer_id, total_amount, total_passengers)
    VALUES ($1, $2, $3, $4)
    RETURNING booking_id, booking_code
  `, [generateCode(), customerId, total, passengers.length]);
  const bookingId = bkRes.rows[0].booking_id;

  // 4) INSERT passengers + tickets (loop)
  for (const p of passengers) {
    const pasRes = await client.query(/* INSERT passengers ... RETURNING passenger_id */);
    await client.query(/* INSERT tickets — trigger seat-- */);
  }

  await client.query('COMMIT');
  return { booking_code: bkRes.rows[0].booking_code };
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

**`ON CONFLICT` нь MySQL-ийн `ON DUPLICATE KEY UPDATE`-аас цэвэрхэн.**

---

## 10. Migration дүрэм (`dbmate`)

```bash
dbmate new add_seats_table
# → db/migrations/20260520120000_add_seats_table.sql
```

**Файлын формат:**

```sql
-- migrate:up
CREATE TABLE seats (
  seat_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  flight_id  BIGINT NOT NULL REFERENCES flights(flight_id) ON DELETE CASCADE,
  seat_no    VARCHAR(5) NOT NULL,
  status     TEXT NOT NULL DEFAULT 'available'
             CHECK (status IN ('available','held','sold')),
  ticket_id  BIGINT REFERENCES tickets(ticket_id),
  UNIQUE (flight_id, seat_no)
);

CREATE INDEX idx_seats_flight_status ON seats(flight_id, status);

-- migrate:down
DROP TABLE IF EXISTS seats;
```

**Дүрэм:**
1. Postgres-ийн **transactional DDL** ашиглах — DDL transaction дотор fail хийвэл бүх change rollback болно.
2. Production-д **DROP COLUMN** хийхгүй (deprecated тэмдэг + 2 release дараа арилгах).
3. Том ALTER хийхдээ `CREATE INDEX CONCURRENTLY` ашиглах (lock авахгүй).
4. Migration-ыг **тэгшилж** (`up` + `down` нийцтэй) бичих.
5. Railway preview environment дээр test хийгээд production deploy.

---

## 11. Backup ба recovery

**Railway автомат:**
- Daily snapshot (07:00 UTC)
- 7 хоног retention
- Point-in-time recovery (PITR) — Pro plan
- 1 товчоор restore хийх боломжтой Railway dashboard-аас

**Гар backup (нэмэлт хадгалалт):**
```bash
railway run pg_dump --format=custom airguide_db > airguide_$(date +%F).dump
```

**Cron-р S3 руу нэмэлт хуулах (зөвлөмж):**
```bash
railway run pg_dump --format=custom airguide_db | \
  gzip | aws s3 cp - s3://airguide-backups/$(date +%F).dump.gz
```

**Restore тест:** сард 1 удаа staging Railway environment дээр restore хийж туршина.

---

## 12. Performance ажиглалт

| Шалгах зүйл | Хэрэгсэл | Босго |
|---|---|---|
| Slow query | `pg_stat_statements` extension | > 200 ms долоо хоног бүр review |
| Cache hit ratio | `pg_stat_database` | > 99% |
| Connection count | `pg_stat_activity` | < `max_connections × 0.7` |
| Table bloat | `pg_stat_user_tables.n_dead_tup` | dead_tup < live_tup × 0.2 |
| Index unused | `pg_stat_user_indexes` | idx_scan = 0 → устгахыг бод |

**Хэрэгтэй query:**
```sql
-- Хамгийн удаан query (cumulative)
SELECT calls, mean_exec_time, query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;

-- Хэрэглэгдээгүй index
SELECT schemaname, relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0;
```

---

## 13. Postgres-ийн өвөрмөц давуу талууд (хэрэглэх боломж)

| Боломж | Хэрэглэх жишээ |
|---|---|
| `jsonb` + GIN | `bookings.metadata`-аас аль ч талбараар хайх |
| `pg_trgm` | "ulan" → "Ulaanbaatar" автомат заасан |
| Partial unique | Идэвхтэй билет нэг л байх |
| Window function | "Энэ долоо хоногийн топ 5 хот" tайлан |
| CTE / `WITH RECURSIVE` | Олон шилжилттэй нислэгийн зам тооцоолох |
| Materialized view | `mv_monthly_revenue` heavy report cache |
| `LISTEN`/`NOTIFY` | Real-time захиалгын төлөв (Phase 6) |
| `tsvector` | Бүрэн full-text search |
| `gen_random_uuid()` | UUID үүсгэх (pgcrypto) |

---

## 14. Phase 1 дээр заавал хийх засвар

1. **SQL хөрвүүлэх** — `airguide_database.sql` → `db/schema.sql` (Postgres)
2. **`seats` хүснэгт** — double-booking арилгах
3. **Partial unique** — `tickets (passenger_id, flight_id) WHERE status='issued'`
4. **Refund trigger** — paid_amount буурдаг болгох
5. **`audit_log`** — захиалга өөрчлөлтийн түүх
6. **`passport_no` nullable** — passengers дээр
7. **Extension idэвхжүүлэх** — `pg_trgm`, `pgcrypto`, `pg_stat_statements`

Жагсаалтын дэлгэрэнгүй [ROADMAP.md](ROADMAP.md#phase-1).
