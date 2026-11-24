# ZPPSU Academic Room & Timetable Management System - Features

Scope: the whole ZPPSU campus (SBA, CET, CTE, CAHSS, CICS, CPES, ITE and any college added later).

## Core system
Faculty staff reserve classrooms by selecting a date and time. They can check room availability, view schedules, and update or cancel reservations up to 24 hours before the reserved time. All newly submitted bookings enter a pending state and require administrator approval before being officially confirmed as reserved. A peer-to-peer override workflow lets a faculty member request an already-reserved room; the request stays pending until the original reserver approves or declines the transfer.

## Features
1. **Room Management (CRUD)** - Add, view, update and delete classroom records. Each administrator manages the rooms of their own college.
2. **Timetable Management** - Create and manage classroom schedules. Scheduled classes block bookings.
3. **Availability Dashboard** - Shows room availability, pending requests and current reservation holders for the selected date and time.
   - **College Search / Filter dropdown** beside the date and time selectors. It shows only the available rooms, pending requests and current holders of the selected college, or every college with "All colleges (campus-wide)".
4. **Reservation Management** - Faculty create, update and cancel bookings within the permitted time (24-hour rule).
   - Faculty **browse and book available rooms within their chosen college**: choose college, date and time, and only that college's free rooms are listed.
5. **Administrative Approval Workflow** - Every new reservation starts as pending. The administrator **of the room's college** is notified and approves or rejects it. Administrators of other colleges cannot see or act on it.
6. **Conflict Resolution & Override Requests** - A faculty member can request an occupied slot. The current holder is notified and approves or declines the transfer before the booking is finalized.
7. **User Authentication** - Only authorized faculty staff and administrators can log in.
   - **College Identity field** on every user profile (e.g. CICS, CTE, SBA, CET, CPES, ITE, CAHSS).
8. **College Management** - Administrators can **add and delete colleges** (a college can be deleted only when it has no rooms and no user accounts).
9. **Notifications** - In-app notifications for new requests, approvals, rejections and override requests.

## Where to find each feature in the app
| Feature | Page |
|---|---|
| Availability Dashboard + College filter | Availability |
| Browse & book rooms by college | My Reservations (faculty) |
| Approve / reject bookings | Reservation Approvals (admin) |
| Override requests | Override Requests (faculty) |
| Room CRUD | Rooms (admin) |
| Timetable CRUD | Timetable |
| Add / delete college | Colleges (admin) |
| College Identity on accounts | Users (admin) |
