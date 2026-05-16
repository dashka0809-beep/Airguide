-- =====================================================================
-- seed.sql — Air Guide sample data (PostgreSQL)
-- =====================================================================
-- Хэрэглэх:
--   psql -U postgres -d airguide_db -f db/seed.sql
-- Эсвэл Python helper:
--   python scripts/apply_db.py extensions schema seed verify
--
-- ⚠️  Энэ нь schema.sql-ийн ДАРАА ажиллана (schema нь DROP+CREATE хийдэг).
-- Reference data (airlines, airports) ON CONFLICT-тэй тул дахин аюулгүй.
--
-- Flights нь generate_series-ээр 2026-05-20 ~ 2026-09-30 хооронд
-- ӨДӨР БҮР олон чиглэлд автомат үүснэ (~3,200 нислэг).
--
-- paid_amount ЗАСВАР: bookings-г paid_amount=0-оор оруулж, payments
-- (success) нь trigger-ээр paid_amount-ыг зөв тооцоолно. Ингэснээр
-- давхар тооцолт (overcount) гарахгүй.
-- =====================================================================

-- =====================================================================
-- 1. USERS — Ажилтнууд (bcrypt placeholder hash)
-- =====================================================================
INSERT INTO users (username, password_hash, full_name, email, phone, role) VALUES
  ('admin', '$2b$12$placeholder.admin.hash.replace.in.production.dev1', 'Бат-Эрдэнэ Дорж', 'admin@airguide.mn', '99001122', 'admin'),
  ('munkh', '$2b$12$placeholder.manager.hash.replace.in.production.dev', 'Мөнхбат Туяа',     'munkh@airguide.mn', '99223344', 'manager'),
  ('saraa', '$2b$12$placeholder.agent.hash.replace.in.production.dev2', 'Сарангэрэл Бат',     'saraa@airguide.mn', '99112233', 'agent')
ON CONFLICT (username) DO NOTHING;


-- =====================================================================
-- 2. AIRLINES
-- =====================================================================
INSERT INTO airlines (iata_code, icao_code, name, country) VALUES
  ('OM', 'MGL', 'MIAT Mongolian Airlines',  'Mongolia'),
  ('M0', 'MMA', 'Aero Mongolia',            'Mongolia'),
  ('MR', 'HUN', 'Hunnu Air',                'Mongolia'),
  ('KE', 'KAL', 'Korean Air',               'South Korea'),
  ('OZ', 'AAR', 'Asiana Airlines',          'South Korea'),
  ('CA', 'CCA', 'Air China',                'China'),
  ('CZ', 'CSN', 'China Southern Airlines',  'China'),
  ('TK', 'THY', 'Turkish Airlines',         'Turkey'),
  ('JL', 'JAL', 'Japan Airlines',           'Japan'),
  ('NH', 'ANA', 'All Nippon Airways',       'Japan'),
  ('SU', 'AFL', 'Aeroflot',                 'Russia'),
  ('LH', 'DLH', 'Lufthansa',                'Germany')
ON CONFLICT (iata_code) DO NOTHING;


