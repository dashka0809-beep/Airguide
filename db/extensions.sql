-- ============================================================
-- extensions.sql — PostgreSQL-ийн нэмэлт боломжуудыг идэвхжүүлэх
--
-- Хэрэглэх:
--   psql -U postgres -d airguide_db -f db/extensions.sql
--
-- Эсвэл Railway-д:
--   railway run psql < db/extensions.sql
--
-- Анхаар: Railway-н managed Postgres дээр эдгээр extension-ууд
-- анхдагчаар идэвхжсэн байдаг. Local Postgres-д заавал ажиллуулна.
-- ============================================================

-- pg_trgm — trigram (3-letter substring) matching
-- Хэрэглээ: autocomplete-д "ulan" → "Ulaanbaatar" хайх
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- pgcrypto — random bytes, UUID v4 (gen_random_uuid())
-- Хэрэглээ: booking_code, password salt, token үүсгэх
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- pg_stat_statements — query performance tracking
-- Хэрэглээ: slow query олох, p95 latency мониторинг
-- Анхаар: postgresql.conf-д shared_preload_libraries дотор бүртгэгдсэн байх ёстой.
-- Railway автомат тохируулсан.
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Шалгах:
--   SELECT extname, extversion FROM pg_extension ORDER BY extname;
