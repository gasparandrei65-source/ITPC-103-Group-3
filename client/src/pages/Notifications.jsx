import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Notifications() {
  const [items, setItems] = useState([]);

  const load = () => api('/notifications').then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const markAll = async () => {
    await api('/notifications/read-all', { method: 'POST' });
    window.dispatchEvent(new Event('notifications-changed'));
    load();
  };

  return (
    <>
      <div className="table-head">
        <h2>Notifications</h2>
        <button className="btn" onClick={markAll}>Mark all as read</button>
      </div>
      <div className="card">
        {items.length === 0 && <p className="muted">You have no notifications.</p>}
        {items.map((n) => (
          <div key={n.id} className={`notice ${n.is_read ? '' : 'unread'}`}>
            <div>{n.message}<br /><small className="muted">{new Date(n.created_at.replace(' ', 'T')).toLocaleString()}</small></div>
            {n.link && <Link className="btn small-btn" to={n.link}>Open</Link>}
          </div>
        ))}
      </div>
    </>
  );
}