-- =====================================================================
-- 3. AIRPORTS
-- =====================================================================
INSERT INTO airports (iata_code, icao_code, name, city, country, timezone, latitude, longitude) VALUES
  ('ULN', 'ZMCK', 'Chinggis Khaan International Airport',     'Ulaanbaatar',  'Mongolia',     'Asia/Ulaanbaatar', 47.6431,   106.8200),
  ('UGA', 'ZMUB', 'Buyant-Ukhaa Airport',                     'Ulaanbaatar',  'Mongolia',     'Asia/Ulaanbaatar', 47.8431,   106.7660),
  ('HVD', 'ZMKD', 'Khovd Airport',                            'Khovd',        'Mongolia',     'Asia/Ulaanbaatar', 47.9543,   91.6282),
  ('MXV', 'ZMMN', 'Murun Airport',                            'Murun',        'Mongolia',     'Asia/Ulaanbaatar', 49.6633,   100.0989),
  ('ICN', 'RKSI', 'Incheon International Airport',            'Seoul',        'South Korea',  'Asia/Seoul',       37.4691,   126.4505),
  ('GMP', 'RKSS', 'Gimpo International Airport',              'Seoul',        'South Korea',  'Asia/Seoul',       37.5583,   126.7906),
  ('PUS', 'RKPK', 'Gimhae International Airport',             'Busan',        'South Korea',  'Asia/Seoul',       35.1795,   128.9382),
  ('PEK', 'ZBAA', 'Beijing Capital International Airport',    'Beijing',      'China',        'Asia/Shanghai',    40.0801,   116.5846),
  ('PKX', 'ZBAD', 'Beijing Daxing International Airport',     'Beijing',      'China',        'Asia/Shanghai',    39.5098,   116.4106),
  ('HET', 'ZBHH', 'Hohhot Baita International Airport',       'Hohhot',       'China',        'Asia/Shanghai',    40.8514,   111.8240),
  ('NRT', 'RJAA', 'Narita International Airport',             'Tokyo',        'Japan',        'Asia/Tokyo',       35.7720,   140.3929),
  ('HND', 'RJTT', 'Tokyo Haneda Airport',                     'Tokyo',        'Japan',        'Asia/Tokyo',       35.5494,   139.7798),
  ('IST', 'LTFM', 'Istanbul Airport',                         'Istanbul',     'Turkey',       'Europe/Istanbul',  41.2753,   28.7519),
  ('FRA', 'EDDF', 'Frankfurt Airport',                        'Frankfurt',    'Germany',      'Europe/Berlin',    50.0379,   8.5622),
  ('BKK', 'VTBS', 'Suvarnabhumi Airport',                     'Bangkok',      'Thailand',     'Asia/Bangkok',     13.6900,   100.7501),
  ('SVO', 'UUEE', 'Sheremetyevo International Airport',       'Moscow',       'Russia',       'Europe/Moscow',    55.9726,   37.4146),
  ('AST', 'UACC', 'Astana International Airport',             'Astana',       'Kazakhstan',   'Asia/Almaty',      51.0222,   71.4669),
  ('HKG', 'VHHH', 'Hong Kong International Airport',          'Hong Kong',    'China',        'Asia/Hong_Kong',   22.3080,   113.9185),
  ('SIN', 'WSSS', 'Singapore Changi Airport',                 'Singapore',    'Singapore',    'Asia/Singapore',    1.3644,   103.9915),
  ('DXB', 'OMDB', 'Dubai International Airport',              'Dubai',        'UAE',          'Asia/Dubai',       25.2532,   55.3657)
ON CONFLICT (iata_code) DO NOTHING;


-- =====================================================================
-- 4. AIRCRAFT — MIAT fleet
-- =====================================================================
INSERT INTO aircraft (airline_id, model, registration_no, total_seats, economy_seats, business_seats, first_seats)
SELECT
  (SELECT airline_id FROM airlines WHERE iata_code='OM'),
  model, registration_no, total_seats, economy_seats, business_seats, first_seats
FROM (VALUES
  ('Boeing 737-800',  'JU-1021', 168, 144, 24, 0),
  ('Boeing 737-800',  'JU-1022', 168, 144, 24, 0),
  ('Boeing 767-300',  'JU-1031', 220, 180, 30, 10),
  ('Airbus A319',     'JU-2001', 132, 120, 12, 0)
) AS t(model, registration_no, total_seats, economy_seats, business_seats, first_seats)
ON CONFLICT (registration_no) DO NOTHING;


-- =====================================================================
-- 5. CUSTOMERS
-- =====================================================================
INSERT INTO customers (last_name, first_name, register_no, passport_no, birth_date, gender, email, phone) VALUES
  ('Дашдорж',   'Энхтөр',     'УА90080912', 'MN1234567', '1990-08-09', 'M', 'dashka@example.com', '99887766'),
  ('Батсайхан', 'Оюунчимэг',  'УБ85050415', 'MN2345678', '1985-05-04', 'F', 'oyuna@example.com',  '88776655'),
  ('Ганбат',    'Болормаа',   'УД92121507', 'MN3456789', '1992-12-15', 'F', 'bolor@example.com',  '99445566')
ON CONFLICT (register_no) DO NOTHING;


-- =====================================================================
-- 6. FLIGHTS — generate_series-ээр өдөр тутмын хуваарь
--    2026-05-20 ~ 2026-09-30, өдөр бүр (24 чиглэл × 134 өдөр)
-- =====================================================================
INSERT INTO flights (flight_number, airline_id, origin_airport_id, destination_airport_id,
                     departure_time, arrival_time, duration_minutes,
                     economy_price, business_price, available_seats, status)
SELECT
  r.flight_number,
  (SELECT airline_id FROM airlines WHERE iata_code = r.airline_iata),
  (SELECT airport_id FROM airports WHERE iata_code = r.origin),
  (SELECT airport_id FROM airports WHERE iata_code = r.dest),
  (gs.day + r.dep_offset)::timestamptz,
  (gs.day + r.dep_offset + (r.duration_min || ' minutes')::interval)::timestamptz,
  r.duration_min,
  r.economy_price,
  r.business_price,
  r.seats,
  'scheduled'
