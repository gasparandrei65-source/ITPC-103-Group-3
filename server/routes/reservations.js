import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireAdmin, requireFaculty } from '../auth.js';
import {
  fail, validateSlot, hoursUntil, findConflicts, assertSlotFree,
  notify, notifyAdmins, assertHasAdmin, declineOverridesFor, fmtSlot,
} from '../utils.js';

const router = Router();
router.use(requireAuth);

const BASE = `SELECT r.*, rm.name AS room_name, rm.college_id, c.code AS college_code, u.name AS faculty_name
              FROM reservations r JOIN rooms rm ON rm.id=r.room_id
              JOIN colleges c ON c.id=rm.college_id JOIN users u ON u.id=r.user_id`;

// Section and subject are required for every booking
const classInfo = (b) => {
  const section = (b.section || '').trim();
  const subject = (b.subject || '').trim();
  if (!section) fail(400, 'Section is required (e.g. BSIT 2A)');
  if (!subject) fail(400, 'Subject is required (e.g. Web Systems)');
  if (section.length > 60) fail(400, 'Section is too long (max 60 characters)');
  if (subject.length > 120) fail(400, 'Subject is too long (max 120 characters)');
  return { section, subject };
};

const ROOM_SQL = `SELECT rm.*, c.code AS college_code FROM rooms rm JOIN colleges c ON c.id=rm.college_id WHERE rm.id=?`;

// Faculty see their own bookings; an administrator sees bookings for rooms of THEIR college
router.get('/', async (req, res) => {
  const params = [];
  let where = 'WHERE 1=1';
  if (req.user.role === 'admin') { where += ' AND rm.college_id=?'; params.push(req.user.college_id); }
  else { where += ' AND r.user_id=?'; params.push(req.user.id); }
  if (req.query.status) { where += ' AND r.status=?'; params.push(req.query.status); }
  const [rows] = await pool.query(`${BASE} ${where} ORDER BY r.reservation_date DESC, r.start_time DESC`, params);
  res.json(rows);
});

// CREATE -> always starts as PENDING, administrator is notified
router.post('/', requireFaculty, async (req, res) => {
  const { room_id, purpose } = req.body;
  if (!purpose?.trim()) fail(400, 'Purpose is required');
  const { section, subject } = classInfo(req.body);
  const slot = validateSlot(req.body);
  const [[room]] = await pool.query(ROOM_SQL, [room_id]);
  if (!room) fail(404, 'Room not found');
  if (room.status !== 'active') fail(409, 'This room is under maintenance');
  await assertHasAdmin(pool, room);
  await assertSlotFree(pool, room_id, slot, req.user.id);
  const [r] = await pool.query(
    `INSERT INTO reservations (room_id,user_id,reservation_date,start_time,end_time,purpose,section,subject,status)
     VALUES (?,?,?,?,?,?,?,?,'pending')`,
    [room_id, req.user.id, slot.date, slot.start, slot.end, purpose.trim(), section, subject]);
  await notifyAdmins(pool, room.college_id, `${req.user.name} requested ${room.college_code} - ${room.name} on ${fmtSlot(slot.date, slot.start, slot.end)}. Please review.`, '/reservations');
  res.status(201).json({ id: r.insertId, status: 'pending' });
});

