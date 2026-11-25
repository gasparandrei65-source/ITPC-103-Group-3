import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alert } from '../components/ui.jsx';

const EMPTY = { name: '', email: '', password: '', role: 'faculty', college_id: '' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);

  const load = () => api('/users').then(setUsers).catch((e) => setMsg({ type: 'error', text: e.message }));
  useEffect(() => { load(); api('/colleges').then(setColleges).catch(() => {}); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try { await api('/users', { method: 'POST', body: form }); setMsg({ type: 'success', text: 'Account created.' }); setForm(EMPTY); load(); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete the account of ${u.name}?`)) return;
    try { await api(`/users/${u.id}`, { method: 'DELETE' }); load(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  return (
    <>
      <h2>User Accounts</h2>
      <p className="muted">Only accounts created here can log in. Every account belongs to a college; a college's administrator approves bookings for that college's rooms.</p>
      <Alert msg={msg} onClose={() => setMsg(null)} />
      <form className="card form-grid" onSubmit={submit}>
        <h3>Add account</h3>
        <label>Full name<input value={form.name} onChange={set('name')} required /></label>
        <label>Email<input type="email" value={form.email} onChange={set('email')} required /></label>
        <label>Password<input type="password" minLength={6} value={form.password} onChange={set('password')} required /></label>
        <label>College
          <select value={form.college_id} onChange={set('college_id')} required>
            <option value="">Select college...</option>
            {colleges.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
          </select>
        </label>
        <label>Role
          <select value={form.role} onChange={set('role')}>
            <option value="faculty">Faculty staff</option>
            <option value="admin">Administrator</option>
          </select>
        </label>
        <div className="actions end wide"><button className="btn primary">Create account</button></div>
      </form>
      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>College</th><th>Role</th><th>Action</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td><td>{u.email}</td><td>{u.college_code}</td>
                <td><span className={`pill ${u.role === 'admin' ? 'approved' : 'pending'}`}>{u.role}</span></td>
                <td><button className="btn danger small-btn" onClick={() => remove(u)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