FROM (
  VALUES
  -- flight_no, airline, from,  to,    dep_offset(UTC), duration_min, econ,      business,   seats
    ('OM301', 'OM', 'ULN', 'ICN', interval '01:30', 210,  890000.00, 1890000.00, 168),
    ('OM302', 'OM', 'ICN', 'ULN', interval '08:00', 210,  890000.00, 1890000.00, 168),
    ('KE868', 'KE', 'ULN', 'ICN', interval '03:00', 210,  950000.00, 2200000.00, 200),
    ('KE867', 'KE', 'ICN', 'ULN', interval '10:00', 210,  950000.00, 2200000.00, 200),
    ('OZ370', 'OZ', 'ULN', 'ICN', interval '05:30', 215,  920000.00, 2100000.00, 180),
    ('OM501', 'OM', 'ULN', 'PEK', interval '03:00', 150,  750000.00, 1450000.00, 168),
    ('OM502', 'OM', 'PEK', 'ULN', interval '07:00', 150,  750000.00, 1450000.00, 168),
    ('CA738', 'CA', 'ULN', 'PEK', interval '02:00', 150,  720000.00, 1380000.00, 180),
    ('OM701', 'OM', 'ULN', 'NRT', interval '00:30', 270, 1350000.00, 2900000.00, 220),
    ('OM702', 'OM', 'NRT', 'ULN', interval '06:30', 270, 1350000.00, 2900000.00, 220),
    ('JL722', 'JL', 'ULN', 'NRT', interval '04:00', 270, 1420000.00, 3100000.00, 200),
    ('NH936', 'NH', 'ULN', 'HND', interval '02:30', 275, 1480000.00, 3200000.00, 210),
    ('TK023', 'TK', 'ULN', 'IST', interval '14:00', 510, 1890000.00, 4500000.00, 250),
    ('TK024', 'TK', 'IST', 'ULN', interval '20:00', 510, 1890000.00, 4500000.00, 250),
    ('OM601', 'OM', 'ULN', 'FRA', interval '14:00', 450, 2890000.00, 5800000.00, 220),
    ('OM801', 'OM', 'ULN', 'BKK', interval '01:00', 360, 1250000.00, 2700000.00, 200),
    ('OM802', 'OM', 'BKK', 'ULN', interval '09:00', 360, 1250000.00, 2700000.00, 200),
    ('OM901', 'OM', 'ULN', 'HKG', interval '02:00', 300, 1180000.00, 2500000.00, 190),
    ('OM110', 'OM', 'ULN', 'SIN', interval '00:30', 420, 1650000.00, 3500000.00, 210),
    ('SU331', 'SU', 'ULN', 'SVO', interval '06:00', 390, 1550000.00, 3300000.00, 230),
    ('OM205', 'OM', 'ULN', 'DXB', interval '03:30', 480, 1980000.00, 4200000.00, 220),
    ('M0901', 'M0', 'ULN', 'HET', interval '06:00',  90,  480000.00,       NULL,  70),
    ('MR225', 'MR', 'ULN', 'HVD', interval '02:30', 150,  320000.00,       NULL,  50),
    ('MR318', 'MR', 'ULN', 'MXV', interval '04:00', 105,  290000.00,       NULL,  50)
) AS r(flight_number, airline_iata, origin, dest, dep_offset, duration_min, economy_price, business_price, seats)
CROSS JOIN generate_series(
  TIMESTAMPTZ '2026-05-20 00:00:00+00',
  TIMESTAMPTZ '2026-09-30 00:00:00+00',
  INTERVAL '1 day'
) AS gs(day);


-- =====================================================================
-- 7. BOOKINGS — paid_amount=0 (payments trigger-ээр тооцоологдоно)
-- =====================================================================
INSERT INTO bookings (booking_code, customer_id, created_by, trip_type,
                      total_passengers, total_amount, paid_amount, status, metadata)
SELECT
  v.booking_code,
  (SELECT customer_id FROM customers WHERE register_no = v.cust_reg),
  (SELECT user_id FROM users WHERE username = v.agent_user),
  v.trip_type,
  v.total_passengers,
  v.total_amount,
  0,
  v.status,
  v.metadata::jsonb
FROM (VALUES
  ('AG7X9P2', 'УА90080912', 'saraa', 'round_trip', 1, 1780000.00, 'pending', '{"source":"website","campaign":"summer2026"}'),
  ('AG3K2M8', 'УБ85050415', 'saraa', 'one_way',    2, 1900000.00, 'pending', '{"source":"call_center"}')
) AS v(booking_code, cust_reg, agent_user, trip_type, total_passengers, total_amount, status, metadata)
ON CONFLICT (booking_code) DO NOTHING;


-- =====================================================================
-- 8. PASSENGERS
-- =====================================================================
INSERT INTO passengers (booking_id, last_name, first_name, passport_no, passport_expiry,
                        birth_date, gender, passenger_type, seat_number)
