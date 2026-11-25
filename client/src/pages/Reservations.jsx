import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { Alert, StatusBadge } from '../components/ui.jsx';
import { fmtTime, hoursUntil, prettyDate, todayStr } from '../helpers.js';

const makeEmpty = (collegeId) => ({ college_id: collegeId, room_id: '', date: todayStr(), start_time: '08:00', end_time: '10:00', section: '', subject: '', purpose: '' });

export default function Reservations() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [list, setList] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [roomOptions, setRoomOptions] = useState([]);
  const [form, setForm] = useState(makeEmpty(user.college_id));
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [filter, setFilter] = useState('');

  const load = async () => {
    try { setList(await api('/reservations' + (filter ? `?status=${filter}` : ''))); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
  };
  useEffect(() => { load(); }, [filter]);
  useEffect(() => { api('/colleges').then(setColleges).catch(() => {}); }, []);

  // Browse only the rooms that are actually free in the chosen college / date / time
  useEffect(() => {
    if (isAdmin || !form.college_id || !form.date) return;
    let off = false;
    api(`/availability?college_id=${form.college_id}&date=${form.date}&start=${form.start_time}&end=${form.end_time}`)
      .then((d) => {
        if (off) return;
        const opts = d.filter((x) => x.status === 'available' || x.reservation?.user_id === user.id).map((x) => x.room);
        setRoomOptions(opts);
        setForm((f) => (opts.some((o) => String(o.id) === String(f.room_id)) ? f : { ...f, room_id: '' }));
      })
      .catch(() => { if (!off) setRoomOptions([]); });
    return () => { off = true; };
  }, [form.college_id, form.date, form.start_time, form.end_time]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const collegeCode = colleges.find((c) => String(c.id) === String(form.college_id))?.code;

  const sendOverride = async (reservationId) => {
    try {
      await api('/overrides', { method: 'POST', body: { reservation_id: reservationId, purpose: form.purpose, section: form.section, subject: form.subject } });
      setMsg({ type: 'success', text: 'Override request sent. The current holder has been notified.' });
      window.dispatchEvent(new Event('notifications-changed'));
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api(`/reservations/${editingId}`, { method: 'PUT', body: form });
        setMsg({ type: 'success', text: 'Reservation updated and sent back for approval (PENDING).' });
      } else {
        await api('/reservations', { method: 'POST', body: form });
        setMsg({ type: 'success', text: `Reservation submitted. Status: PENDING until the ${collegeCode} administrator approves it.` });
      }
      setForm(makeEmpty(user.college_id)); setEditingId(null); load();
      window.dispatchEvent(new Event('notifications-changed'));
    } catch (err) {
      if (err.data?.code === 'ROOM_RESERVED' && form.purpose.trim() && form.section.trim() && form.subject.trim()) {
        setMsg({
          type: 'warning', text: err.message,
          action: <button className="btn warn small-btn" onClick={() => sendOverride(err.data.reservation_id)}>Send override request</button>,
        });
      } else {
        setMsg({ type: 'error', text: err.message });
      }
    }
  };

  const edit = (r) => {
    setEditingId(r.id);
    setForm({ college_id: r.college_id, room_id: r.room_id, date: r.reservation_date, start_time: fmtTime(r.start_time), end_time: fmtTime(r.end_time), section: r.section || '', subject: r.subject || '', purpose: r.purpose });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancel = async (r) => {
    if (!window.confirm('Cancel this reservation?')) return;
    try { await api(`/reservations/${r.id}/cancel`, { method: 'POST' }); setMsg({ type: 'success', text: 'Reservation cancelled.' }); load(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const review = async (r, decision) => {
    let remarks = '';
    if (decision === 'rejected') {
      remarks = window.prompt('Reason for rejection (optional):') ?? null;
      if (remarks === null) return;
    }
    try {
      await api(`/reservations/${r.id}/review`, { method: 'PATCH', body: { decision, remarks } });
      setMsg({ type: 'success', text: `Reservation ${decision}.` });
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const sorted = isAdmin
    ? [...list].sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1))
    : list;

  return (
    <>
      <h2>{isAdmin ? `Reservation Approvals - ${user.college_code}` : 'My Reservations'}</h2>
      <p className="muted">
        {isAdmin
          ? `You review bookings for rooms owned by ${user.college_code}. New bookings stay PENDING until you approve or reject them.`
          : 'Pick a college, date and time, then choose from its free rooms. The booking is PENDING until that college\'s administrator approves it. You can edit or cancel up to 24 hours before the reserved time.'}
      </p>

      <Alert msg={msg} onClose={() => setMsg(null)} />

      {!isAdmin && (
        <form className="card form-grid" onSubmit={submit}>
          <h3>{editingId ? `Edit reservation #${editingId}` : 'New reservation'}</h3>
          <label>College
            <select value={form.college_id} onChange={(e) => setForm({ ...form, college_id: Number(e.target.value), room_id: '' })} required>
              {colleges.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
            </select>
          </label>
          <label>Date<input type="date" min={todayStr()} value={form.date} onChange={set('date')} required /></label>
          <label>Start<input type="time" value={form.start_time} onChange={set('start_time')} required /></label>
          <label>End<input type="time" value={form.end_time} onChange={set('end_time')} required /></label>
          <label className="span2">Available room
            <select value={form.room_id} onChange={set('room_id')} required>
              <option value="">{roomOptions.length ? 'Select a room...' : 'No free rooms for this slot'}</option>
              {roomOptions.map((r) => <option key={r.id} value={r.id}>{r.name} (capacity {r.capacity})</option>)}
            </select>
          </label>
          <label>Section<input value={form.section} onChange={set('section')} placeholder="e.g. BSIT 2A" maxLength={60} required /></label>
          <label className="span2">Subject<input value={form.subject} onChange={set('subject')} placeholder="e.g. Web Systems" maxLength={120} required /></label>
          <label className="span2">Purpose<input value={form.purpose} onChange={set('purpose')} placeholder="e.g. Thesis consultation" required /></label>
          <p className="muted small wide">Only free rooms of {collegeCode || 'the selected college'} are listed. A room that is taken can be requested from its holder through the Availability page.</p>
          <div className="actions end wide">
            {editingId && <button type="button" className="btn ghost" onClick={() => { setEditingId(null); setForm(makeEmpty(user.college_id)); }}>Cancel edit</button>}
            <button className="btn primary">{editingId ? 'Save changes' : 'Submit reservation'}</button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="table-head">
          <h3>{isAdmin ? 'Reservations for my college' : 'Reservation history'}</h3>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <table>
          <thead>
            <tr>{isAdmin && <th>Faculty</th>}<th>College</th><th>Room</th><th>Date</th><th>Time</th><th>Section</th><th>Subject</th><th>Purpose</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={10} className="muted center">No reservations found.</td></tr>}
            {sorted.map((r) => {
              const open = ['pending', 'approved'].includes(r.status);
              const unlocked = hoursUntil(r.reservation_date, r.start_time) >= 24;
              return (
                <tr key={r.id}>
                  {isAdmin && <td>{r.faculty_name}</td>}
                  <td>{r.college_code}</td>
                  <td>{r.room_name}</td>
                  <td>{prettyDate(r.reservation_date)}</td>
                  <td>{fmtTime(r.start_time)}-{fmtTime(r.end_time)}</td>
                  <td>{r.section || '-'}</td>
                  <td>{r.subject || '-'}</td>
                  <td>{r.purpose}{r.admin_remarks && <small className="muted"><br />Admin: {r.admin_remarks}</small>}
                    {r.transferred_from && <small className="muted"><br />Transferred via override</small>}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="row-actions">
                    {isAdmin && r.status === 'pending' && (<>
                      <button className="btn primary small-btn" onClick={() => review(r, 'approved')}>Approve</button>
                      <button className="btn danger small-btn" onClick={() => review(r, 'rejected')}>Reject</button>
                    </>)}
                    {isAdmin && r.status === 'approved' && <button className="btn danger small-btn" onClick={() => cancel(r)}>Cancel</button>}
                    {!isAdmin && open && unlocked && (<>
                      <button className="btn small-btn" onClick={() => edit(r)}>Edit</button>
                      <button className="btn danger small-btn" onClick={() => cancel(r)}>Cancel</button>
                    </>)}
                    {!isAdmin && open && !unlocked && <small className="muted">Locked (under 24h)</small>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
