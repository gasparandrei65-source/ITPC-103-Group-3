import { pool } from './db.js';

export function fail(status, message, extra = {}) {
  const e = new Error(message);
  e.status = status;
  e.extra = extra;
  throw e;
}

export const toTime = (t) => (t && t.length === 5 ? `${t}:00` : t);
export const dayOfWeek = (date) => new Date(`${date}T00:00:00`).getDay();

// Hours between now and the start of a slot (negative = already started)
export const hoursUntil = (date, time) =>
  (new Date(`${date}T${toTime(time)}`).getTime() - Date.now()) / 36e5;

export function validateSlot(b) {
  const date = b.date || b.reservation_date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) fail(400, 'A valid date is required');
  const ok = (t) => /^\d{2}:\d{2}(:\d{2})?$/.test(t || '');
  if (!ok(b.start_time) || !ok(b.end_time)) fail(400, 'Valid start and end times are required');
  const start = toTime(b.start_time);
  const end = toTime(b.end_time);
  if (end <= start) fail(400, 'End time must be after the start time');
  if (new Date(`${date}T${start}`).getTime() <= Date.now()) fail(400, 'The reservation must be in the future');
  return { date, start, end };
}

// Anything that already occupies the room in that window (classes + APPROVED reservations)
export async function findConflicts(db, { roomId, date, start, end, excludeId = 0 }) {
  const [classes] = await db.query(
    `SELECT * FROM timetable WHERE room_id=? AND day_of_week=? AND start_time < ? AND end_time > ?`,
    [roomId, dayOfWeek(date), end, start]
  );
  const [reservations] = await db.query(
    `SELECT r.*, u.name AS holder_name FROM reservations r JOIN users u ON u.id=r.user_id
     WHERE r.room_id=? AND r.reservation_date=? AND r.status='approved' AND r.id<>?
       AND r.start_time < ? AND r.end_time > ?`,
    [roomId, date, excludeId, end, start]
  );
  return { classes, reservations };
}

export async function assertSlotFree(db, roomId, slot, userId, excludeId = 0) {
  const c = await findConflicts(db, { roomId, date: slot.date, start: slot.start, end: slot.end, excludeId });
  if (c.classes.length) {
    const k = c.classes[0];
    fail(409, `The room has a scheduled class (${k.subject}) during that time.`, { code: 'CLASS_CONFLICT' });
  }
  if (c.reservations.length) {
    const r = c.reservations[0];
    if (r.user_id === userId) fail(409, 'You already hold a reservation that overlaps this time.', { code: 'OWN_RESERVATION' });
    fail(409, `This slot is already reserved by ${r.holder_name}. You can send an override request.`, {
      code: 'ROOM_RESERVED',
      reservation_id: r.id,
      holder_name: r.holder_name,
    });
  }
}

export const notify = (db, userId, message, link = null) =>
  db.query('INSERT INTO notifications (user_id, message, link) VALUES (?,?,?)', [userId, message, link]);

// Approvals are routed only to the administrator(s) of the room's college
export async function notifyAdmins(db, collegeId, message, link) {
  const [admins] = await db.query("SELECT id FROM users WHERE role='admin' AND college_id=?", [collegeId]);
  for (const a of admins) await notify(db, a.id, message, link);
  return admins.length;
}

export async function assertHasAdmin(db, room) {
  const [[row]] = await db.query("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND college_id=?", [room.college_id]);
  if (!row.n) fail(409, `${room.college_code || 'That college'} has no administrator yet to approve bookings.`);
}

// Used when a reservation is cancelled or edited: pending override requests no longer make sense
export async function declineOverridesFor(db, reservationId, reason) {
  const [pending] = await db.query(
    "SELECT id, requester_id FROM override_requests WHERE reservation_id=? AND status='pending'",
    [reservationId]
  );
  for (const o of pending) {
    await db.query("UPDATE override_requests SET status='declined', responded_at=NOW() WHERE id=?", [o.id]);
    await notify(db, o.requester_id, `Your override request was closed. ${reason}`, '/overrides');
  }
}

export const fmtSlot = (date, start, end) => `${date} ${start.slice(0, 5)}-${end.slice(0, 5)}`;
