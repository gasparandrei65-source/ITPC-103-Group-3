import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { fail } from '../utils.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.*,
       (SELECT COUNT(*) FROM rooms r WHERE r.college_id=c.id) AS room_count,
       (SELECT COUNT(*) FROM users u WHERE u.college_id=c.id) AS user_count
     FROM colleges c ORDER BY c.code`);
  res.json(rows);
});

router.post('/', requireAdmin, async (req, res) => {
  const code = (req.body.code || '').trim().toUpperCase();
  const name = (req.body.name || '').trim();
  if (!/^[A-Z0-9-]{2,20}$/.test(code)) fail(400, 'College code must be 2-20 letters/numbers (e.g. CAHSS)');
  if (!name) fail(400, 'College name is required');
  try {
    const [r] = await pool.query('INSERT INTO colleges (code,name) VALUES (?,?)', [code, name]);
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') fail(409, `A college with the code ${code} already exists`);
    throw e;
  }
});

// A college can only be deleted when nothing depends on it
router.delete('/:id', requireAdmin, async (req, res) => {
  const [[c]] = await pool.query(
    `SELECT c.*,
       (SELECT COUNT(*) FROM rooms r WHERE r.college_id=c.id) AS room_count,
       (SELECT COUNT(*) FROM users u WHERE u.college_id=c.id) AS user_count
     FROM colleges c WHERE c.id=?`, [req.params.id]);
  if (!c) fail(404, 'College not found');
  if (c.room_count || c.user_count)
    fail(409, `Cannot delete ${c.code}: it still has ${c.room_count} room(s) and ${c.user_count} user account(s). Remove them first.`);
  await pool.query('DELETE FROM colleges WHERE id=?', [c.id]);
  res.json({ ok: true });
});

export default router;
