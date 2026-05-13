-- =====================================================================
--  AIR GUIDE — Агаарын тээврийн агентлагийн өгөгдлийн сангийн загвар
--  DBMS: MySQL 8.0 / MariaDB 10.6+
--  Зохиогч: Air Guide LLC
--  Огноо: 2026-05-11
-- =====================================================================
--
--  ХҮСНЭГТҮҮДИЙН ХАРИЛЦАА (ER):
--
--   users (Системийн хэрэглэгч)
--      └── bookings.created_by (захиалга үүсгэсэн оператор)
--
--   customers (Үйлчлүүлэгч)
--      └── bookings.customer_id (1 → N захиалга)
--
--   airlines (Агаарын компани) ──┐
--   airports (Буудал) ───────────┤
--                                ▼
--                            flights (Нислэг)
--                                └── tickets.flight_id (1 → N билет)
--
--   bookings (Захиалга)
--      ├── passengers (1 → N зорчигч)
--      ├── tickets (1 → N билет)
--      └── payments (1 → N төлбөр)
--
-- =====================================================================

-- Өгөгдлийн сан үүсгэх
CREATE DATABASE IF NOT EXISTS airguide_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE airguide_db;

-- Хэрвээ хүснэгтүүд хуучин байвал устгах (зөвхөн dev орчинд)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS passengers;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS flights;
DROP TABLE IF EXISTS aircraft;
DROP TABLE IF EXISTS airports;
DROP TABLE IF EXISTS airlines;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
--  1. USERS — Системд нэвтэрдэг ажилтнууд (админ, оператор)
-- =====================================================================
CREATE TABLE users (
    user_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username       VARCHAR(50)  NOT NULL UNIQUE COMMENT 'Нэвтрэх нэр',
    password_hash  VARCHAR(255) NOT NULL        COMMENT 'Hash хийсэн нууц үг',
    full_name      VARCHAR(100) NOT NULL        COMMENT 'Овог нэр',
    email          VARCHAR(120) NOT NULL UNIQUE COMMENT 'Имэйл',
    phone          VARCHAR(20)                  COMMENT 'Утас',
    role           ENUM('admin','manager','agent') NOT NULL DEFAULT 'agent'
                   COMMENT 'Эрхийн төвшин',
    is_active      BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Идэвхтэй эсэх',
    last_login_at  DATETIME NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_role (role)
) ENGINE=InnoDB COMMENT='Системийн хэрэглэгч (ажилтан)';


-- =====================================================================
--  2. CUSTOMERS — Үйлчлүүлэгчид (билет захиалдаг хүмүүс)
-- =====================================================================
CREATE TABLE customers (
    customer_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    last_name       VARCHAR(60)  NOT NULL COMMENT 'Овог',
    first_name      VARCHAR(60)  NOT NULL COMMENT 'Нэр',
    register_no     VARCHAR(20)  UNIQUE   COMMENT 'Регистрийн дугаар',
    passport_no     VARCHAR(20)  UNIQUE   COMMENT 'Гадаад паспортын дугаар',
    birth_date      DATE                 COMMENT 'Төрсөн өдөр',
    gender          ENUM('M','F','O')    COMMENT 'Хүйс: M=эр, F=эм, O=бусад',
    nationality     VARCHAR(60) DEFAULT 'Mongolian',
    email           VARCHAR(120) UNIQUE  COMMENT 'Имэйл',
    phone           VARCHAR(20)  NOT NULL COMMENT 'Гар утас',
    address         VARCHAR(255)         COMMENT 'Хаяг',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_customers_phone (phone),
    INDEX idx_customers_name (last_name, first_name)
) ENGINE=InnoDB COMMENT='Үйлчлүүлэгчийн мэдээлэл';


