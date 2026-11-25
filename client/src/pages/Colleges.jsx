import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alert } from '../components/ui.jsx';

export default function Colleges() {
  const [colleges, setColleges] = useState([]);
  const [form, setForm] = useState({ code: '', name: '' });
  const [msg, setMsg] = useState(null);

  const load = () => api('/colleges').then(setColleges).catch((e) => setMsg({ type: 'error', text: e.message }));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('/colleges', { method: 'POST', body: form });
      setMsg({ type: 'success', text: `College ${form.code.toUpperCase()} added. Next, create its administrator under Users.` });
      setForm({ code: '', name: '' });
      load();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete college ${c.code}?`)) return;
    try { await api(`/colleges/${c.id}`, { method: 'DELETE' }); setMsg({ type: 'success', text: `${c.code} deleted.` }); load(); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
  };

  return (
    <>
      <h2>Colleges</h2>
      <p className="muted">Each college owns its rooms and has its own administrator who approves bookings. A college can be deleted only when it has no rooms or user accounts.</p>
      <Alert msg={msg} onClose={() => setMsg(null)} />

      <form className="card form-grid" onSubmit={submit}>
        <h3>Add college</h3>
        <label>Code
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. CAS" maxLength={20} required />
        </label>
        <label className="span3">Full name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. College of Arts and Sciences" required />
        </label>
        <div className="actions end wide"><button className="btn primary">Add college</button></div>
      </form>

      <div className="card">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Rooms</th><th>Users</th><th>Action</th></tr></thead>
          <tbody>
            {colleges.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.code}</strong></td><td>{c.name}</td><td>{c.room_count}</td><td>{c.user_count}</td>
                <td><button className="btn danger small-btn" onClick={() => remove(c)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
