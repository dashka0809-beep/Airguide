-- migrate:up
-- =====================================================================
-- Нэмэлт жишээ өгөгдөл — буцах нислэг + давтамж + огноо сунгах + захиалга
-- =====================================================================
-- Бүгд IDEMPOTENT: одоо байгаа ~3216 нислэгийг хөндөхгүй, давхардуулахгүй.
--   • Бүх чиглэлд буцах нислэг (FRA, HKG, SIN, DXB, SVO, дотоод, г.м)
--   • ICN/PEK/NRT-д өдөрт 2 дахь (орой) нислэг
--   • Огнооны хязгаар: 2026-05-20 → 2027-06-30 (бүх чиглэлд)
--   • Бодит захиалга: confirmed / pending / cancelled / completed
-- NOT EXISTS guard (flight_number + departure_time) дахин ажиллуулахад ч аюулгүй.
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
  -- ----- Одоо байгаа нэг талын чиглэлүүд (огноо сунгахад дахин жагсаав) -----
    ('OM301','OM','ULN','ICN', interval '01:30', 210,  890000.00, 1890000.00, 168),
    ('OM302','OM','ICN','ULN', interval '08:00', 210,  890000.00, 1890000.00, 168),
    ('KE868','KE','ULN','ICN', interval '03:00', 210,  950000.00, 2200000.00, 200),
    ('KE867','KE','ICN','ULN', interval '10:00', 210,  950000.00, 2200000.00, 200),
    ('OZ370','OZ','ULN','ICN', interval '05:30', 215,  920000.00, 2100000.00, 180),
    ('OM501','OM','ULN','PEK', interval '03:00', 150,  750000.00, 1450000.00, 168),
    ('OM502','OM','PEK','ULN', interval '07:00', 150,  750000.00, 1450000.00, 168),
    ('CA738','CA','ULN','PEK', interval '02:00', 150,  720000.00, 1380000.00, 180),
    ('OM701','OM','ULN','NRT', interval '00:30', 270, 1350000.00, 2900000.00, 220),
    ('OM702','OM','NRT','ULN', interval '06:30', 270, 1350000.00, 2900000.00, 220),
    ('JL722','JL','ULN','NRT', interval '04:00', 270, 1420000.00, 3100000.00, 200),
    ('NH936','NH','ULN','HND', interval '02:30', 275, 1480000.00, 3200000.00, 210),
    ('TK023','TK','ULN','IST', interval '14:00', 510, 1890000.00, 4500000.00, 250),
    ('TK024','TK','IST','ULN', interval '20:00', 510, 1890000.00, 4500000.00, 250),
    ('OM601','OM','ULN','FRA', interval '14:00', 450, 2890000.00, 5800000.00, 220),
    ('OM801','OM','ULN','BKK', interval '01:00', 360, 1250000.00, 2700000.00, 200),
    ('OM802','OM','BKK','ULN', interval '09:00', 360, 1250000.00, 2700000.00, 200),
    ('OM901','OM','ULN','HKG', interval '02:00', 300, 1180000.00, 2500000.00, 190),
    ('OM110','OM','ULN','SIN', interval '00:30', 420, 1650000.00, 3500000.00, 210),
    ('SU331','SU','ULN','SVO', interval '06:00', 390, 1550000.00, 3300000.00, 230),
    ('OM205','OM','ULN','DXB', interval '03:30', 480, 1980000.00, 4200000.00, 220),
    ('M0901','M0','ULN','HET', interval '06:00',  90,  480000.00,       NULL,  70),
    ('MR225','MR','ULN','HVD', interval '02:30', 150,  320000.00,       NULL,  50),
    ('MR318','MR','ULN','MXV', interval '04:00', 105,  290000.00,       NULL,  50),
  -- ----- ШИНЭ: дутуу байсан буцах нислэгүүд -----
    ('OZ371','OZ','ICN','ULN', interval '12:00', 215,  920000.00, 2100000.00, 180),
    ('CA739','CA','PEK','ULN', interval '06:00', 150,  720000.00, 1380000.00, 180),
    ('JL723','JL','NRT','ULN', interval '11:00', 270, 1420000.00, 3100000.00, 200),
    ('NH937','NH','HND','ULN', interval '09:00', 275, 1480000.00, 3200000.00, 210),
    ('OM602','OM','FRA','ULN', interval '22:00', 450, 2890000.00, 5800000.00, 220),
    ('OM902','OM','HKG','ULN', interval '08:00', 300, 1180000.00, 2500000.00, 190),
    ('OM111','OM','SIN','ULN', interval '10:00', 420, 1650000.00, 3500000.00, 210),
    ('SU332','SU','SVO','ULN', interval '14:00', 390, 1550000.00, 3300000.00, 230),
    ('OM206','OM','DXB','ULN', interval '13:00', 480, 1980000.00, 4200000.00, 220),
    ('M0902','M0','HET','ULN', interval '09:00',  90,  480000.00,       NULL,  70),
    ('MR226','MR','HVD','ULN', interval '06:00', 150,  320000.00,       NULL,  50),
    ('MR319','MR','MXV','ULN', interval '07:00', 105,  290000.00,       NULL,  50),
  -- ----- ШИНЭ: алдартай чиглэлийн 2 дахь (орой) давтамж -----
    ('OM303','OM','ULN','ICN', interval '12:00', 210,  910000.00, 1950000.00, 168),
    ('OM304','OM','ICN','ULN', interval '18:00', 210,  910000.00, 1950000.00, 168),
    ('OM503','OM','ULN','PEK', interval '13:00', 150,  770000.00, 1480000.00, 168),
    ('OM504','OM','PEK','ULN', interval '17:00', 150,  770000.00, 1480000.00, 168),
    ('OM703','OM','ULN','NRT', interval '11:00', 270, 1380000.00, 2950000.00, 220),
    ('OM704','OM','NRT','ULN', interval '19:00', 270, 1380000.00, 2950000.00, 220)
) AS r(flight_number, airline_iata, origin, dest, dep_offset, duration_min, economy_price, business_price, seats)
CROSS JOIN generate_series(
  TIMESTAMPTZ '2026-05-20 00:00:00+00',
  TIMESTAMPTZ '2027-06-30 00:00:00+00',
  INTERVAL '1 day'
) AS gs(day)
WHERE NOT EXISTS (
  SELECT 1 FROM flights f
  WHERE f.flight_number = r.flight_number
    AND f.departure_time = (gs.day + r.dep_offset)::timestamptz
);


