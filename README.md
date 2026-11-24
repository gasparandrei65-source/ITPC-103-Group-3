# Academic Room & Timetable Management System
Zamboanga Peninsula Polytechnic State University (ZPPSU) - campus-wide, all colleges and departments
Stack: ReactJS (Vite) + MySQL (XAMPP) + Node/Express API + HTML/CSS

See `FEATURES.md` for the full feature list.

## 1. One-time setup
1. Install Node.js (LTS) from nodejs.org.
2. Open the XAMPP Control Panel and START **MySQL** (Apache is not needed).
3. Open a terminal in `server/` and run:
   ```
   npm install
   npm run seed        # creates room_timetable_db, tables, 3 colleges, rooms, sample timetable, demo accounts
   ```
   **Upgrading from the previous version?** The tables changed (colleges were added), so wipe and rebuild the demo data once with `npm run reset`, then log out and log in again in the browser.
   (Alternative: import `database/schema.sql` in phpMyAdmin, then run `npm run seed`.)
4. Open a terminal in `client/` and run:
   ```
   npm install
   ```

## 2. Run (two terminals)
```
cd server && npm start      # API  -> http://localhost:5000
cd client && npm run dev    # App  -> http://localhost:5173
```
If your XAMPP MySQL has a root password or another port, edit `server/.env`.

## 3. Demo accounts
| Role | Email | Password |
|---|---|---|
| Administrator (one per college) | admin.sba@, admin.cet@, admin.cte@, admin.cahss@, admin.cics@, admin.cpes@, admin.ite@ + `zppsu.edu.ph` | admin123 |
| Faculty (CICS) | santos@zppsu.edu.ph, reyes@zppsu.edu.ph | faculty123 |
| Faculty (other colleges) | faculty.sba@, faculty.cet@, faculty.cte@, faculty.cahss@, faculty.cpes@, faculty.ite@, faculty.cics@, + `zppsu.edu.ph` | faculty123 |

Colleges: SBA, CET, CTE, CAHSS, CICS, CPES, ITE.

## 4. Business rules (what to explain in the defense)
- **Colleges:** every user account has a College Identity (SBA, CET, CTE, CAHSS, CICS, CPES, ITE...). Every room belongs to one college. Any administrator can add a college, or delete one that has no rooms and no user accounts.
- **Availability dashboard:** a College dropdown sits next to the date/time pickers. Pick one college, or "All colleges (campus-wide)" to see every room in ZPPSU with a summary (available / reserved / in class / pending). It defaults to the viewer's own college. The Timetable page has the same filter.
- **Booking across colleges:** faculty choose a college, date and time, and the form lists only the free rooms of that college.
- **Approval routing:** a booking is sent only to the administrator(s) of the ROOM's college, and only they can approve or reject it. A booking cannot be submitted to a college that has no administrator yet.
- **Admin scope:** an administrator manages rooms, timetable entries and approvals for their own college only. Users and Colleges pages are shared by all administrators.
- Every new reservation is saved as PENDING and all administrators are notified.
- Only the administrator can approve/reject. Approval re-checks conflicts first.
- Faculty can edit/cancel only while the slot is 24 hours or more away. An edit sends the booking back to PENDING.
- Fixed classes in the Timetable block booking. Only APPROVED reservations block a slot; several PENDING requests may exist for the same slot and the admin decides.
- Override: if a slot is APPROVED for another faculty, the requester sends an override request. The holder gets a notification and approves or declines. Approve = ownership of the reservation transfers to the requester (original holder is stored in `transferred_from`). Other pending overrides on that slot are closed automatically.
- Override requests also follow the 24-hour cut-off.
- Only logged-in users with an account (created by the admin) can use the system (JWT login, passwords hashed with bcrypt).

## 5. Suggested defense demo flow
1. Login as Santos (CICS) -> Availability -> switch the College dropdown to SBA -> reserve the Accounting Laboratory (pending).
2. Login as admin.sba@zppsu.edu.ph -> notification -> Reservation Approvals -> Approve. (admin.cics@ does NOT see this request.)
3. Login as faculty.sba@zppsu.edu.ph -> same slot shows "Reserved by Santos" -> Request override.
4. Login as Santos -> Override Requests -> Approve -> slot transfers to the SBA faculty.
5. Login as any admin -> Colleges -> add a college, then try deleting CICS to show the safety rule.
6. Show Users (College field), Rooms CRUD, Timetable CRUD, the 24-hour lock, and a class-conflict error.
> Tip: book dates at least 2 days ahead so the 24-hour rules can be demonstrated.

## 6. Folder map
```
database/schema.sql      MySQL tables (colleges, users, rooms, timetable, reservations, override_requests, notifications)
server/                  Express API (routes/ = one file per feature)
client/src/pages/        React screens (Dashboard, Reservations, Overrides, Rooms, Timetable, Colleges, Users, Notifications)
client/src/styles.css    All HTML/CSS styling
```
