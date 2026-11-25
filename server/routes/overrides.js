import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireFaculty } from '../auth.js';
import { fail, hoursUntil, notify, fmtSlot } from '../utils.js';

const router = Router();
router.use(requireAuth);

const BASE = `SELECT o.*, r.reservation_date, r.start_time, r.end_time, r.purpose AS current_purpose, r.section AS current_section, r.subject AS current_subject,
                     rm.name AS room_name, rq.name AS requester_name, h.name AS holder_name
              FROM override_requests o
              JOIN reservations r ON r.id=o.reservation_id
              JOIN rooms rm ON rm.id=r.room_id
              JOIN users rq ON rq.id=o.requester_id
              JOIN users h ON h.id=o.holder_id`;

router.get('/', async (req, res) => {
  const [incoming] = await pool.query(`${BASE} WHERE o.holder_id=? ORDER BY o.created_at DESC`, [req.user.id]);
  const [outgoing] = await pool.query(`${BASE} WHERE o.requester_id=? ORDER BY o.created_at DESC`, [req.user.id]);
  res.json({ incoming, outgoing });
});

// A faculty member asks for a slot that someone else already holds
router.post('/', requireFaculty, async (req, res) => {
  const { reservation_id, purpose } = req.body;
  if (!purpose?.trim()) fail(400, 'Please state the purpose of your request');
  const section = (req.body.section || '').trim();
  const subject = (req.body.subject || '').trim();
  if (!section) fail(400, 'Section is required (e.g. BSIT 2A)');
  if (!subject) fail(400, 'Subject is required (e.g. Web Systems)');
  if (section.length > 60 || subject.length > 120) fail(400, 'Section or subject is too long');
  const [[resv]] = await pool.query(
    `SELECT r.*, rm.name AS room_name FROM reservations r JOIN rooms rm ON rm.id=r.room_id WHERE r.id=?`, [reservation_id]);
  if (!resv || resv.status !== 'approved') fail(404, 'No approved reservation found for that slot');
  if (resv.user_id === req.user.id) fail(400, 'You already hold this reservation');
  if (hoursUntil(resv.reservation_date, resv.start_time) < 24)
    fail(403, 'Override requests must be made at least 24 hours before the reserved time');
  const [[dup]] = await pool.query(
    "SELECT id FROM override_requests WHERE reservation_id=? AND requester_id=? AND status='pending'", [resv.id, req.user.id]);
  if (dup) fail(409, 'You already have a pending override request for this reservation');
  const [r] = await pool.query(
    'INSERT INTO override_requests (reservation_id, requester_id, holder_id, purpose, section, subject) VALUES (?,?,?,?,?,?)',
    [resv.id, req.user.id, resv.user_id, purpose.trim(), section, subject]);
  await notify(pool, resv.user_id,
    `${req.user.name} asked to take over ${resv.room_name} (${fmtSlot(resv.reservation_date, resv.start_time, resv.end_time)}). Approve or decline.`,
    '/overrides');
  res.status(201).json({ id: r.insertId });
});

// The current holder approves (transfer) or declines
router.post('/:id/respond', requireFaculty, async (req, res) => {
  const { decision } = req.body;
  if (!['approved', 'declined'].includes(decision)) fail(400, 'Decision must be approved or declined');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[o]] = await conn.query('SELECT * FROM override_requests WHERE id=? FOR UPDATE', [req.params.id]);
    if (!o || o.holder_id !== req.user.id) fail(404, 'Override request not found');
    if (o.status !== 'pending') fail(409, 'This request was already answered');
    const [[resv]] = await conn.query(
      `SELECT r.*, rm.name AS room_name FROM reservations r JOIN rooms rm ON rm.id=r.room_id WHERE r.id=? FOR UPDATE`, [o.reservation_id]);
    const slot = fmtSlot(resv.reservation_date, resv.start_time, resv.end_time);

    if (decision === 'approved') {
      if (resv.status !== 'approved' || resv.user_id !== req.user.id) fail(409, 'This reservation is no longer yours to transfer');
      if (hoursUntil(resv.reservation_date, resv.start_time) <= 0) fail(409, 'The reserved time has already started');
      await conn.query(
        "UPDATE reservations SET user_id=?, purpose=?, section=?, subject=?, transferred_from=?, status='approved' WHERE id=?",
        [o.requester_id, o.purpose, o.section, o.subject, o.holder_id, resv.id]);
      await conn.query("UPDATE override_requests SET status='approved', responded_at=NOW() WHERE id=?", [o.id]);
      const [others] = await conn.query(
        "SELECT id, requester_id FROM override_requests WHERE reservation_id=? AND id<>? AND status='pending'", [resv.id, o.id]);
      for (const x of others) {
        await conn.query("UPDATE override_requests SET status='declined', responded_at=NOW() WHERE id=?", [x.id]);
        await notify(conn, x.requester_id, `Your override request for ${resv.room_name} (${slot}) was closed because the slot went to someone else.`, '/overrides');
      }
      await notify(conn, o.requester_id, `${req.user.name} approved your request. ${resv.room_name} (${slot}) is now yours.`, '/reservations');
    } else {
      await conn.query("UPDATE override_requests SET status='declined', responded_at=NOW() WHERE id=?", [o.id]);
      await notify(conn, o.requester_id, `${req.user.name} declined your request for ${resv.room_name} (${slot}).`, '/overrides');
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

// The requester withdraws a pending request
router.post('/:id/cancel', requireFaculty, async (req, res) => {
  const [[o]] = await pool.query('SELECT * FROM override_requests WHERE id=?', [req.params.id]);
  if (!o || o.requester_id !== req.user.id) fail(404, 'Override request not found');
  if (o.status !== 'pending') fail(409, 'Only pending requests can be withdrawn');
  await pool.query("UPDATE override_requests SET status='cancelled', responded_at=NOW() WHERE id=?", [o.id]);
  res.json({ ok: true });
});

export default router;
