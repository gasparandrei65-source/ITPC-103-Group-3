import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { Alert } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await login(email, password); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
    setBusy(false);
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark big">ZPPSU</div>
        <h1>Academic Room &amp; Timetable Management System</h1>
        <p className="muted">Zamboanga Peninsula Polytechnic State University - all colleges and departments</p>
        <Alert msg={msg} />
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn primary block" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
        <p className="muted small">Access is limited to authorized faculty staff and administrators.</p>
      </form>
    </div>
  );
}
