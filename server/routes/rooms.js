import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { fail } from '../utils.js';

const router = Router();
router.use(requireAuth);

// GET /api/rooms?college_id=1  (everyone may browse; admins manage only their own college)
router.get('/', async (req, res) => {
  const params = [];
  let where = '';
  if (req.query.college_id) { where = 'WHERE r.college_id=?'; params.push(req.query.college_id); }
  const [rows] = await pool.query(
    `SELECT r.*, c.code AS college_code FROM rooms r JOIN colleges c ON c.id=r.college_id ${where} ORDER BY r.name`, params);
  res.json(rows);
});

function clean(b) {
  if (!b.name?.trim()) fail(400, 'Room name is required');
  const capacity = Number(b.capacity);
  if (!Number.isInteger(capacity) || capacity < 1) fail(400, 'Capacity must be a positive number');
  if (!['active', 'maintenance'].includes(b.status || 'active')) fail(400, 'Invalid status');
  return [b.name.trim(), b.location || null, capacity, b.description || null, b.status || 'active'];
}

async function ownRoom(req) {
  const [[room]] = await pool.query('SELECT * FROM rooms WHERE id=?', [req.params.id]);
  if (!room) fail(404, 'Room not found');
  if (room.college_id !== req.user.college_id) fail(403, 'You can only manage rooms of your own college');
  return room;
}

router.post('/', requireAdmin, async (req, res) => {
  try {
    const [r] = await pool.query(
      'INSERT INTO rooms (name,location,capacity,description,status,college_id) VALUES (?,?,?,?,?,?)',
      [...clean(req.body), req.user.college_id]);
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') fail(409, 'Your college already has a room with that name');
    throw e;
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  await ownRoom(req);
  try {
    await pool.query('UPDATE rooms SET name=?,location=?,capacity=?,description=?,status=? WHERE id=?',
      [...clean(req.body), req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') fail(409, 'Your college already has a room with that name');
    throw e;
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await ownRoom(req);
  await pool.query('DELETE FROM rooms WHERE id=?', [req.params.id]); // schedules & bookings cascade
  res.json({ ok: true });
});

export default router;
