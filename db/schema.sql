-- =====================================================================
-- AIR GUIDE — PostgreSQL Schema
-- =====================================================================
-- DBMS: PostgreSQL 16+
-- Encoding: UTF8, Collation: en_US.UTF-8, Timezone: UTC
-- Extensions: pg_trgm, pgcrypto, pg_stat_statements
--
-- Энэ файл нь MySQL airguide_database.sql-ийн Postgres хөрвүүлэлт юм.
-- Phase 1-д шинэ нэмэгдсэн:
--   - audit_log хүснэгт (өөрчлөлтийн түүх)
--   - passengers.passport_no NULLABLE (дотоодын нислэг, нярай)
--   - tickets partial unique (UNIQUE WHERE status='issued')
--   - bookings.metadata JSONB
--   - Trigram index — airports.name, airports.city
--   - fn_set_updated_at trigger бүх хүснэгтэд
--   - Refund trigger (paid_amount буурах)
--
-- Хэрэглэх:
--   psql -U postgres -d airguide_db -f db/extensions.sql
--   psql -U postgres -d airguide_db -f db/schema.sql
--   psql -U postgres -d airguide_db -f db/seed.sql
--
-- Эсвэл Railway-д:
--   railway run psql < db/extensions.sql
--   railway run psql < db/schema.sql
--
-- ⚠️  Энэ schema нь idempotent — DROP IF EXISTS + CREATE.
-- Production-д шууд ажиллуулахгүй, dbmate migration ашиглах.
-- =====================================================================

-- =====================================================================
-- 0. CLEANUP (dev only — production-д migration ашигла)
-- =====================================================================
DROP TABLE IF EXISTS audit_log     CASCADE;
DROP TABLE IF EXISTS payments      CASCADE;
DROP TABLE IF EXISTS tickets       CASCADE;
DROP TABLE IF EXISTS passengers    CASCADE;
DROP TABLE IF EXISTS bookings      CASCADE;
DROP TABLE IF EXISTS flights       CASCADE;
DROP TABLE IF EXISTS aircraft      CASCADE;
DROP TABLE IF EXISTS airports      CASCADE;
DROP TABLE IF EXISTS airlines      CASCADE;
DROP TABLE IF EXISTS customers     CASCADE;
DROP TABLE IF EXISTS users         CASCADE;

DROP VIEW IF EXISTS v_booking_details;
DROP VIEW IF EXISTS v_flight_details;

DROP FUNCTION IF EXISTS fn_set_updated_at()           CASCADE;
DROP FUNCTION IF EXISTS fn_after_ticket_insert()      CASCADE;
DROP FUNCTION IF EXISTS fn_after_ticket_status_change() CASCADE;
DROP FUNCTION IF EXISTS fn_after_payment_change()     CASCADE;


