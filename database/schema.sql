-- Academic Room & Timetable Management System - ZPPSU campus-wide
-- Import this file in phpMyAdmin (XAMPP) or run: npm run seed (inside /server)

CREATE DATABASE IF NOT EXISTS room_timetable_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE room_timetable_db;

CREATE TABLE IF NOT EXISTS colleges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,          -- e.g. SBA, CET, CTE, CAHSS, CICS, CPES, ITE
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','faculty') NOT NULL DEFAULT 'faculty',
  college_id INT NULL,                       -- College Identity (NULL = not yet assigned)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_college FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL
);

-- ---- Migration for databases created before colleges existed ----------------
-- CREATE TABLE IF NOT EXISTS leaves an old `users` table untouched, so add the
-- column + foreign key when missing. Safe to run repeatedly (MySQL and MariaDB).
ALTER TABLE colleges MODIFY code VARCHAR(50) NOT NULL;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'college_id');
SET @sql := IF(@has_col = 0, 'ALTER TABLE users ADD COLUMN college_id INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_fk := (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
                  AND COLUMN_NAME = 'college_id' AND REFERENCED_TABLE_NAME = 'colleges');
SET @sql := IF(@has_fk = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_college FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Seed a default college when the table is empty
INSERT INTO colleges (code, name)
SELECT 'CICS', 'College of Information and Computing Sciences'
WHERE NOT EXISTS (SELECT 1 FROM colleges);

CREATE TABLE IF NOT EXISTS rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  college_id INT NOT NULL,                   -- the college that owns the room
  name VARCHAR(100) NOT NULL,
  location VARCHAR(150),
  capacity INT NOT NULL DEFAULT 30,
  description VARCHAR(255),
  status ENUM('active','maintenance') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_room_per_college (college_id, name),
  FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE RESTRICT
);

-- Old `rooms` tables also predate colleges: add college_id, backfill existing rooms
-- to the default (first) college, then enforce NOT NULL + foreign key.
SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rooms' AND COLUMN_NAME = 'college_id');
SET @sql := IF(@has_col = 0, 'ALTER TABLE rooms ADD COLUMN college_id INT NULL AFTER id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE rooms SET college_id = (SELECT id FROM colleges ORDER BY id LIMIT 1) WHERE college_id IS NULL;
ALTER TABLE rooms MODIFY college_id INT NOT NULL;

-- an old UNIQUE(name) would stop two colleges from having a same-named room
SET @old_idx := (SELECT s.INDEX_NAME FROM information_schema.STATISTICS s
                 WHERE s.TABLE_SCHEMA = DATABASE() AND s.TABLE_NAME = 'rooms' AND s.NON_UNIQUE = 0
                   AND s.INDEX_NAME <> 'PRIMARY' AND s.INDEX_NAME <> 'uq_room_per_college'
                 GROUP BY s.INDEX_NAME HAVING COUNT(*) = 1 AND MAX(s.COLUMN_NAME) = 'name' LIMIT 1);
SET @sql := IF(@old_idx IS NULL, 'SELECT 1', CONCAT('ALTER TABLE rooms DROP INDEX `', @old_idx, '`'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_uq := (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rooms' AND INDEX_NAME = 'uq_room_per_college');
SET @sql := IF(@has_uq = 0, 'ALTER TABLE rooms ADD UNIQUE KEY uq_room_per_college (college_id, name)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_fk := (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rooms'
                  AND COLUMN_NAME = 'college_id' AND REFERENCED_TABLE_NAME = 'colleges');
SET @sql := IF(@has_fk = 0,
  'ALTER TABLE rooms ADD CONSTRAINT fk_rooms_college FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE RESTRICT',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Fixed weekly class schedule (day_of_week: 0 = Sunday ... 6 = Saturday)
CREATE TABLE IF NOT EXISTS timetable (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  day_of_week TINYINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject VARCHAR(120) NOT NULL,
  section VARCHAR(60),
  instructor VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- One-off bookings made by faculty. Every new booking starts as 'pending'.
CREATE TABLE IF NOT EXISTS reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  user_id INT NOT NULL,
  reservation_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  purpose VARCHAR(255) NOT NULL,
  section VARCHAR(60) NULL,                  -- class section using the room, e.g. BSIT 2A
  subject VARCHAR(120) NULL,                 -- subject being held, e.g. Web Systems
  status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  admin_remarks VARCHAR(255),
  transferred_from INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_slot (room_id, reservation_date, start_time, end_time)
);

-- Peer-to-peer override: requester asks the current holder to hand over the slot
CREATE TABLE IF NOT EXISTS override_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reservation_id INT NOT NULL,
  requester_id INT NOT NULL,
  holder_id INT NOT NULL,
  purpose VARCHAR(255) NOT NULL,
  section VARCHAR(60) NULL,
  subject VARCHAR(120) NULL,
  status ENUM('pending','approved','declined','cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (holder_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message VARCHAR(300) NOT NULL,
  link VARCHAR(100),
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---- Section & subject for each booking (added to existing databases too) ----
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'section');
SET @sql := IF(@has = 0, 'ALTER TABLE reservations ADD COLUMN section VARCHAR(60) NULL AFTER purpose, ADD COLUMN subject VARCHAR(120) NULL AFTER section', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'override_requests' AND COLUMN_NAME = 'section');
SET @sql := IF(@has = 0, 'ALTER TABLE override_requests ADD COLUMN section VARCHAR(60) NULL AFTER purpose, ADD COLUMN subject VARCHAR(120) NULL AFTER section', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
