-- Bookings.created_by нь users(user_id)-руу FK боловч index байхгүй.
-- Postgres FK багана автомат index үүсгэдэггүй. Admin "agent-аар
-- шүүх" query (v_booking_details дотор created_by JOIN) хурдасна.
-- Аюулгүй, буцаах боломжтой жишээ migration.

-- migrate:up
CREATE INDEX IF NOT EXISTS idx_bookings_created_by ON bookings(created_by);

-- migrate:down
DROP INDEX IF EXISTS idx_bookings_created_by;
