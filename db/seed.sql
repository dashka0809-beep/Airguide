-- =====================================================================
-- seed.sql — Air Guide sample data (PostgreSQL)
-- =====================================================================
-- Хэрэглэх:
--   psql -U postgres -d airguide_db -f db/seed.sql
-- Эсвэл Railway-д:
--   railway run psql < db/seed.sql
--
-- ⚠️  Production-д энэ файлыг бүтнээр ачаалахгүй.
-- Зөвхөн airlines, airports л production-д хэрэгтэй —
-- тэдгээрийг тусдаа prod-seed.sql болгож болно.
--
-- Postgres-ийн ON CONFLICT идэвхжсэн тул дахин ажиллуулахад зөв.
-- =====================================================================

-- =====================================================================
-- 1. USERS — Ажилтнууд
-- bcrypt hash жишээ (cost=12). Бодит value-уудыг production-д солих.
-- =====================================================================
INSERT INTO users (username, password_hash, full_name, email, phone, role) VALUES
  ('admin', '$2b$12$placeholder.admin.hash.replace.in.production.dev1', 'Бат-Эрдэнэ Дорж', 'admin@airguide.mn', '99001122', 'admin'),
  ('munkh', '$2b$12$placeholder.manager.hash.replace.in.production.dev', 'Мөнхбат Туяа',     'munkh@airguide.mn', '99223344', 'manager'),
  ('saraa', '$2b$12$placeholder.agent.hash.replace.in.production.dev2', 'Сарангэрэл Бат',     'saraa@airguide.mn', '99112233', 'agent')
ON CONFLICT (username) DO NOTHING;


-- =====================================================================
-- 2. AIRLINES — Агаарын тээврийн компани
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
-- 3. AIRPORTS — Нисэх буудал
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
-- 4. AIRCRAFT — Онгоцууд (зөвхөн MIAT-ынх)
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
-- 5. CUSTOMERS — Жишээ үйлчлүүлэгчид
-- =====================================================================
INSERT INTO customers (last_name, first_name, register_no, passport_no, birth_date, gender, email, phone) VALUES
  ('Дашдорж',   'Энхтөр',     'УА90080912', 'MN1234567', '1990-08-09', 'M', 'dashka@example.com', '99887766'),
  ('Батсайхан', 'Оюунчимэг',  'УБ85050415', 'MN2345678', '1985-05-04', 'F', 'oyuna@example.com',  '88776655'),
  ('Ганбат',    'Болормаа',   'УД92121507', 'MN3456789', '1992-12-15', 'F', 'bolor@example.com',  '99445566')
ON CONFLICT (register_no) DO NOTHING;


-- =====================================================================
-- 6. FLIGHTS — Жишээ нислэгүүд (айлгын ID-уудыг dynamic-аар авна)
-- =====================================================================
INSERT INTO flights (flight_number, airline_id, origin_airport_id, destination_airport_id,
                     departure_time, arrival_time, duration_minutes,
                     economy_price, business_price, available_seats, status)
SELECT
  vals.flight_number,
  (SELECT airline_id FROM airlines  WHERE iata_code = vals.airline_iata),
  (SELECT airport_id FROM airports  WHERE iata_code = vals.origin_iata),
  (SELECT airport_id FROM airports  WHERE iata_code = vals.dest_iata),
  vals.departure_time::timestamptz,
  vals.arrival_time::timestamptz,
  vals.duration_minutes,
  vals.economy_price,
  vals.business_price,
  vals.available_seats,
  vals.status
