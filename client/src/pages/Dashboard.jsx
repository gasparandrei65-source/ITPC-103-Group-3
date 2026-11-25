import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { Alert, Modal } from '../components/ui.jsx';
import { fmtTime, todayStr, hoursUntil } from '../helpers.js';

const LABEL = { available: 'Available', reserved: 'Reserved', class: 'In class', maintenance: 'Maintenance' };

export default function Dashboard() {
  const { user } = useAuth();
  const [colleges, setColleges] = useState([]);
  const [collegeId, setCollegeId] = useState(user.college_id);
  const [date, setDate] = useState(todayStr());
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('17:00');
  const [rooms, setRooms] = useState([]);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null); // { mode: 'reserve' | 'override', room, reservation }
  const [purpose, setPurpose] = useState('');
  const [section, setSection] = useState('');
  const [subject, setSubject] = useState('');

  useEffect(() => { api('/colleges').then(setColleges).catch(() => {}); }, []);

  const load = useCallback(async () => {
    try { setRooms(await api(`/availability?college_id=${collegeId}&date=${date}&start=${start}&end=${end}`)); setMsg(null); }
    catch (e) { setMsg({ type: 'error', text: e.message }); setRooms([]); }
  }, [collegeId, date, start, end]);

  useEffect(() => { load(); }, [load]);

  const isAll = collegeId === 'all';
  const college = colleges.find((c) => String(c.id) === String(collegeId));
  const count = (st) => rooms.filter((r) => r.status === st).length;
  const pendingTotal = rooms.reduce((n, r) => n + r.pending.length, 0);

  const submit = async () => {
    try {
      if (modal.mode === 'reserve') {
        await api('/reservations', { method: 'POST', body: { room_id: modal.room.id, date, start_time: start, end_time: end, purpose, section, subject } });
        setMsg({ type: 'success', text: `Reservation submitted. It is PENDING until the ${modal.room.college_code} administrator approves it.` });
      } else {
        await api('/overrides', { method: 'POST', body: { reservation_id: modal.reservation.id, purpose, section, subject } });
        setMsg({ type: 'success', text: `Override request sent to ${modal.reservation.holder_name}. You will be notified of their answer.` });
      }
      setModal(null); setPurpose(''); setSection(''); setSubject('');
      window.dispatchEvent(new Event('notifications-changed'));
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); setModal(null); }
  };

  const canOverride = (r) => hoursUntil(r.reservation_date, r.start_time) >= 24;

  return (
    <>
      <h2>Room Availability Dashboard</h2>
      <p className="muted">Choose a college (or the whole campus), a date and a time window to see available rooms, pending requests and current reservation holders across ZPPSU.</p>

      <div className="card filters">
        <label>College
          <select value={collegeId} onChange={(e) => setCollegeId(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">All colleges (campus-wide)</option>
            {colleges.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
          </select>
        </label>
        <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>From<input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>To<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        <button className="btn" onClick={load}>Refresh</button>
      </div>

      <Alert msg={msg} onClose={() => setMsg(null)} />

      {rooms.length > 0 && (
        <div className="summary">
          <span className="chip available">{count('available')} available</span>
          <span className="chip reserved">{count('reserved')} reserved</span>
          <span className="chip class">{count('class')} in class</span>
          <span className="chip pending">{pendingTotal} pending request{pendingTotal === 1 ? '' : 's'}</span>
          <span className="muted small">{isAll ? `${rooms.length} rooms across the campus` : `${rooms.length} rooms in ${college?.code || ''}`}</span>
        </div>
      )}

      {rooms.length === 0 && !msg && <p className="muted">{college ? `${college.code} has no rooms yet.` : 'No rooms have been added yet.'}</p>}

      <div className="grid">
        {rooms.map(({ room, status, class_slot, reservation, pending, day_schedule }) => (
          <div key={room.id} className={`card room ${status}`}>
            <div className="room-head">
              <div>
                <h3><span className="college-tag">{room.college_code}</span> {room.name}</h3>
                <small className="muted">{room.location} - capacity {room.capacity}</small>
              </div>
              <span className={`pill ${status}`}>{LABEL[status]}</span>
            </div>

            {status === 'class' && (
              <p className="holder"><strong>Scheduled class:</strong> {class_slot.subject}
                {class_slot.section && ` (${class_slot.section})`} - {fmtTime(class_slot.start_time)}-{fmtTime(class_slot.end_time)}</p>
            )}
            {status === 'reserved' && (
              <p className="holder"><strong>Reserved by:</strong> {reservation.holder_name} - {fmtTime(reservation.start_time)}-{fmtTime(reservation.end_time)}
                <br /><small className="muted">{reservation.subject ? `${reservation.subject}${reservation.section ? ' - ' + reservation.section : ''}` : reservation.purpose}</small></p>
            )}
            {pending.length > 0 && (
              <div className="pending-box">
                <strong>{pending.length} pending request{pending.length > 1 ? 's' : ''}</strong>
                {pending.map((p) => (
                  <div key={p.id} className="small">{p.holder_name} - {fmtTime(p.start_time)}-{fmtTime(p.end_time)}</div>
                ))}
              </div>
            )}

            {user.role === 'faculty' && (
              <div className="actions">
                {status === 'available' && (
                  <button className="btn primary" onClick={() => { setPurpose(''); setSection(''); setSubject(''); setModal({ mode: 'reserve', room }); }}>Reserve this slot</button>
                )}
                {status === 'reserved' && reservation.user_id !== user.id && (
                  <button className="btn warn" onClick={() => { setPurpose(''); setSection(''); setSubject(''); setModal({ mode: 'override', room, reservation }); }}>Request this slot from {reservation.holder_name}</button>
                )}
                {status === 'reserved' && reservation.user_id === user.id && <span className="muted small">This is your reservation.</span>}
              </div>
            )}

            <details>
              <summary>Schedule for the day ({day_schedule.length})</summary>
              {day_schedule.length === 0 && <div className="small muted">Nothing scheduled.</div>}
              {day_schedule.map((s, i) => (
                <div key={i} className={`slot ${s.type}`}>
                  <span>{fmtTime(s.start_time)}-{fmtTime(s.end_time)}</span>
                  <span>{s.label}<small> - {s.who}</small></span>
                  <em>{s.type === 'class' ? 'class' : s.type}</em>
                </div>
              ))}
            </details>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={modal.mode === 'reserve' ? `Reserve ${modal.room.college_code} - ${modal.room.name}` : `Request override - ${modal.room.college_code} ${modal.room.name}`} onClose={() => setModal(null)}>
          <p className="muted small">
            {modal.room.college_code} - {date} - {start} to {end}.{' '}
            {modal.mode === 'reserve'
              ? `Your booking will be PENDING until the ${modal.room.college_code} administrator approves it.`
              : `${modal.reservation.holder_name} will be notified and must approve before the slot is transferred to you.`}
          </p>
          <label>Section
            <input value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. BSIT 2A" maxLength={60} autoFocus />
          </label>
          <label>Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Web Systems" maxLength={120} />
          </label>
          <label>Purpose
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Make-up class" />
          </label>
          <div className="actions end">
            <button className="btn ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn primary" disabled={!purpose.trim() || !section.trim() || !subject.trim()} onClick={submit}>Submit</button>
          </div>
        </Modal>
      )}
    </>
  );
}
