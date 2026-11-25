import 'dotenv/config';
import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'room_timetable_db',
  dateStrings: true, // DATE/TIME come back as plain strings ('2026-11-30', '08:00:00')
  waitForConnections: true,
  connectionLimit: 10,
});