FROM (VALUES
  ('OM301', 'OM', 'ULN', 'ICN', '2026-06-15 01:30:00+00', '2026-06-15 06:00:00+00', 210, 890000.00,  1890000.00, 120, 'scheduled'),
  ('OM302', 'OM', 'ICN', 'ULN', '2026-06-22 08:00:00+00', '2026-06-22 11:30:00+00', 210, 890000.00,  1890000.00, 118, 'scheduled'),
  ('OM501', 'OM', 'ULN', 'PEK', '2026-06-16 03:00:00+00', '2026-06-16 05:30:00+00', 150, 750000.00,  1450000.00, 150, 'scheduled'),
  ('OM601', 'OM', 'ULN', 'FRA', '2026-07-01 14:00:00+00', '2026-07-01 21:30:00+00', 450, 2890000.00, 5800000.00, 200, 'scheduled'),
  ('KE868', 'KE', 'ULN', 'ICN', '2026-06-16 03:00:00+00', '2026-06-16 07:30:00+00', 210, 950000.00,  2200000.00, 200, 'scheduled'),
  ('OZ370', 'OZ', 'ICN', 'ULN', '2026-06-23 09:00:00+00', '2026-06-23 12:30:00+00', 210, 990000.00,  2300000.00, 180, 'scheduled'),
  ('TK023', 'TK', 'ULN', 'IST', '2026-07-01 14:00:00+00', '2026-07-01 22:30:00+00', 510, 1890000.00, 4500000.00, 250, 'scheduled'),
  ('CA738', 'CA', 'ULN', 'PEK', '2026-06-17 02:00:00+00', '2026-06-17 04:30:00+00', 150, 720000.00,  1380000.00, 180, 'scheduled'),
  ('M0901', 'M0', 'ULN', 'HET', '2026-06-18 06:00:00+00', '2026-06-18 07:30:00+00',  90, 480000.00,         NULL,  70, 'scheduled'),
  ('MR225', 'MR', 'ULN', 'HVD', '2026-06-19 02:30:00+00', '2026-06-19 05:00:00+00', 150, 320000.00,         NULL,  50, 'scheduled')
) AS vals(flight_number, airline_iata, origin_iata, dest_iata, departure_time, arrival_time, duration_minutes, economy_price, business_price, available_seats, status);


-- =====================================================================
-- 7. BOOKINGS — Жишээ захиалга
-- =====================================================================
INSERT INTO bookings (booking_code, customer_id, created_by, trip_type,
                      total_passengers, total_amount, paid_amount, status, metadata)
SELECT
  vals.booking_code,
  (SELECT customer_id FROM customers WHERE register_no = vals.cust_reg),
  (SELECT user_id FROM users         WHERE username    = vals.agent_user),
  vals.trip_type,
  vals.total_passengers,
  vals.total_amount,
  vals.paid_amount,
  vals.status,
  vals.metadata::jsonb
FROM (VALUES
  ('AG7X9P2', 'УА90080912', 'saraa', 'round_trip', 1, 1780000.00, 1780000.00, 'confirmed', '{"source":"website","campaign":"summer2026"}'),
  ('AG3K2M8', 'УБ85050415', 'saraa', 'one_way',    2, 1900000.00,  950000.00, 'pending',   '{"source":"call_center"}')
) AS vals(booking_code, cust_reg, agent_user, trip_type, total_passengers, total_amount, paid_amount, status, metadata)
ON CONFLICT (booking_code) DO NOTHING;


-- =====================================================================
-- 8. PASSENGERS — Захиалга доторх зорчигч
-- =====================================================================
INSERT INTO passengers (booking_id, last_name, first_name, passport_no, passport_expiry,
                        birth_date, gender, passenger_type, seat_number)
SELECT
  (SELECT booking_id FROM bookings WHERE booking_code = vals.bk_code),
  vals.last_name, vals.first_name, vals.passport_no, vals.passport_expiry::date,
  vals.birth_date::date, vals.gender, vals.passenger_type, vals.seat_number
FROM (VALUES
  ('AG7X9P2', 'Дашдорж',   'Энхтөр',    'MN1234567', '2030-08-09', '1990-08-09', 'M', 'adult', '14A'),
  ('AG3K2M8', 'Батсайхан', 'Оюунчимэг', 'MN2345678', '2028-05-04', '1985-05-04', 'F', 'adult', '22C'),
  ('AG3K2M8', 'Батсайхан', 'Номин',     'MN3456789', '2029-11-12', '2015-11-12', 'F', 'child', '22D')
) AS vals(bk_code, last_name, first_name, passport_no, passport_expiry, birth_date, gender, passenger_type, seat_number);