SELECT
  (SELECT booking_id FROM bookings WHERE booking_code = v.bk_code),
  v.last_name, v.first_name, v.passport_no, v.passport_expiry::date,
  v.birth_date::date, v.gender, v.passenger_type, v.seat_number
FROM (VALUES
  ('AG7X9P2', 'Дашдорж',   'Энхтөр',    'MN1234567', '2030-08-09', '1990-08-09', 'M', 'adult', '14A'),
  ('AG3K2M8', 'Батсайхан', 'Оюунчимэг', 'MN2345678', '2028-05-04', '1985-05-04', 'F', 'adult', '22C'),
  ('AG3K2M8', 'Батсайхан', 'Номин',     'MN3456789', '2029-11-12', '2015-11-12', 'F', 'child', '22D')
) AS v(bk_code, last_name, first_name, passport_no, passport_expiry, birth_date, gender, passenger_type, seat_number)
WHERE EXISTS (SELECT 1 FROM bookings WHERE booking_code = v.bk_code)
  AND NOT EXISTS (
    SELECT 1 FROM passengers p
    WHERE p.booking_id = (SELECT booking_id FROM bookings WHERE booking_code = v.bk_code)
      AND p.first_name = v.first_name
  );


-- =====================================================================
-- 9. TICKETS — нэг тодорхой нислэгт холбоно (эхний таарах нислэг)
--    trigger автомат available_seats -1 хийнэ
-- =====================================================================
INSERT INTO tickets (ticket_number, booking_id, passenger_id, flight_id, class_type, price)
SELECT
  v.ticket_number,
  (SELECT booking_id FROM bookings WHERE booking_code = v.bk_code),
  p.passenger_id,
  (SELECT flight_id FROM flights
     WHERE flight_number = v.flight_num
     ORDER BY departure_time LIMIT 1),
  v.class_type,
  v.price
FROM (VALUES
  ('OM-2026-9001', 'AG7X9P2', 'Энхтөр',    'OM301', 'economy',  890000.00),
  ('OM-2026-9002', 'AG7X9P2', 'Энхтөр',    'OM302', 'economy',  890000.00),
  ('KE-2026-9001', 'AG3K2M8', 'Оюунчимэг', 'KE868', 'economy',  950000.00),
  ('KE-2026-9002', 'AG3K2M8', 'Номин',     'KE868', 'economy',  950000.00)
) AS v(ticket_number, bk_code, passenger_first_name, flight_num, class_type, price)
JOIN passengers p
  ON p.first_name = v.passenger_first_name
 AND p.booking_id = (SELECT booking_id FROM bookings WHERE booking_code = v.bk_code)
WHERE EXISTS (SELECT 1 FROM bookings WHERE booking_code = v.bk_code)
ON CONFLICT (ticket_number) DO NOTHING;


-- =====================================================================
-- 10. PAYMENTS — success status → trigger paid_amount-ыг ЗӨВ тооцоолно
--     AG7X9P2: бүтэн төлсөн (1,780,000)
--     AG3K2M8: хагас төлсөн (950,000 / 1,900,000)
-- =====================================================================
INSERT INTO payments (booking_id, amount, payment_method, transaction_no, status, received_by, paid_at)
SELECT
  (SELECT booking_id FROM bookings WHERE booking_code = v.bk_code),
  v.amount, v.payment_method, v.transaction_no, v.status,
  (SELECT user_id FROM users WHERE username = v.received_username),
  v.paid_at::timestamptz
FROM (VALUES
  ('AG7X9P2', 1780000.00, 'card',          'TXN20260510001', 'success', 'saraa', '2026-05-10 09:15:00+00'),
  ('AG3K2M8',  950000.00, 'bank_transfer', 'TXN20260510002', 'success', 'saraa', '2026-05-10 14:22:00+00')
) AS v(bk_code, amount, payment_method, transaction_no, status, received_username, paid_at)
WHERE EXISTS (SELECT 1 FROM bookings WHERE booking_code = v.bk_code)
  AND NOT EXISTS (
    SELECT 1 FROM payments pm
    WHERE pm.transaction_no = v.transaction_no
  );


-- =====================================================================
-- ШАЛГАХ
-- =====================================================================
-- SELECT 'flights' AS t, COUNT(*) FROM flights
-- UNION ALL SELECT 'bookings', COUNT(*) FROM bookings;
--
-- -- paid_amount зөв эсэх (overcount байхгүй):
-- SELECT booking_code, total_amount, paid_amount, status FROM bookings;
-- -- Хүлээгдэх:
-- --   AG7X9P2  1780000  1780000  confirmed   (бүтэн → confirmed)
-- --   AG3K2M8  1900000   950000  pending     (хагас)
-- =====================================================================