-- =====================================================================
-- 1. USERS — Системд нэвтэрдэг ажилтан (admin, manager, agent)
-- =====================================================================
CREATE TABLE users (
    user_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username       VARCHAR(50)  NOT NULL UNIQUE,
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

COMMENT ON TABLE users IS 'Системийн ажилтан (admin / manager / agent)';

CREATE INDEX idx_users_role ON users(role);


-- =====================================================================
-- 2. CUSTOMERS — Үйлчлүүлэгч
-- =====================================================================
CREATE TABLE customers (
    customer_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    last_name     VARCHAR(60)  NOT NULL,
    first_name    VARCHAR(60)  NOT NULL,
    register_no   VARCHAR(20)  UNIQUE,
    passport_no   VARCHAR(20)  UNIQUE,
    birth_date    DATE,
    gender        CHAR(1) CHECK (gender IN ('M','F','O')),
    nationality   VARCHAR(60) DEFAULT 'Mongolian',
    email         VARCHAR(120) UNIQUE,
    phone         VARCHAR(20)  NOT NULL,
    address       VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE customers IS 'Үйлчлүүлэгч (билет захиалдаг хүн)';

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_name  ON customers(last_name, first_name);

-- Trigram — нэрээр fuzzy хайх (autocomplete)
CREATE INDEX idx_customers_name_trgm
    ON customers
    USING gin ((last_name || ' ' || first_name) gin_trgm_ops);


-- =====================================================================
-- 3. AIRLINES — Агаарын тээврийн компани
-- =====================================================================
CREATE TABLE airlines (
    airline_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    iata_code     CHAR(2)      NOT NULL UNIQUE,
    icao_code     CHAR(3)      UNIQUE,
    name          VARCHAR(120) NOT NULL,
    country       VARCHAR(60)  NOT NULL,
    logo_url      VARCHAR(255),
    website       VARCHAR(120),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE airlines IS 'Агаарын тээврийн компани (IATA/ICAO кодтой)';

CREATE INDEX idx_airlines_active ON airlines(is_active);


-- =====================================================================
-- 4. AIRPORTS — Нисэх онгоцны буудал
-- =====================================================================
CREATE TABLE airports (
    airport_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    iata_code     CHAR(3)      NOT NULL UNIQUE,
    icao_code     CHAR(4)      UNIQUE,
    name          VARCHAR(150) NOT NULL,
    city          VARCHAR(80)  NOT NULL,
    country       VARCHAR(60)  NOT NULL,
    timezone      VARCHAR(40)  DEFAULT 'UTC',
    latitude      NUMERIC(9,6),
    longitude     NUMERIC(9,6),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE airports IS 'Нисэх буудал (IATA код 3 үсэгтэй)';

CREATE INDEX idx_airports_city    ON airports(city);
CREATE INDEX idx_airports_country ON airports(country);

-- Trigram — "ulan" → "Ulaanbaatar" гэх мэт fuzzy хайлт (autocomplete)
CREATE INDEX idx_airports_name_trgm
    ON airports USING gin (name gin_trgm_ops);
CREATE INDEX idx_airports_city_trgm
    ON airports USING gin (city gin_trgm_ops);


-- =====================================================================
-- 5. AIRCRAFT — Онгоц (optional, гүн анализад)
-- =====================================================================
CREATE TABLE aircraft (
    aircraft_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    airline_id       BIGINT NOT NULL REFERENCES airlines(airline_id)
                     ON DELETE RESTRICT ON UPDATE CASCADE,
    model            VARCHAR(80) NOT NULL,
    registration_no  VARCHAR(20) UNIQUE,
    total_seats      SMALLINT NOT NULL CHECK (total_seats > 0),
    economy_seats    SMALLINT NOT NULL DEFAULT 0 CHECK (economy_seats  >= 0),
    business_seats   SMALLINT NOT NULL DEFAULT 0 CHECK (business_seats >= 0),
    first_seats      SMALLINT NOT NULL DEFAULT 0 CHECK (first_seats    >= 0),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (economy_seats + business_seats + first_seats = total_seats)
);

COMMENT ON TABLE aircraft IS 'Онгоцны мэдээлэл (нэг compания нэг ба түүнээс олон онгоцтой)';

CREATE INDEX idx_aircraft_airline ON aircraft(airline_id);


-- =====================================================================
-- 6. FLIGHTS — Нислэгийн хуваарь
-- =====================================================================
CREATE TABLE flights (
    flight_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    flight_number          VARCHAR(10) NOT NULL,
    airline_id             BIGINT NOT NULL REFERENCES airlines(airline_id)
                           ON DELETE RESTRICT ON UPDATE CASCADE,
    aircraft_id            BIGINT REFERENCES aircraft(aircraft_id)
                           ON DELETE SET NULL ON UPDATE CASCADE,
    origin_airport_id      BIGINT NOT NULL REFERENCES airports(airport_id)
                           ON DELETE RESTRICT ON UPDATE CASCADE,
    destination_airport_id BIGINT NOT NULL REFERENCES airports(airport_id)
                           ON DELETE RESTRICT ON UPDATE CASCADE,
    departure_time         TIMESTAMPTZ NOT NULL,
    arrival_time           TIMESTAMPTZ NOT NULL,
    duration_minutes       INTEGER NOT NULL CHECK (duration_minutes > 0),
    economy_price          NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (economy_price  >= 0),
    business_price         NUMERIC(10,2)                    CHECK (business_price >= 0),
    first_price            NUMERIC(10,2)                    CHECK (first_price    >= 0),
    available_seats        SMALLINT NOT NULL DEFAULT 0 CHECK (available_seats >= 0),
    status                 TEXT NOT NULL DEFAULT 'scheduled'
                           CHECK (status IN ('scheduled','boarding','departed','arrived','cancelled','delayed')),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (departure_time < arrival_time),
    CHECK (origin_airport_id <> destination_airport_id)
);

COMMENT ON TABLE flights IS 'Нислэгийн хуваарь';

CREATE INDEX idx_flights_departure ON flights(departure_time);
CREATE INDEX idx_flights_status    ON flights(status);

-- Covering index — flight search үндсэн query
CREATE INDEX idx_flights_route
    ON flights(origin_airport_id, destination_airport_id, departure_time);


-- =====================================================================
-- 7. BOOKINGS — Захиалга
-- =====================================================================
CREATE TABLE bookings (
    booking_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_code      VARCHAR(10) NOT NULL UNIQUE,
    customer_id       BIGINT NOT NULL REFERENCES customers(customer_id)
                      ON DELETE RESTRICT ON UPDATE CASCADE,
    created_by        BIGINT REFERENCES users(user_id)
                      ON DELETE SET NULL ON UPDATE CASCADE,
    booking_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    trip_type         TEXT NOT NULL DEFAULT 'one_way'
                      CHECK (trip_type IN ('one_way','round_trip','multi_city')),
    total_passengers  SMALLINT NOT NULL DEFAULT 1 CHECK (total_passengers > 0),
    total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    paid_amount       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount  >= 0),
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','confirmed','cancelled','completed','refunded')),
    metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE bookings IS 'Захиалга (нэг customer-ийн нэг trip)';
COMMENT ON COLUMN bookings.metadata IS 'Schema-гүй өгөгдөл: marketing campaign, referral, special request';

CREATE INDEX idx_bookings_status    ON bookings(status);
CREATE INDEX idx_bookings_date      ON bookings(booking_date);
CREATE INDEX idx_bookings_customer  ON bookings(customer_id);
CREATE INDEX idx_bookings_metadata  ON bookings USING gin (metadata);


-- =====================================================================
-- 8. PASSENGERS — Захиалга доторх зорчигч
--    ⚠️  passport_no NULLABLE (Phase 1 өөрчлөлт)
--        дотоодын нислэг, нярай, мобайл захиалга
-- =====================================================================
CREATE TABLE passengers (
    passenger_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id      BIGINT NOT NULL REFERENCES bookings(booking_id)
                    ON DELETE CASCADE ON UPDATE CASCADE,
    last_name       VARCHAR(60) NOT NULL,
    first_name      VARCHAR(60) NOT NULL,
    passport_no     VARCHAR(20),  -- ⚠️ NULL зөвшөөрөгдсөн (MySQL: NOT NULL байсан)
    passport_expiry DATE,
    birth_date      DATE NOT NULL,
    gender          CHAR(1) NOT NULL CHECK (gender IN ('M','F','O')),
    nationality     VARCHAR(60) NOT NULL DEFAULT 'Mongolian',
    passenger_type  TEXT NOT NULL DEFAULT 'adult'
                    CHECK (passenger_type IN ('adult','child','infant')),
    seat_number     VARCHAR(5),
    meal_preference VARCHAR(30),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE passengers IS 'Захиалгын зорчигчид';

CREATE INDEX idx_passengers_booking  ON passengers(booking_id);
CREATE INDEX idx_passengers_passport ON passengers(passport_no)
    WHERE passport_no IS NOT NULL;


-- =====================================================================
-- 9. TICKETS — Билет (passenger + flight = ticket)
--    ⚠️  Postgres-н partial unique — нэг зорчигч нэг нислэгт
--        нэг л идэвхтэй билет (cancelled нь хязгаар хийхгүй)
-- =====================================================================
CREATE TABLE tickets (
    ticket_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticket_number  VARCHAR(20) NOT NULL UNIQUE,
    booking_id     BIGINT NOT NULL REFERENCES bookings(booking_id)
                   ON DELETE CASCADE ON UPDATE CASCADE,
    passenger_id   BIGINT NOT NULL REFERENCES passengers(passenger_id)
                   ON DELETE CASCADE ON UPDATE CASCADE,
    flight_id      BIGINT NOT NULL REFERENCES flights(flight_id)
                   ON DELETE RESTRICT ON UPDATE CASCADE,
    class_type     TEXT NOT NULL DEFAULT 'economy'
                   CHECK (class_type IN ('economy','business','first')),
    price          NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    baggage_kg     SMALLINT DEFAULT 20 CHECK (baggage_kg >= 0),
    status         TEXT NOT NULL DEFAULT 'issued'
                   CHECK (status IN ('issued','used','cancelled','refunded')),
    issued_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tickets IS 'Билет (passenger + flight нэг бүрт нэг идэвхтэй)';

CREATE INDEX idx_tickets_flight ON tickets(flight_id);
CREATE INDEX idx_tickets_status ON tickets(status);

-- ⭐ PARTIAL UNIQUE — Postgres-н гол давуу тал
-- Нэг зорчигч нэг нислэгт зөвхөн нэг идэвхтэй билет авна.
-- Cancelled / refunded билет хязгаар үүсгэхгүй.
CREATE UNIQUE INDEX uniq_passenger_flight_issued
    ON tickets (passenger_id, flight_id)
    WHERE status = 'issued';


-- =====================================================================
-- 10. PAYMENTS — Төлбөрийн гүйлгээ
-- =====================================================================
CREATE TABLE payments (
    payment_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id     BIGINT NOT NULL REFERENCES bookings(booking_id)
                   ON DELETE RESTRICT ON UPDATE CASCADE,
    amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency       CHAR(3) NOT NULL DEFAULT 'MNT',
    payment_method TEXT NOT NULL
                   CHECK (payment_method IN ('cash','card','bank_transfer','qpay','socialpay','other')),
    transaction_no VARCHAR(60),
    status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','success','failed','refunded')),
    paid_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_by    BIGINT REFERENCES users(user_id)
                   ON DELETE SET NULL ON UPDATE CASCADE,
    notes          VARCHAR(255),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE payments IS 'Төлбөрийн гүйлгээ';

CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_status  ON payments(status);
CREATE INDEX idx_payments_date    ON payments(paid_at);


-- =====================================================================
-- 11. AUDIT_LOG — Өөрчлөлтийн түүх (Phase 1 шинэ)
--     Захиалга, төлбөр, нислэг г.м гол өгөгдлийн өөрчлөлтийг бичнэ
-- =====================================================================
CREATE TABLE audit_log (
    audit_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name   VARCHAR(40) NOT NULL,
    record_id    BIGINT NOT NULL,
    action       TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
    user_id      BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    old_data     JSONB,
    new_data     JSONB,
    ip_address   INET,
    user_agent   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_log IS 'Бүх чухал өгөгдлийн өөрчлөлтийн түүх (GDPR-д ч хэрэгтэй)';

CREATE INDEX idx_audit_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_user         ON audit_log(user_id);
CREATE INDEX idx_audit_date         ON audit_log(created_at DESC);


-- =====================================================================
-- VIEWS
-- =====================================================================

-- Захиалгын дэлгэрэнгүй харах
CREATE OR REPLACE VIEW v_booking_details AS
SELECT
    b.booking_id,
    b.booking_code,
    b.booking_date,
    b.status                              AS booking_status,
    b.trip_type,
    c.customer_id,
    c.last_name || ' ' || c.first_name    AS customer_name,
    c.phone                               AS customer_phone,
    c.email                               AS customer_email,
    b.total_passengers,
    b.total_amount,
    b.paid_amount,
    (b.total_amount - b.paid_amount)      AS balance_due,
    u.full_name                           AS agent_name,
    b.metadata,
    b.created_at,
    b.updated_at
FROM bookings b
JOIN customers c ON c.customer_id = b.customer_id
LEFT JOIN users u ON u.user_id = b.created_by;

COMMENT ON VIEW v_booking_details IS 'Захиалгын дэлгэрэнгүй (customer + agent нэртэй)';


-- Нислэгийн дэлгэрэнгүй (origin/destination нэртэй)
CREATE OR REPLACE VIEW v_flight_details AS
SELECT
    f.flight_id,
    f.flight_number,
    a.airline_id,
    a.name           AS airline_name,
    a.iata_code      AS airline_code,
    a.logo_url       AS airline_logo,
    o.airport_id     AS origin_airport_id,
    o.iata_code      AS origin_code,
    o.name           AS origin_name,
    o.city           AS origin_city,
    o.country        AS origin_country,
    d.airport_id     AS dest_airport_id,
    d.iata_code      AS dest_code,
    d.name           AS dest_name,
    d.city           AS dest_city,
    d.country        AS dest_country,
    f.departure_time,
    f.arrival_time,
    f.duration_minutes,
    f.economy_price,
    f.business_price,
    f.first_price,
    f.available_seats,
    f.status,
    ac.model         AS aircraft_model,
    ac.total_seats   AS aircraft_total_seats
FROM flights f
JOIN airlines a  ON a.airline_id  = f.airline_id
JOIN airports o  ON o.airport_id  = f.origin_airport_id
JOIN airports d  ON d.airport_id  = f.destination_airport_id
LEFT JOIN aircraft ac ON ac.aircraft_id = f.aircraft_id;

COMMENT ON VIEW v_flight_details IS 'Нислэгийн дэлгэрэнгүй (search API-д шууд ашиглах)';


-- =====================================================================
-- TRIGGER FUNCTIONS (LANGUAGE plpgsql)
-- =====================================================================

-- 1) Updated_at автомат шинэчлэх — бүх хүснэгтэд адил
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 2) Шинэ билет нэмэгдэхэд нислэгийн suudal -1
CREATE OR REPLACE FUNCTION fn_after_ticket_insert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'issued' THEN
        UPDATE flights
           SET available_seats = available_seats - 1,
               updated_at      = NOW()
         WHERE flight_id = NEW.flight_id
           AND available_seats > 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 3) Билет цуцлагдвал/буцаагдвал suudal буцаах
CREATE OR REPLACE FUNCTION fn_after_ticket_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- issued → cancelled / refunded → suudal +1
    IF OLD.status = 'issued' AND NEW.status IN ('cancelled','refunded') THEN
        UPDATE flights
           SET available_seats = available_seats + 1,
               updated_at      = NOW()
         WHERE flight_id = NEW.flight_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 4) Төлбөрийн өөрчлөлт → bookings.paid_amount шинэчлэх
--    INSERT success → нэмэх
--    UPDATE success → refunded → буцаах (Phase 1 шинэ)
CREATE OR REPLACE FUNCTION fn_after_payment_change()
RETURNS TRIGGER AS $$
BEGIN
    -- 1) Шинэ амжилттай төлбөр
    IF TG_OP = 'INSERT' AND NEW.status = 'success' THEN
        UPDATE bookings
           SET paid_amount = paid_amount + NEW.amount,
               status = CASE
                          WHEN (paid_amount + NEW.amount) >= total_amount THEN 'confirmed'
                          ELSE status
                        END,
               updated_at = NOW()
         WHERE booking_id = NEW.booking_id;

    -- 2) success → refunded (буцаалт)
    ELSIF TG_OP = 'UPDATE'
          AND OLD.status = 'success'
          AND NEW.status = 'refunded' THEN
        UPDATE bookings
           SET paid_amount = GREATEST(paid_amount - OLD.amount, 0),
               updated_at  = NOW()
         WHERE booking_id = NEW.booking_id;

    -- 3) pending → success (delayed confirmation)
    ELSIF TG_OP = 'UPDATE'
          AND OLD.status = 'pending'
          AND NEW.status = 'success' THEN
        UPDATE bookings
           SET paid_amount = paid_amount + NEW.amount,
               status = CASE
                          WHEN (paid_amount + NEW.amount) >= total_amount THEN 'confirmed'
                          ELSE status
                        END,
               updated_at = NOW()
         WHERE booking_id = NEW.booking_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- updated_at триггерүүд (бүх хүснэгтэд)
CREATE TRIGGER trg_users_updated_at      BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_customers_updated_at  BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_airlines_updated_at   BEFORE UPDATE ON airlines
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_airports_updated_at   BEFORE UPDATE ON airports
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_aircraft_updated_at   BEFORE UPDATE ON aircraft
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_flights_updated_at    BEFORE UPDATE ON flights
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_bookings_updated_at   BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_passengers_updated_at BEFORE UPDATE ON passengers
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_tickets_updated_at    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_payments_updated_at   BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Билетийн логик
CREATE TRIGGER trg_after_ticket_insert
    AFTER INSERT ON tickets
    FOR EACH ROW EXECUTE FUNCTION fn_after_ticket_insert();

CREATE TRIGGER trg_after_ticket_status_change
    AFTER UPDATE OF status ON tickets
    FOR EACH ROW EXECUTE FUNCTION fn_after_ticket_status_change();

-- Төлбөрийн логик
CREATE TRIGGER trg_after_payment_change
    AFTER INSERT OR UPDATE OF status ON payments
    FOR EACH ROW EXECUTE FUNCTION fn_after_payment_change();


-- =====================================================================
-- ХӨГЖҮҮЛЭГЧДЭД: SCHEMA БЭЛЭН БОЛСНЫГ ШАЛГАХ QUERY-УУД
-- =====================================================================

-- 1) Хүснэгтүүдийн жагсаалт
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' ORDER BY table_name;
-- Хүлээгдэх гаралт: 11 хүснэгт (audit_log нэмэгдсэн)

-- 2) Index-үүдийн жагсаалт
--   SELECT indexname FROM pg_indexes WHERE schemaname='public' ORDER BY indexname;

-- 3) Trigger-үүдийн жагсаалт
--   SELECT trigger_name, event_manipulation, event_object_table
--   FROM information_schema.triggers
--   WHERE trigger_schema='public' ORDER BY event_object_table;

-- 4) Extension-үүд идэвхтэй эсэх
--   SELECT extname, extversion FROM pg_extension ORDER BY extname;
-- Хүлээгдэх: plpgsql, pg_trgm, pgcrypto, pg_stat_statements

-- =====================================================================
-- ТӨГСГӨЛ — Schema бэлэн!
-- Дараа нь: db/seed.sql -р sample data ачаалах
-- =====================================================================
