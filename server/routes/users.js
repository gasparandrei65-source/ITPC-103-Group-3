import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { fail } from '../utils.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id,u.name,u.email,u.role,u.college_id,c.code AS college_code,u.created_at
     FROM users u LEFT JOIN colleges c ON c.id=u.college_id ORDER BY c.code, u.role, u.name`);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name, email, password, role, college_id } = req.body;
  if (!name?.trim() || !email?.trim() || !password) fail(400, 'Name, email and password are required');
  if (password.length < 6) fail(400, 'Password must be at least 6 characters');
  if (!['admin', 'faculty'].includes(role)) fail(400, 'Invalid role');
  const [[college]] = await pool.query('SELECT id FROM colleges WHERE id=?', [college_id]);
  if (!college) fail(400, 'Please choose a valid college');
  try {
    const [r] = await pool.query('INSERT INTO users (name,email,password_hash,role,college_id) VALUES (?,?,?,?,?)', [
      name.trim(), email.trim().toLowerCase(), bcrypt.hashSync(password, 10), role, college_id,
    ]);
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') fail(409, 'That email is already registered');
    throw e;
  }
});

router.delete('/:id', async (req, res) => {
  if (Number(req.params.id) === req.user.id) fail(400, 'You cannot delete your own account');
  await pool.query('DELETE FROM users WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

export default router;
