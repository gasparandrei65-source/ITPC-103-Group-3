import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { fail, toTime, dayOfWeek } from '../utils.js';

const router = Router();
router.use(requireAuth);

// GET /api/availability?college_id=<id|all>&date=YYYY-MM-DD&start=HH:MM&end=HH:MM
// college_id=all returns every room on the ZPPSU campus
router.get('/', async (req, res) => {
  const { date } = req.query;
  const requested = Number(req.query.college_id || req.user.college_id);
  // 'all' was asked for, or the user has no college assigned: show the whole campus
  const all = req.query.college_id === 'all' || !Number.isInteger(requested) || requested <= 0;
  const collegeId = requested;
  const scope = all ? '1=1' : 'r.college_id=?';
  const scopeParams = all ? [] : [collegeId];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) fail(400, 'A valid date is required');
  const start = toTime(req.query.start || '00:00');
  const end = toTime(req.query.end || '23:59:59');
  if (end <= start) fail(400, 'End time must be after the start time');

  const [rooms] = await pool.query(
    `SELECT r.*, c.code AS college_code FROM rooms r JOIN colleges c ON c.id=r.college_id
     WHERE ${scope} ORDER BY c.code, r.name`, scopeParams);
  const [classes] = await pool.query(
    `SELECT t.* FROM timetable t JOIN rooms r ON r.id=t.room_id
     WHERE ${scope} AND t.day_of_week=? ORDER BY t.start_time`, [...scopeParams, dayOfWeek(date)]);
  const [resv] = await pool.query(
    `SELECT v.*, u.name AS holder_name FROM reservations v
       JOIN rooms r ON r.id=v.room_id JOIN users u ON u.id=v.user_id
     WHERE ${scope} AND v.reservation_date=? AND v.status IN ('approved','pending')
     ORDER BY v.start_time`, [...scopeParams, date]);

  const hit = (x) => x.start_time < end && x.end_time > start;

  res.json(rooms.map((room) => {
    const rc = classes.filter((c) => c.room_id === room.id);
    const rr = resv.filter((r) => r.room_id === room.id);
    const classHit = rc.find(hit) || null;
    const held = rr.find((r) => r.status === 'approved' && hit(r)) || null;
    const pending = rr.filter((r) => r.status === 'pending' && hit(r));
    let status = 'available';
    if (room.status === 'maintenance') status = 'maintenance';
    else if (classHit) status = 'class';
    else if (held) status = 'reserved';
    const day_schedule = [
      ...rc.map((c) => ({ type: 'class', label: c.subject, who: [c.section, c.instructor].filter(Boolean).join(' - '), start_time: c.start_time, end_time: c.end_time })),
      ...rr.map((r) => ({ type: r.status, label: r.subject ? `${r.subject}${r.section ? ' (' + r.section + ')' : ''}` : r.purpose, who: r.holder_name, start_time: r.start_time, end_time: r.end_time })),
    ].sort((a, b) => a.start_time.localeCompare(b.start_time));
    return { room, status, class_slot: classHit, reservation: held, pending, day_schedule };
  }));
});

export default router;