-- =====================================================================
--  3. AIRLINES — Агаарын тээврийн компани
-- =====================================================================
CREATE TABLE airlines (
    airline_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    iata_code     CHAR(2)      NOT NULL UNIQUE COMMENT 'IATA код (ж: OM, KE)',
    icao_code     CHAR(3)      UNIQUE          COMMENT 'ICAO код (ж: MGL)',
    name          VARCHAR(120) NOT NULL        COMMENT 'Компанийн нэр',
    country       VARCHAR(60)  NOT NULL        COMMENT 'Улс',
    logo_url      VARCHAR(255)                 COMMENT 'Лого зургийн URL',
    website       VARCHAR(120)                 COMMENT 'Цахим хуудас',
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='Агаарын тээврийн компани';


-- =====================================================================
--  4. AIRPORTS — Нисэх онгоцны буудлууд
-- =====================================================================
CREATE TABLE airports (
    airport_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    iata_code     CHAR(3)      NOT NULL UNIQUE COMMENT 'IATA код (ж: ULN, ICN)',
    icao_code     CHAR(4)      UNIQUE          COMMENT 'ICAO код',
    name          VARCHAR(150) NOT NULL        COMMENT 'Буудлын нэр',
    city          VARCHAR(80)  NOT NULL        COMMENT 'Хот',
    country       VARCHAR(60)  NOT NULL        COMMENT 'Улс',
    timezone      VARCHAR(40)  DEFAULT 'UTC'   COMMENT 'Цагийн бүс',
    latitude      DECIMAL(9,6),
    longitude     DECIMAL(9,6),
    INDEX idx_airports_city (city),
    INDEX idx_airports_country (country)
) ENGINE=InnoDB COMMENT='Нисэх онгоцны буудал';


-- =====================================================================
--  5. AIRCRAFT — Онгоцны загвар (optional, гүн анализад хэрэгтэй)
-- =====================================================================
CREATE TABLE aircraft (
    aircraft_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    airline_id       INT UNSIGNED NOT NULL,
    model            VARCHAR(80)  NOT NULL COMMENT 'Загвар (ж: Boeing 737-800)',
    registration_no  VARCHAR(20)  UNIQUE   COMMENT 'Бүртгэлийн дугаар',
    total_seats      SMALLINT UNSIGNED NOT NULL,
    economy_seats    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    business_seats   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    first_seats      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    FOREIGN KEY (airline_id) REFERENCES airlines(airline_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='Онгоцны мэдээлэл';


-- =====================================================================
--  6. FLIGHTS — Нислэгийн хуваарь
-- =====================================================================
CREATE TABLE flights (
    flight_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    flight_number    VARCHAR(10)  NOT NULL COMMENT 'Нислэгийн дугаар (ж: OM301)',
    airline_id       INT UNSIGNED NOT NULL,
    aircraft_id      INT UNSIGNED NULL,
    origin_airport_id      INT UNSIGNED NOT NULL COMMENT 'Хөөрөх буудал',
    destination_airport_id INT UNSIGNED NOT NULL COMMENT 'Очих буудал',
    departure_time   DATETIME     NOT NULL COMMENT 'Хөөрөх цаг',
    arrival_time     DATETIME     NOT NULL COMMENT 'Газардах цаг',
    duration_minutes INT UNSIGNED NOT NULL COMMENT 'Нислэгийн үргэлжлэх хугацаа (минут)',
    economy_price    DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Эконом үнэ (₮)',
    business_price   DECIMAL(10,2)          COMMENT 'Бизнес үнэ (₮)',
    first_price      DECIMAL(10,2)          COMMENT 'Эхний зэрэглэлийн үнэ',
    available_seats  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    status           ENUM('scheduled','boarding','departed','arrived','cancelled','delayed')
                     NOT NULL DEFAULT 'scheduled',
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (airline_id) REFERENCES airlines(airline_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (aircraft_id) REFERENCES aircraft(aircraft_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (origin_airport_id) REFERENCES airports(airport_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (destination_airport_id) REFERENCES airports(airport_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK (departure_time < arrival_time),
    CHECK (origin_airport_id <> destination_airport_id),
    INDEX idx_flights_departure (departure_time),
    INDEX idx_flights_route (origin_airport_id, destination_airport_id, departure_time),
    INDEX idx_flights_status (status)
) ENGINE=InnoDB COMMENT='Нислэгийн хуваарь';


-- =====================================================================
--  7. BOOKINGS — Захиалгын толгой
-- =====================================================================
CREATE TABLE bookings (
    booking_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_code      VARCHAR(10)  NOT NULL UNIQUE COMMENT 'Захиалгын код (ж: AG7X9P2)',
    customer_id       INT UNSIGNED NOT NULL,
    created_by        INT UNSIGNED NULL COMMENT 'Захиалга үүсгэсэн ажилтан',
    booking_date      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    trip_type         ENUM('one_way','round_trip','multi_city') NOT NULL DEFAULT 'one_way',
    total_passengers  TINYINT UNSIGNED NOT NULL DEFAULT 1,
    total_amount      DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Нийт төлөх дүн (₮)',
    paid_amount       DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Төлөгдсөн дүн',
    status            ENUM('pending','confirmed','cancelled','completed','refunded')
                      NOT NULL DEFAULT 'pending',
    notes             TEXT,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_bookings_status (status),
    INDEX idx_bookings_date (booking_date),
    INDEX idx_bookings_customer (customer_id)
) ENGINE=InnoDB COMMENT='Захиалга';


-- =====================================================================
--  8. PASSENGERS — Захиалга доторх зорчигч (1 захиалгад N зорчигч)
-- =====================================================================
CREATE TABLE passengers (
    passenger_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_id      INT UNSIGNED NOT NULL,
    last_name       VARCHAR(60)  NOT NULL,
    first_name      VARCHAR(60)  NOT NULL,
    passport_no     VARCHAR(20)  NOT NULL COMMENT 'Паспортын дугаар',
    passport_expiry DATE,
    birth_date      DATE         NOT NULL,
    gender          ENUM('M','F','O') NOT NULL,
    nationality     VARCHAR(60)  NOT NULL DEFAULT 'Mongolian',
    passenger_type  ENUM('adult','child','infant') NOT NULL DEFAULT 'adult',
    seat_number     VARCHAR(5)   COMMENT 'Суудлын дугаар (ж: 14A)',
    meal_preference VARCHAR(30)  COMMENT 'Хоолны төрөл (ж: vegetarian)',
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_passengers_booking (booking_id),
    INDEX idx_passengers_passport (passport_no)
) ENGINE=InnoDB COMMENT='Захиалгын зорчигчид';


-- =====================================================================
--  9. TICKETS — Билет (зорчигч + нислэгт нэг билет)
-- =====================================================================
CREATE TABLE tickets (
    ticket_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ticket_number  VARCHAR(20)  NOT NULL UNIQUE COMMENT 'Билетийн дугаар (e-ticket)',
    booking_id     INT UNSIGNED NOT NULL,
    passenger_id   INT UNSIGNED NOT NULL,
    flight_id      INT UNSIGNED NOT NULL,
    class_type     ENUM('economy','business','first') NOT NULL DEFAULT 'economy',
    price          DECIMAL(10,2) NOT NULL COMMENT 'Билетийн үнэ',
    baggage_kg     TINYINT UNSIGNED DEFAULT 20 COMMENT 'Тээшний жин (кг)',
    status         ENUM('issued','used','cancelled','refunded')
                   NOT NULL DEFAULT 'issued',
    issued_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (passenger_id) REFERENCES passengers(passenger_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (flight_id) REFERENCES flights(flight_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_tickets_flight (flight_id),
    INDEX idx_tickets_status (status)
) ENGINE=InnoDB COMMENT='Билет';


-- =====================================================================
--  10. PAYMENTS — Төлбөрийн гүйлгээ
-- =====================================================================
CREATE TABLE payments (
    payment_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_id     INT UNSIGNED NOT NULL,
    amount         DECIMAL(12,2) NOT NULL,
    currency       CHAR(3) NOT NULL DEFAULT 'MNT' COMMENT 'Валют (MNT, USD)',
    payment_method ENUM('cash','card','bank_transfer','qpay','socialpay','other')
                   NOT NULL,
    transaction_no VARCHAR(60)  COMMENT 'Гүйлгээний дугаар',
    status         ENUM('pending','success','failed','refunded')
                   NOT NULL DEFAULT 'pending',
    paid_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    received_by    INT UNSIGNED NULL COMMENT 'Хүлээн авсан ажилтан',
    notes          VARCHAR(255),
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (received_by) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_payments_booking (booking_id),
    INDEX idx_payments_status (status),
    INDEX idx_payments_date (paid_at)
) ENGINE=InnoDB COMMENT='Төлбөрийн гүйлгээ';


-- =====================================================================
--  SAMPLE DATA — Жишээ өгөгдөл
-- =====================================================================

-- Хэрэглэгч
INSERT INTO users (username, password_hash, full_name, email, phone, role) VALUES
('admin',  '$2y$10$abc...',  'Бат-Эрдэнэ Дорж',   'admin@airguide.mn',   '99001122', 'admin'),
('saraa',  '$2y$10$xyz...',  'Сарангэрэл Бат',     'saraa@airguide.mn',   '99112233', 'agent'),
('munkh',  '$2y$10$qrs...',  'Мөнхбат Туяа',      'munkh@airguide.mn',   '99223344', 'manager');

-- Агаарын компани
INSERT INTO airlines (iata_code, icao_code, name, country) VALUES
('OM', 'MGL', 'MIAT Mongolian Airlines',   'Mongolia'),
('KE', 'KAL', 'Korean Air',                'South Korea'),
('CA', 'CCA', 'Air China',                 'China'),
('TK', 'THY', 'Turkish Airlines',          'Turkey'),
('JL', 'JAL', 'Japan Airlines',            'Japan');

-- Нисэх онгоцны буудал
INSERT INTO airports (iata_code, icao_code, name, city, country, timezone) VALUES
('ULN', 'ZMCK', 'Chinggis Khaan International Airport', 'Ulaanbaatar', 'Mongolia',     'Asia/Ulaanbaatar'),
('ICN', 'RKSI', 'Incheon International Airport',         'Seoul',       'South Korea',  'Asia/Seoul'),
('PEK', 'ZBAA', 'Beijing Capital International Airport', 'Beijing',     'China',        'Asia/Shanghai'),
('NRT', 'RJAA', 'Narita International Airport',          'Tokyo',       'Japan',        'Asia/Tokyo'),
('IST', 'LTFM', 'Istanbul Airport',                      'Istanbul',    'Turkey',       'Europe/Istanbul'),
('BKK', 'VTBS', 'Suvarnabhumi Airport',                  'Bangkok',     'Thailand',     'Asia/Bangkok');

-- Үйлчлүүлэгч
INSERT INTO customers (last_name, first_name, register_no, passport_no, birth_date, gender, email, phone) VALUES
('Дашдорж',  'Энхтөр',     'УА90080912', 'MN1234567', '1990-08-09', 'M', 'dashka@example.com', '99887766'),
('Батсайхан','Оюунчимэг',  'УБ85050415', 'MN2345678', '1985-05-04', 'F', 'oyuna@example.com',  '88776655');

-- Нислэг
INSERT INTO flights (flight_number, airline_id, origin_airport_id, destination_airport_id,
                     departure_time, arrival_time, duration_minutes,
                     economy_price, business_price, available_seats) VALUES
('OM301', 1, 1, 2, '2026-06-15 09:30:00', '2026-06-15 14:00:00', 210, 890000.00, 1890000.00, 120),
('OM302', 1, 2, 1, '2026-06-22 16:00:00', '2026-06-22 19:30:00', 210, 890000.00, 1890000.00, 118),
('KE868', 2, 1, 2, '2026-06-16 11:00:00', '2026-06-16 15:30:00', 210, 950000.00, 2200000.00, 200),
('TK023', 4, 1, 5, '2026-07-01 22:00:00', '2026-07-02 05:30:00', 510, 1890000.00, 4500000.00, 250);

-- Захиалга
INSERT INTO bookings (booking_code, customer_id, created_by, trip_type,
                      total_passengers, total_amount, paid_amount, status) VALUES
('AG7X9P2', 1, 2, 'round_trip', 1, 1780000.00, 1780000.00, 'confirmed'),
('AG3K2M8', 2, 2, 'one_way',    2, 1900000.00,  950000.00, 'pending');

-- Зорчигч
INSERT INTO passengers (booking_id, last_name, first_name, passport_no, passport_expiry,
                        birth_date, gender, passenger_type, seat_number) VALUES
(1, 'Дашдорж',   'Энхтөр',    'MN1234567', '2030-08-09', '1990-08-09', 'M', 'adult', '14A'),
(2, 'Батсайхан', 'Оюунчимэг', 'MN2345678', '2028-05-04', '1985-05-04', 'F', 'adult', '22C'),
(2, 'Батсайхан', 'Номин',     'MN3456789', '2029-11-12', '2015-11-12', 'F', 'child', '22D');

-- Билет
INSERT INTO tickets (ticket_number, booking_id, passenger_id, flight_id, class_type, price) VALUES
('OM-2026-0001', 1, 1, 1, 'economy', 890000.00),
('OM-2026-0002', 1, 1, 2, 'economy', 890000.00),
('KE-2026-0001', 2, 2, 3, 'economy', 950000.00),
('KE-2026-0002', 2, 3, 3, 'economy', 950000.00);

-- Төлбөр
INSERT INTO payments (booking_id, amount, payment_method, transaction_no, status, received_by) VALUES
(1, 1780000.00, 'card',           'TXN20260510001', 'success', 2),
(2,  950000.00, 'bank_transfer',  'TXN20260510002', 'success', 2);


-- =====================================================================
--  АШИГТАЙ VIEW-ҮҮД
-- =====================================================================

-- Захиалгын дэлгэрэнгүй харах view
CREATE OR REPLACE VIEW v_booking_details AS
SELECT
    b.booking_id,
    b.booking_code,
    b.booking_date,
    b.status                          AS booking_status,
    CONCAT(c.last_name, ' ', c.first_name) AS customer_name,
    c.phone                           AS customer_phone,
    b.total_passengers,
    b.total_amount,
    b.paid_amount,
    (b.total_amount - b.paid_amount)  AS balance_due,
    u.full_name                       AS agent_name
FROM bookings b
JOIN customers c ON c.customer_id = b.customer_id
LEFT JOIN users u ON u.user_id = b.created_by;

-- Нислэгийн дэлгэрэнгүй (origin/destination нэртэй)
CREATE OR REPLACE VIEW v_flight_details AS
SELECT
    f.flight_id,
    f.flight_number,
    a.name           AS airline_name,
    a.iata_code      AS airline_code,
    o.iata_code      AS origin_code,
    o.city           AS origin_city,
    d.iata_code      AS dest_code,
    d.city           AS dest_city,
    f.departure_time,
    f.arrival_time,
    f.duration_minutes,
    f.economy_price,
    f.business_price,
    f.available_seats,
    f.status
FROM flights f
JOIN airlines a ON a.airline_id  = f.airline_id
JOIN airports o ON o.airport_id  = f.origin_airport_id
JOIN airports d ON d.airport_id  = f.destination_airport_id;


-- =====================================================================
--  TRIGGERS — Auto-update логик
-- =====================================================================

DELIMITER //

-- Шинэ билет нэмэгдэхэд нислэгийн available_seats-ыг -1 хийх
CREATE TRIGGER trg_after_ticket_insert
AFTER INSERT ON tickets
FOR EACH ROW
BEGIN
    IF NEW.status = 'issued' THEN
        UPDATE flights
           SET available_seats = available_seats - 1
         WHERE flight_id = NEW.flight_id
           AND available_seats > 0;
    END IF;
END//

-- Билет цуцлагдвал суудал буцаах
CREATE TRIGGER trg_after_ticket_cancel
AFTER UPDATE ON tickets
FOR EACH ROW
BEGIN
    IF OLD.status = 'issued' AND NEW.status IN ('cancelled','refunded') THEN
        UPDATE flights
           SET available_seats = available_seats + 1
         WHERE flight_id = NEW.flight_id;
    END IF;
END//

-- Төлбөр амжилттай болоход bookings.paid_amount-ыг шинэчилэх
CREATE TRIGGER trg_after_payment_success
AFTER INSERT ON payments
FOR EACH ROW
BEGIN
    IF NEW.status = 'success' THEN
        UPDATE bookings
           SET paid_amount = paid_amount + NEW.amount,
               status = CASE
                          WHEN (paid_amount + NEW.amount) >= total_amount THEN 'confirmed'
                          ELSE status
                        END
         WHERE booking_id = NEW.booking_id;
    END IF;
END//

DELIMITER ;


-- =====================================================================
--  ЖИШЭЭ ASUULT (QUERY)
-- =====================================================================

-- 1) Энэ сард үүссэн бүх захиалга
-- SELECT * FROM v_booking_details
-- WHERE booking_date >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01');

-- 2) Тодорхой чиглэлийн ирэх нислэгүүд
-- SELECT * FROM v_flight_details
-- WHERE origin_code = 'ULN' AND dest_code = 'ICN'
--   AND departure_time > NOW()
-- ORDER BY departure_time;

-- 3) Тодорхой үйлчлүүлэгчийн билетийн түүх
-- SELECT t.ticket_number, fd.flight_number, fd.origin_code, fd.dest_code,
--        fd.departure_time, t.class_type, t.price, t.status
-- FROM tickets t
-- JOIN v_flight_details fd ON fd.flight_id = t.flight_id
-- JOIN passengers p ON p.passenger_id = t.passenger_id
-- JOIN bookings b ON b.booking_id = t.booking_id
-- WHERE b.customer_id = 1
-- ORDER BY fd.departure_time DESC;

-- 4) Сар бүрийн орлогын тайлан
-- SELECT DATE_FORMAT(paid_at, '%Y-%m') AS month,
--        SUM(amount) AS total_revenue,
--        COUNT(*)    AS payment_count
-- FROM payments
-- WHERE status = 'success'
-- GROUP BY month
-- ORDER BY month DESC;

-- =====================================================================
--  ТӨГСГӨЛ
-- =====================================================================