-- ----- Нэмэлт үйлчлүүлэгчид -----
INSERT INTO customers (last_name, first_name, register_no, passport_no, birth_date, gender, email, phone) VALUES
  ('Цэрэндорж', 'Ганзориг',  'УЕ88030412', 'MN5101234', '1988-03-04', 'M', 'ganzo@example.com',  '99115522'),
  ('Лхагвасүрэн','Алтантуяа', 'УЖ91070819', 'MN5102345', '1991-07-08', 'F', 'altaa@example.com',  '88224466'),
  ('Бямбадорж', 'Тэмүүлэн',   'УЗ95111223', 'MN5103456', '1995-11-12', 'M', 'temka@example.com',  '99337788'),
  ('Очирбат',   'Сувд',       'УИ83040506', 'MN5104567', '1983-04-05', 'F', 'suvd@example.com',   '80559900'),
  ('Дамдин',    'Хүслэн',     'УК99090911', 'MN5105678', '1999-09-09', 'F', 'huslen@example.com', '95113377')
ON CONFLICT (register_no) DO NOTHING;


-- ----- Бодит захиалгууд (төлөв янз бүр) -----
INSERT INTO bookings (booking_code, customer_id, created_by, trip_type,
                      total_passengers, total_amount, paid_amount, status, metadata, booking_date)
SELECT
  v.booking_code,
  (SELECT customer_id FROM customers WHERE register_no = v.cust_reg),
  (SELECT user_id FROM users WHERE username = v.agent_user),
  v.trip_type, v.total_passengers, v.total_amount, 0, v.status,
  v.metadata::jsonb, v.booking_date::timestamptz
FROM (VALUES
  ('AGS2A01','УЕ88030412','saraa','round_trip', 1, 1780000.00, 'pending',   '{"source":"website","campaign":"summer2026"}',  '2026-05-12 08:30:00+00'),
  ('AGS2A02','УЖ91070819','munkh','one_way',    2, 1900000.00, 'pending',   '{"source":"call_center"}',                       '2026-05-13 10:05:00+00'),
  ('AGS2A03','УЗ95111223','saraa','one_way',    1,  890000.00, 'pending',   '{"source":"website"}',                           '2026-05-14 12:40:00+00'),
  ('AGS2A04','УИ83040506','saraa','round_trip', 2, 3700000.00, 'pending',   '{"source":"website","campaign":"family"}',       '2026-05-15 09:15:00+00'),
  ('AGS2A05','УК99090911','munkh','one_way',    1,  750000.00, 'pending',   '{"source":"mobile_app"}',                        '2026-05-15 16:20:00+00'),
  ('AGS2A06','УА90080912','saraa','one_way',    1, 1250000.00, 'cancelled', '{"source":"website","cancel_reason":"plan_changed"}', '2026-05-10 11:00:00+00'),
  ('AGS2A07','УБ85050415','munkh','round_trip', 1, 2400000.00, 'cancelled', '{"source":"call_center","cancel_reason":"duplicate"}', '2026-05-11 14:30:00+00'),
  ('AGS2A08','УД92121507','saraa','one_way',    1,  320000.00, 'completed', '{"source":"website"}',                           '2026-04-20 07:45:00+00')
) AS v(booking_code, cust_reg, agent_user, trip_type, total_passengers, total_amount, status, metadata, booking_date)
ON CONFLICT (booking_code) DO NOTHING;


