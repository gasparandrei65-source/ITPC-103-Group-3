import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { signToken, requireAuth } from '../auth.js';
import { fail } from '../utils.js';

const router = Router();

const USER_SQL = `SELECT u.id,u.name,u.email,u.role,u.college_id,u.password_hash,
                         c.code AS college_code, c.name AS college_name
                  FROM users u LEFT JOIN colleges c ON c.id=u.college_id`;
const publicUser = ({ password_hash, ...u }) => u;

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) fail(400, 'Email and password are required');
  const [[user]] = await pool.query(`${USER_SQL} WHERE u.email=?`, [email.trim().toLowerCase()]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) fail(401, 'Invalid email or password');
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const [[user]] = await pool.query(`${USER_SQL} WHERE u.id=?`, [req.user.id]);
  if (!user) fail(401, 'Account no longer exists');
  res.json(publicUser(user));
});

export default router;
