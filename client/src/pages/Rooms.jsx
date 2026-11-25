import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { Alert, StatusBadge } from '../components/ui.jsx';

const EMPTY = { name: '', location: '', capacity: 30, description: '', status: 'active' };

export default function Rooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => api(`/rooms?college_id=${user.college_id}`).then(setRooms).catch((e) => setMsg({ type: 'error', text: e.message }));
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await api(`/rooms/${editingId}`, { method: 'PUT', body: form });
      else await api('/rooms', { method: 'POST', body: form });
      setMsg({ type: 'success', text: editingId ? 'Room updated.' : 'Room added.' });
      setForm(EMPTY); setEditingId(null); load();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  };

  const edit = (r) => {
    setEditingId(r.id);
    setForm({ name: r.name, location: r.location || '', capacity: r.capacity, description: r.description || '', status: r.status });
  };

  const remove = async (r) => {
    if (!window.confirm(`Delete "${r.name}"? Its schedules and reservations will be deleted too.`)) return;
    try { await api(`/rooms/${r.id}`, { method: 'DELETE' }); setMsg({ type: 'success', text: 'Room deleted.' }); load(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  return (
    <>
      <h2>Room Management - {user.college_code}</h2>
      <p className="muted">You manage the rooms of {user.college_name}. Other colleges' rooms are managed by their own administrators.</p>
      <Alert msg={msg} onClose={() => setMsg(null)} />

      <form className="card form-grid" onSubmit={submit}>
        <h3>{editingId ? 'Edit room' : 'Add room'}</h3>
        <label>Name<input value={form.name} onChange={set('name')} required /></label>
        <label>Location<input value={form.location} onChange={set('location')} /></label>
        <label>Capacity<input type="number" min="1" value={form.capacity} onChange={set('capacity')} required /></label>
        <label>Status
          <select value={form.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </label>
        <label className="wide">Description<input value={form.description} onChange={set('description')} /></label>
        <div className="actions end wide">
          {editingId && <button type="button" className="btn ghost" onClick={() => { setEditingId(null); setForm(EMPTY); }}>Cancel edit</button>}
          <button className="btn primary">{editingId ? 'Save changes' : 'Add room'}</button>
        </div>
      </form>

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Location</th><th>Capacity</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td><td>{r.location}</td><td>{r.capacity}</td><td>{r.description}</td>
                <td><StatusBadge status={r.status} /></td>
                <td className="row-actions">
                  <button className="btn small-btn" onClick={() => edit(r)}>Edit</button>
                  <button className="btn danger small-btn" onClick={() => remove(r)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