-- ----- Зорчигчид -----
INSERT INTO passengers (booking_id, last_name, first_name, passport_no, passport_expiry,
                        birth_date, gender, passenger_type, seat_number)
SELECT
  (SELECT booking_id FROM bookings WHERE booking_code = v.bk_code),
  v.last_name, v.first_name, v.passport_no, v.passport_expiry::date,
  v.birth_date::date, v.gender, v.passenger_type, v.seat_number
FROM (VALUES
  ('AGS2A01','Цэрэндорж','Ганзориг','MN5101234','2031-03-04','1988-03-04','M','adult','12A'),
  ('AGS2A02','Лхагвасүрэн','Алтантуяа','MN5102345','2030-07-08','1991-07-08','F','adult','15C'),
  ('AGS2A02','Лхагвасүрэн','Болд','MN5102346','2032-01-02','2016-01-02','M','child','15D'),
  ('AGS2A03','Бямбадорж','Тэмүүлэн','MN5103456','2033-11-12','1995-11-12','M','adult','9F'),
  ('AGS2A04','Очирбат','Сувд','MN5104567','2029-04-05','1983-04-05','F','adult','3A'),
  ('AGS2A04','Очирбат','Билгүүн','MN5104568','2034-06-07','2012-06-07','M','child','3B'),
  ('AGS2A05','Дамдин','Хүслэн','MN5105678','2030-09-09','1999-09-09','F','adult','20E'),
  ('AGS2A06','Дашдорж','Энхтөр','MN1234567','2030-08-09','1990-08-09','M','adult','7C'),
  ('AGS2A07','Батсайхан','Оюунчимэг','MN2345678','2028-05-04','1985-05-04','F','adult','11A'),
  ('AGS2A08','Ганбат','Болормаа','MN3456789','2029-12-15','1992-12-15','F','adult','5D')
) AS v(bk_code, last_name, first_name, passport_no, passport_expiry, birth_date, gender, passenger_type, seat_number)
WHERE EXISTS (SELECT 1 FROM bookings WHERE booking_code = v.bk_code)
  AND NOT EXISTS (
    SELECT 1 FROM passengers p
    WHERE p.booking_id = (SELECT booking_id FROM bookings WHERE booking_code = v.bk_code)
      AND p.passport_no = v.passport_no
  );


-- ----- Төлбөр: pending=хагас, confirmed=бүтэн, completed=бүтэн -----
-- (trigger paid_amount-ыг тооцоолж, бүтэн төлсөн → confirmed болгоно)
INSERT INTO payments (booking_id, amount, payment_method, transaction_no, status, received_by, paid_at)
SELECT
  (SELECT booking_id FROM bookings WHERE booking_code = v.bk_code),
  v.amount, v.payment_method, v.transaction_no, v.status,
  (SELECT user_id FROM users WHERE username = v.recv), v.paid_at::timestamptz
FROM (VALUES
  ('AGS2A01', 1780000.00, 'qpay',          'SEED2-0001', 'success', 'saraa', '2026-05-12 09:00:00+00'),
  ('AGS2A02',  950000.00, 'bank_transfer', 'SEED2-0002', 'success', 'munkh', '2026-05-13 11:00:00+00'),
  ('AGS2A04', 1850000.00, 'card',          'SEED2-0003', 'success', 'saraa', '2026-05-15 10:00:00+00'),
  ('AGS2A08',  320000.00, 'cash',          'SEED2-0004', 'success', 'saraa', '2026-04-20 08:00:00+00')
) AS v(bk_code, amount, payment_method, transaction_no, status, recv, paid_at)
WHERE EXISTS (SELECT 1 FROM bookings WHERE booking_code = v.bk_code)
  AND NOT EXISTS (SELECT 1 FROM payments pm WHERE pm.transaction_no = v.transaction_no);


-- 'completed' захиалгын төлөв (бүтэн төлсний дараа trigger 'confirmed'
-- болгосныг гараар 'completed' болгож засна — өнгөрсөн аялал).
UPDATE bookings SET status = 'completed'
 WHERE booking_code = 'AGS2A08' AND status = 'confirmed';


-- migrate:down
DELETE FROM payments WHERE transaction_no LIKE 'SEED2-%';
DELETE FROM passengers WHERE booking_id IN (
  SELECT booking_id FROM bookings WHERE booking_code LIKE 'AGS2%');
DELETE FROM bookings WHERE booking_code LIKE 'AGS2%';
DELETE FROM flights WHERE flight_number IN (
  'OZ371','CA739','JL723','NH937','OM602','OM902','OM111','SU332',
  'OM206','M0902','MR226','MR319','OM303','OM304','OM503','OM504','OM703','OM704');
DELETE FROM flights WHERE departure_time > TIMESTAMPTZ '2026-09-30 23:59:59+00';
