import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(dir, '..', 'database', 'schema.sql'), 'utf8');
const DB = process.env.DB_NAME || 'room_timetable_db';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
});

if (process.argv.includes('--reset')) {
  await conn.query(`DROP DATABASE IF EXISTS \`${DB}\``);
  console.log('Old database dropped.');
}
await conn.query(schema);
await conn.query(`USE \`${DB}\``);

const colleges = [
  ['SBA', 'School of Business Administration'],
  ['CET', 'College of Engineering and Technology'],
  ['CTE', 'College of Teacher Education'],
  ['CAHSS', 'College of Arts, Humanities and Social Sciences'],
  ['CICS', 'College of Information and Computing Sciences'],
  ['CPES', 'College of Physical Education and Sports'],
  ['ITE', 'Institute of Technology Education'],
];
for (const c of colleges) await conn.query('INSERT IGNORE INTO colleges (code,name) VALUES (?,?)', c);
const [cs] = await conn.query('SELECT id, code FROM colleges');
const cid = (code) => cs.find((c) => c.code === code).id;

// One administrator per college (admin@ = CICS, the others are admin.<code>@), plus faculty
const users = [];
for (const [code] of colleges) {
  const email = `admin.${code.toLowerCase()}@zppsu.edu.ph`;
  users.push([`${code} Administrator`, email, 'admin123', 'admin', code]);
}
users.push(['Prof. Santos', 'santos@zppsu.edu.ph', 'faculty123', 'faculty', 'CICS']);
users.push(['Prof. Reyes', 'reyes@zppsu.edu.ph', 'faculty123', 'faculty', 'CICS']);
for (const [code] of colleges) {
  if (code === 'CICS') continue;
  users.push([`${code} Faculty`, `faculty.${code.toLowerCase()}@zppsu.edu.ph`, 'faculty123', 'faculty', code]);
}
for (const [name, email, pw, role, col] of users) {
  await conn.query('INSERT IGNORE INTO users (name,email,password_hash,role,college_id) VALUES (?,?,?,?,?)', [
    name, email, bcrypt.hashSync(pw, 10), role, cid(col),
  ]);
}

// Accounts created before colleges existed (e.g. admin@zppsu.edu.ph) have no college: give them CICS
await conn.query('UPDATE users SET college_id=? WHERE college_id IS NULL', [cid('CICS')]);

const rooms = [
  ['CICS', 'Robotics Laboratory', 'CICS Building, 2nd Floor', 30, 'Robotics kits and workstations'],
  ['CICS', 'Internet Laboratory', 'CICS Building, 2nd Floor', 40, 'Networked workstations'],
  ['CICS', 'Computer Laboratory', 'CICS Building, 1st Floor', 40, 'General-purpose computer lab'],
  ['SBA', 'Accounting Laboratory', 'SBA Building, 1st Floor', 40, 'Accounting software workstations'],
  ['SBA', 'Business Simulation Room', 'SBA Building, 2nd Floor', 30, 'Case and simulation sessions'],
  ['CET', 'Electronics Laboratory', 'CET Building, 1st Floor', 30, 'Circuits and instrumentation'],
  ['CET', 'Drafting Room', 'CET Building, 2nd Floor', 35, 'Engineering drawing and CAD'],
  ['CTE', 'Speech Laboratory', 'CTE Building, 1st Floor', 35, 'Language and speech practice'],
  ['CTE', 'Education Technology Room', 'CTE Building, 2nd Floor', 40, 'Teaching demonstration room'],
  ['CAHSS', 'Psychology Laboratory', 'CAHSS Building, 1st Floor', 30, 'Experiments and testing'],
  ['CAHSS', 'Social Sciences Room', 'CAHSS Building, 2nd Floor', 45, 'Lectures and seminars'],
  ['CPES', 'Dance Studio', 'CPES Gym, 2nd Floor', 40, 'Dance and movement classes'],
  ['CPES', 'Sports Science Laboratory', 'CPES Gym, 1st Floor', 30, 'Fitness assessment'],
  ['ITE', 'Technology Workshop', 'ITE Building, 1st Floor', 35, 'Hands-on technology shop'],
  ['ITE', 'Industrial Arts Room', 'ITE Building, 2nd Floor', 35, 'Industrial arts classes'],
];
for (const [col, ...r] of rooms) {
  await conn.query('INSERT IGNORE INTO rooms (college_id,name,location,capacity,description) VALUES (?,?,?,?,?)', [cid(col), ...r]);
}

const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM timetable');
if (n === 0) {
  const [rs] = await conn.query('SELECT id, name FROM rooms');
  const id = (nm) => rs.find((r) => r.name === nm).id;
  const sample = [
    [id('Robotics Laboratory'), 1, '08:00', '10:00', 'Robotics Fundamentals', 'BSIT 2A', 'Prof. Santos'],
    [id('Robotics Laboratory'), 3, '13:00', '15:00', 'Embedded Systems', 'BSIT 3A', 'Prof. Reyes'],
    [id('Internet Laboratory'), 2, '09:00', '12:00', 'Web Systems', 'BSIT 2B', 'Prof. Reyes'],
    [id('Internet Laboratory'), 4, '13:00', '16:00', 'Networking 1', 'BSIT 3B', 'Prof. Santos'],
    [id('Computer Laboratory'), 1, '13:00', '16:00', 'Programming 1', 'BSIT 1A', 'Prof. Santos'],
    [id('Computer Laboratory'), 5, '08:00', '11:00', 'Database Systems', 'BSIT 2A', 'Prof. Reyes'],
    [id('Speech Laboratory'), 2, '10:00', '12:00', 'Oral Communication', 'BEED 1A', 'CTE Faculty'],
    [id('Accounting Laboratory'), 3, '09:00', '12:00', 'Computerized Accounting', 'BSA 2A', 'SBA Faculty'],
    [id('Electronics Laboratory'), 1, '13:00', '16:00', 'Basic Electronics', 'BSECE 2A', 'CET Faculty'],
    [id('Dance Studio'), 4, '08:00', '10:00', 'Rhythmic Activities', 'BPEd 1A', 'CPES Faculty'],
  ];
  for (const s of sample) {
    await conn.query(
      'INSERT INTO timetable (room_id,day_of_week,start_time,end_time,subject,section,instructor) VALUES (?,?,?,?,?,?,?)', s);
  }
}

console.log('Database ready.');
console.log('  Colleges: ' + colleges.map((c) => c[0]).join(', '));
console.log('  Admin   (password admin123):   admin.<code>@zppsu.edu.ph, e.g. admin.sba@ or admin.cics@');
console.log('  Faculty (password faculty123): santos@ and reyes@ (CICS), faculty.<code>@zppsu.edu.ph for the others, e.g. faculty.cet@');
await conn.end();
