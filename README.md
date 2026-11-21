# Academic Room and Timetable Management System (CICS, ZPPSU)

Web-based room reservation and timetable system for the three CICS laboratories
(Robotics, Internet, Computer Lab), built from the project presentation.

Stack: React JS frontend (Vite) · Node.js + Express backend · MySQL database · runs on localhost.

## Requirements
- Node.js 18 or newer — https://nodejs.org
- MySQL 8 (or MariaDB 10.5+) running locally — e.g. MySQL Installer, XAMPP, or Laragon
- Internet for the first `npm install` (downloads React, Vite and the server packages)

## Run it
1. Open `.env` and set `DB_PASSWORD` to your MySQL root password (leave blank if none).
2. In this folder run, in order:
   ```
   npm install       # installs the server AND the React client
   npm run setup     # creates the database, tables, admin account and sample data
   npm run build     # compiles the React app into /public
   npm start         # starts the system
   ```
3. Open **http://localhost:3000**

### Developing the React app (optional)
Keep `npm start` running, and in a second terminal run `npm run dev`.
Open **http://localhost:5173** — edits to files in `client/src` reload instantly and `/api` calls are forwarded to the server.
Run `npm run build` again when you are done so port 3000 serves your latest version.

## Default accounts (change these after first sign-in)
| Role | Email | Password |
|---|---|---|
| Administrator | admin@zppsu.local | Admin@12345 |
| Faculty (sample) | faculty@zppsu.local | Faculty@12345 |

## What it does (mapped to the presentation)
| Presentation feature | Where |
|---|---|
| Availability dashboard (real-time) | Home page: timeline per room, "Find a free room", current-time marker |
| Weekly timetable | "Weekly timetable" page, filter by room |
| Reservation management | Faculty: "My reservations" (create, edit, cancel) |
| 24-hour cut-off | Faculty cannot edit/cancel/book inside the window (admin-adjustable) |
| Conflict prevention, first come first served | Server checks classes + reservations inside a locked transaction |
| Room management (CRUD) | Admin panel > Rooms |
| Timetable management | Admin panel > Class timetable |
| User authentication, staff-only changes | Sign-in required to change anything; students/instructors view only |

## Admin panel (controls the entire system)
- Overview – counts, today's room usage, recent activity
- Reservations – view/filter all, create for any staff, edit, cancel with reason, reinstate, export CSV (admins bypass the cut-off)
- Class timetable – recurring weekly classes; overlap detection; warns if existing reservations clash
- Rooms – add/edit/delete; set Available, Maintenance or Closed
- Users – add faculty/admins, edit, deactivate, reset password, delete
- System settings – reservations on/off, require sign-in to view, cut-off hours, opening/closing time, max booking length, advance-booking limit, system name, announcement banner
- Audit log – searchable record of every important action

## Project layout
```
server.js, src/        Express API (auth, public, reservations, admin) + booking rules
database/schema.sql    MySQL tables
scripts/setup.js       creates DB, admin, sample data
client/                React app (Vite): src/pages, src/admin, src/components.jsx, src/context.jsx
public/                build output of the React app (created by npm run build)
```

## Notes
- The server only listens on `127.0.0.1` (this computer). To allow other devices on your network set `HOST=0.0.0.0` in `.env`.
- Troubleshooting: "Access denied" → fix `DB_PASSWORD`; "ECONNREFUSED" → start MySQL; port busy → change `PORT`;
  page says "frontend has not been built" → run `npm run build`.

