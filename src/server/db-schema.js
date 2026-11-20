// Câu lệnh tạo bảng D1. Dùng chung cho Worker (store.server.js) và script nhập dữ liệu (scripts/import-base44.mjs).
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS records (
    entity TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    created_by TEXT,
    created_by_id TEXT,
    PRIMARY KEY (entity, id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_records_created ON records(entity, created_date)`,
  `CREATE INDEX IF NOT EXISTS idx_user_email ON records(json_extract(data, '$.email')) WHERE entity = 'User'`,
  `CREATE INDEX IF NOT EXISTS idx_booking_code ON records(json_extract(data, '$.booking_code')) WHERE entity = 'Booking'`,
  `CREATE INDEX IF NOT EXISTS idx_tour_slug ON records(json_extract(data, '$.slug')) WHERE entity = 'Tour'`,
  `CREATE INDEX IF NOT EXISTS idx_post_slug ON records(json_extract(data, '$.slug')) WHERE entity = 'BlogPost'`,
  `CREATE INDEX IF NOT EXISTS idx_departure_tour ON records(json_extract(data, '$.tour_id')) WHERE entity = 'Departure'`,
  `CREATE TABLE IF NOT EXISTS credentials (
    user_id TEXT PRIMARY KEY,
    password_hash TEXT,
    reset_hash TEXT,
    reset_expires INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS auth_attempts (key TEXT NOT NULL, at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_auth_attempts ON auth_attempts(key, at)`,
];
