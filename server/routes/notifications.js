import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 50', [req.user.id]);
  res.json(rows);
});

router.get('/unread-count', async (req, res) => {
  const [[row]] = await pool.query('SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND is_read=0', [req.user.id]);
  res.json({ count: row.n });
});

router.post('/read-all', async (req, res) => {
  await pool.query('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.user.id]);
  res.json({ ok: true });
});

export default router;
