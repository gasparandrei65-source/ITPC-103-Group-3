import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { api } from '../api.js';

export default function Layout() {
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    const load = () => api('/notifications/unread-count').then((d) => setUnread(d.count)).catch(() => {});
    load();
    const t = setInterval(load, 15000); // simple polling keeps the badge fresh
    window.addEventListener('notifications-changed', load);
    return () => { clearInterval(t); window.removeEventListener('notifications-changed', load); };
  }, []);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">ZPPSU</span>
          <span>Campus Room &amp;<br />Timetable System</span>
        </div>
        <nav>
          <NavLink to="/" end>Availability</NavLink>
          <NavLink to="/reservations">{isAdmin ? 'Reservation Approvals' : 'My Reservations'}</NavLink>
          {!isAdmin && <NavLink to="/overrides">Override Requests</NavLink>}
          <NavLink to="/timetable">Timetable</NavLink>
          {isAdmin && <NavLink to="/rooms">Rooms</NavLink>}
          {isAdmin && <NavLink to="/colleges">Colleges</NavLink>}
          {isAdmin && <NavLink to="/users">Users</NavLink>}
          <NavLink to="/notifications">
            Notifications {unread > 0 && <span className="badge-count">{unread}</span>}
          </NavLink>
        </nav>
        <div className="sidebar-foot">
          <div className="who">
            <strong>{user.name}</strong>
            <small>{user.college_code} - {isAdmin ? 'Administrator' : 'Faculty Staff'}</small>
          </div>
          <button className="btn ghost" onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}
