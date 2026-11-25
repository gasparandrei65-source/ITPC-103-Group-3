import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { Alert } from '../components/ui.jsx';
import { DAYS, DAY_ORDER, fmtTime } from '../helpers.js';

const EMPTY = { room_id: '', day_of_week: 1, start_time: '08:00', end_time: '10:00', subject: '', section: '', instructor: '' };

export default function Timetable() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [colleges, setColleges] = useState([]);
  const [collegeId, setCollegeId] = useState(user.college_id);
  const [rooms, setRooms] = useState([]);      // rooms of the viewed college (filter)
  const [ownRooms, setOwnRooms] = useState([]); // rooms the admin may schedule
  const [rows, setRows] = useState([]);
  const [roomFilter, setRoomFilter] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => api('/timetable?' + new URLSearchParams({
    ...(collegeId === 'all' ? {} : { college_id: collegeId }),
    ...(roomFilter ? { room_id: roomFilter } : {}),
  })).then(setRows).catch((e) => setMsg({ type: 'error', text: e.message }));
  useEffect(() => {
    api('/colleges').then(setColleges).catch(() => {});
    if (isAdmin) api(`/rooms?college_id=${user.college_id}`).then(setOwnRooms).catch(() => {});
  }, []);
  useEffect(() => { setRoomFilter(''); api(collegeId === 'all' ? '/rooms' : `/rooms?college_id=${collegeId}`).then(setRooms).catch(() => {}); }, [collegeId]);
  useEffect(() => { load(); }, [roomFilter, collegeId]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await api(`/timetable/${editingId}`, { method: 'PUT', body: form });
      else await api('/timetable', { method: 'POST', body: form });
      setMsg({ type: 'success', text: editingId ? 'Schedule updated.' : 'Schedule added.' });
      setForm(EMPTY); setEditingId(null); load();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  };

  const edit = (t) => {
    setEditingId(t.id);
    setForm({ room_id: t.room_id, day_of_week: t.day_of_week, start_time: fmtTime(t.start_time), end_time: fmtTime(t.end_time), subject: t.subject, section: t.section || '', instructor: t.instructor || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (t) => {
    if (!window.confirm('Delete this schedule entry?')) return;
    try { await api(`/timetable/${t.id}`, { method: 'DELETE' }); load(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  return (
    <>
      <h2>Weekly Timetable</h2>
      <p className="muted">Fixed class schedules. These slots are blocked and cannot be reserved.</p>
      <Alert msg={msg} onClose={() => setMsg(null)} />

      {isAdmin && (
        <form className="card form-grid" onSubmit={submit}>
          <h3>{editingId ? 'Edit schedule' : `Add schedule (${user.college_code})`}</h3>
          <label>Room
            <select value={form.room_id} onChange={set('room_id')} required>
              <option value="">Select a room...</option>
              {ownRooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label>Day
            <select value={form.day_of_week} onChange={set('day_of_week')}>
              {DAY_ORDER.map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}
            </select>
          </label>
          <label>Start<input type="time" value={form.start_time} onChange={set('start_time')} required /></label>
          <label>End<input type="time" value={form.end_time} onChange={set('end_time')} required /></label>
          <label>Subject<input value={form.subject} onChange={set('subject')} required /></label>
          <label>Section<input value={form.section} onChange={set('section')} /></label>
          <label>Instructor<input value={form.instructor} onChange={set('instructor')} /></label>
          <div className="actions end wide">
            {editingId && <button type="button" className="btn ghost" onClick={() => { setEditingId(null); setForm(EMPTY); }}>Cancel edit</button>}
            <button className="btn primary">{editingId ? 'Save changes' : 'Add schedule'}</button>
          </div>
        </form>
      )}

      <div className="card filters">
        <label>College
          <select value={collegeId} onChange={(e) => setCollegeId(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">All colleges (campus-wide)</option>
            {colleges.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
          </select>
        </label>
        <label>Show room
          <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
            <option value="">All rooms</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{collegeId === 'all' ? `${r.college_code} - ` : ''}{r.name}</option>)}
          </select>
        </label>
      </div>

      <div className="grid">
        {DAY_ORDER.map((d) => {
          const items = rows.filter((r) => r.day_of_week === d);
          if (items.length === 0) return null;
          return (
            <div className="card" key={d}>
              <h3>{DAYS[d]}</h3>
              {items.map((t) => (
                <div className="slot class" key={t.id}>
                  <span>{fmtTime(t.start_time)}-{fmtTime(t.end_time)}</span>
                  <span>{t.subject}<small> - {[t.section, t.instructor].filter(Boolean).join(' - ')}<br />{t.college_code} - {t.room_name}</small></span>
                  {isAdmin && t.college_id === user.college_id && (
                    <span className="row-actions">
                      <button className="btn small-btn" onClick={() => edit(t)}>Edit</button>
                      <button className="btn danger small-btn" onClick={() => remove(t)}>Delete</button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
        {rows.length === 0 && <p className="muted">No schedules yet.</p>}
      </div>
    </>
  );
}