-- =====================================================================
-- 9. TICKETS — Билет (issued status — trigger автомат suudal -1 хийнэ)
-- =====================================================================
INSERT INTO tickets (ticket_number, booking_id, passenger_id, flight_id, class_type, price)
SELECT
  vals.ticket_number,
  (SELECT booking_id FROM bookings WHERE booking_code = vals.bk_code),
  p.passenger_id,
  (SELECT flight_id FROM flights WHERE flight_number = vals.flight_num),
  vals.class_type,
  vals.price
FROM (VALUES
  ('OM-2026-0001', 'AG7X9P2', 'Энхтөр',    'OM301', 'economy',  890000.00),
  ('OM-2026-0002', 'AG7X9P2', 'Энхтөр',    'OM302', 'economy',  890000.00),
  ('KE-2026-0001', 'AG3K2M8', 'Оюунчимэг', 'KE868', 'economy',  950000.00),
  ('KE-2026-0002', 'AG3K2M8', 'Номин',     'KE868', 'economy',  950000.00)
) AS vals(ticket_number, bk_code, passenger_first_name, flight_num, class_type, price)
JOIN passengers p
  ON p.first_name = vals.passenger_first_name
 AND p.booking_id = (SELECT booking_id FROM bookings WHERE booking_code = vals.bk_code)
ON CONFLICT (ticket_number) DO NOTHING;


-- =====================================================================
-- 10. PAYMENTS — Төлбөр (success status — trigger paid_amount шинэчилнэ)
-- ⚠️  Гэхдээ бид аль хэдийн bookings.paid_amount-ыг бичсэн тул
--     дахин trigger-ээр өсгөгдөхгүйн тулд status='pending' оруулна,
--     эсвэл шууд алдаа гарах болно.
--     Тиймээс энэ seed нь "одоо паид" status-той гүйлгээний түүх л.
--     Bookings.paid_amount-ыг хэрэв 0 байсан бол л trigger ажиллуулна.
-- =====================================================================
INSERT INTO payments (booking_id, amount, payment_method, transaction_no, status, received_by, paid_at)
SELECT
  (SELECT booking_id FROM bookings WHERE booking_code = vals.bk_code),
  vals.amount,
  vals.payment_method,
  vals.transaction_no,
  vals.status,
  (SELECT user_id FROM users WHERE username = vals.received_username),
  vals.paid_at::timestamptz
FROM (VALUES
  ('AG7X9P2', 1780000.00, 'card',          'TXN20260510001', 'success', 'saraa', '2026-05-10 09:15:00+00'),
  ('AG3K2M8',  950000.00, 'bank_transfer', 'TXN20260510002', 'success', 'saraa', '2026-05-10 14:22:00+00')
) AS vals(bk_code, amount, payment_method, transaction_no, status, received_username, paid_at);


-- =====================================================================
-- ШАЛГАХ — Sample data зөв ачаалагдсан эсэх
-- =====================================================================
-- SELECT 'users'      AS table, COUNT(*) FROM users
-- UNION ALL SELECT 'customers',  COUNT(*) FROM customers
-- UNION ALL SELECT 'airlines',   COUNT(*) FROM airlines
-- UNION ALL SELECT 'airports',   COUNT(*) FROM airports
-- UNION ALL SELECT 'aircraft',   COUNT(*) FROM aircraft
-- UNION ALL SELECT 'flights',    COUNT(*) FROM flights
-- UNION ALL SELECT 'bookings',   COUNT(*) FROM bookings
-- UNION ALL SELECT 'passengers', COUNT(*) FROM passengers
-- UNION ALL SELECT 'tickets',    COUNT(*) FROM tickets
-- UNION ALL SELECT 'payments',   COUNT(*) FROM payments;
--
-- Хүлээгдэх үр дүн:
--   users:      3
--   customers:  3
--   airlines:   12
--   airports:   20
--   aircraft:   4
--   flights:    10
--   bookings:   2
--   passengers: 3
--   tickets:    4
--   payments:   2
-- =====================================================================
