import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { fail, toTime } from '../utils.js';

const router = Router();
router.use(requireAuth);

// GET /api/timetable?college_id=&room_id=
router.get('/', async (req, res) => {
  const params = [];
  let where = 'WHERE 1=1';
  if (req.query.college_id) { where += ' AND r.college_id=?'; params.push(req.query.college_id); }
  if (req.query.room_id) { where += ' AND t.room_id=?'; params.push(req.query.room_id); }
  const [rows] = await pool.query(
    `SELECT t.*, r.name AS room_name, r.college_id, c.code AS college_code
     FROM timetable t JOIN rooms r ON r.id=t.room_id JOIN colleges c ON c.id=r.college_id ${where}
     ORDER BY t.day_of_week, t.start_time`, params);
  res.json(rows);
});

async function assertOwnRoom(roomId, user) {
  const [[room]] = await pool.query('SELECT college_id FROM rooms WHERE id=?', [roomId]);
  if (!room) fail(404, 'Room not found');
  if (room.college_id !== user.college_id) fail(403, 'You can only manage schedules of your own college');
}

async function clean(b, user, excludeId = 0) {
  const day = Number(b.day_of_week);
  if (!Number.isInteger(day) || day < 0 || day > 6) fail(400, 'Choose a valid day');
  if (!b.room_id) fail(400, 'Choose a room');
  await assertOwnRoom(b.room_id, user);
  if (!b.subject?.trim()) fail(400, 'Subject is required');
  const start = toTime(b.start_time), end = toTime(b.end_time);
  if (!start || !end || end <= start) fail(400, 'End time must be after the start time');
  const [clash] = await pool.query(
    `SELECT subject FROM timetable WHERE room_id=? AND day_of_week=? AND id<>? AND start_time<? AND end_time>?`,
    [b.room_id, day, excludeId, end, start]);
  if (clash.length) fail(409, `Overlaps with an existing class (${clash[0].subject}) in this room.`);
  return [b.room_id, day, start, end, b.subject.trim(), b.section || null, b.instructor || null];
}

async function assertOwnEntry(id, user) {
  const [[t]] = await pool.query('SELECT room_id FROM timetable WHERE id=?', [id]);
  if (!t) fail(404, 'Schedule not found');
  await assertOwnRoom(t.room_id, user);
}

router.post('/', requireAdmin, async (req, res) => {
  const v = await clean(req.body, req.user);
  const [r] = await pool.query(
    'INSERT INTO timetable (room_id,day_of_week,start_time,end_time,subject,section,instructor) VALUES (?,?,?,?,?,?,?)', v);
  res.status(201).json({ id: r.insertId });
});

router.put('/:id', requireAdmin, async (req, res) => {
  await assertOwnEntry(req.params.id, req.user);
  const v = await clean(req.body, req.user, Number(req.params.id));
  await pool.query(
    'UPDATE timetable SET room_id=?,day_of_week=?,start_time=?,end_time=?,subject=?,section=?,instructor=? WHERE id=?',
    [...v, req.params.id]);
  res.json({ ok: true });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await assertOwnEntry(req.params.id, req.user);
  await pool.query('DELETE FROM timetable WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

export default router;