// UPDATE -> owner only, at least 24 hours before the slot; goes back to PENDING for re-approval
router.put('/:id', requireFaculty, async (req, res) => {
  const [[cur]] = await pool.query('SELECT * FROM reservations WHERE id=?', [req.params.id]);
  if (!cur || cur.user_id !== req.user.id) fail(404, 'Reservation not found');
  if (!['pending', 'approved'].includes(cur.status)) fail(409, `A ${cur.status} reservation cannot be changed`);
  if (hoursUntil(cur.reservation_date, cur.start_time) < 24)
    fail(403, 'Reservations can only be changed up to 24 hours before the reserved time');
  const { room_id, purpose } = req.body;
  if (!purpose?.trim()) fail(400, 'Purpose is required');
  const { section, subject } = classInfo(req.body);
  const slot = validateSlot(req.body);
  const [[room]] = await pool.query(ROOM_SQL, [room_id]);
  if (!room || room.status !== 'active') fail(409, 'That room is not available for booking');
  await assertHasAdmin(pool, room);
  await assertSlotFree(pool, room_id, slot, req.user.id, cur.id);
  await pool.query(
    `UPDATE reservations SET room_id=?, reservation_date=?, start_time=?, end_time=?, purpose=?,
       section=?, subject=?, status='pending', admin_remarks=NULL WHERE id=?`,
    [room_id, slot.date, slot.start, slot.end, purpose.trim(), section, subject, cur.id]);
  await declineOverridesFor(pool, cur.id, 'The holder changed this reservation.');
  await notifyAdmins(pool, room.college_id, `${req.user.name} updated a reservation (${room.college_code} - ${room.name}, ${fmtSlot(slot.date, slot.start, slot.end)}). Please review.`, '/reservations');
  res.json({ ok: true, status: 'pending' });
});

// CANCEL -> owner (24h rule) or administrator (any time)
router.post('/:id/cancel', async (req, res) => {
  const [[cur]] = await pool.query(
    'SELECT r.*, rm.college_id FROM reservations r JOIN rooms rm ON rm.id=r.room_id WHERE r.id=?', [req.params.id]);
  const isAdmin = req.user.role === 'admin';
  if (!cur || (!isAdmin && cur.user_id !== req.user.id)) fail(404, 'Reservation not found');
  if (isAdmin && cur.college_id !== req.user.college_id) fail(403, "This reservation belongs to another college's administrator");
  if (!['pending', 'approved'].includes(cur.status)) fail(409, `A ${cur.status} reservation cannot be cancelled`);
  if (!isAdmin && hoursUntil(cur.reservation_date, cur.start_time) < 24)
    fail(403, 'Reservations can only be cancelled up to 24 hours before the reserved time');
  await pool.query("UPDATE reservations SET status='cancelled' WHERE id=?", [cur.id]);
  await declineOverridesFor(pool, cur.id, 'The reservation was cancelled.');
  if (isAdmin && cur.user_id !== req.user.id)
    await notify(pool, cur.user_id, `The administrator cancelled your reservation on ${fmtSlot(cur.reservation_date, cur.start_time, cur.end_time)}.`, '/reservations');
  res.json({ ok: true });
});

// ADMIN APPROVAL WORKFLOW
router.patch('/:id/review', requireAdmin, async (req, res) => {
  const { decision, remarks } = req.body;
  if (!['approved', 'rejected'].includes(decision)) fail(400, 'Decision must be approved or rejected');
  const [[cur]] = await pool.query(
    `SELECT r.*, rm.name AS room_name, rm.college_id FROM reservations r JOIN rooms rm ON rm.id=r.room_id WHERE r.id=?`, [req.params.id]);
  if (!cur) fail(404, 'Reservation not found');
  if (cur.college_id !== req.user.college_id) fail(403, "Only the room's college administrator can review this reservation");
  if (cur.status !== 'pending') fail(409, 'Only pending reservations can be reviewed');
  if (decision === 'approved') {
    if (hoursUntil(cur.reservation_date, cur.start_time) <= 0) fail(409, 'That time slot has already started');
    const c = await findConflicts(pool, {
      roomId: cur.room_id, date: cur.reservation_date, start: cur.start_time, end: cur.end_time, excludeId: cur.id });
    if (c.classes.length || c.reservations.length)
      fail(409, 'Cannot approve: the slot now conflicts with a class or another approved reservation.');
  }
  await pool.query('UPDATE reservations SET status=?, admin_remarks=? WHERE id=?', [decision, remarks || null, cur.id]);
  await notify(pool, cur.user_id,
    `Your reservation for ${cur.room_name} (${fmtSlot(cur.reservation_date, cur.start_time, cur.end_time)}) was ${decision}.${remarks ? ' Remarks: ' + remarks : ''}`,
    '/reservations');
  res.json({ ok: true });
});

export default router;
