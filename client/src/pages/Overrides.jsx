import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alert, StatusBadge } from '../components/ui.jsx';
import { fmtTime, prettyDate } from '../helpers.js';

export default function Overrides() {
  const [data, setData] = useState({ incoming: [], outgoing: [] });
  const [msg, setMsg] = useState(null);

  const load = () => api('/overrides').then(setData).catch((e) => setMsg({ type: 'error', text: e.message }));
  useEffect(() => { load(); }, []);

  const act = async (id, path, body, okText) => {
    try {
      await api(`/overrides/${id}/${path}`, { method: 'POST', body });
      setMsg({ type: 'success', text: okText });
      window.dispatchEvent(new Event('notifications-changed'));
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  return (
    <>
      <h2>Override Requests</h2>
      <p className="muted">Other faculty can ask for a slot you hold. The slot only changes hands if you approve.</p>
      <Alert msg={msg} onClose={() => setMsg(null)} />

      <div className="card">
        <h3>Requests for my reservations</h3>
        <table>
          <thead><tr><th>From</th><th>Room</th><th>Date &amp; time</th><th>Their section / subject</th><th>Their purpose</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {data.incoming.length === 0 && <tr><td colSpan={7} className="muted center">No incoming requests.</td></tr>}
            {data.incoming.map((o) => (
              <tr key={o.id}>
                <td>{o.requester_name}</td>
                <td>{o.room_name}</td>
                <td>{prettyDate(o.reservation_date)}<br />{fmtTime(o.start_time)}-{fmtTime(o.end_time)}</td>
                <td>{o.section || '-'}<br />{o.subject || '-'}<small className="muted"><br />Yours: {o.current_section || '-'} / {o.current_subject || '-'}</small></td>
                <td>{o.purpose}<small className="muted"><br />Your purpose: {o.current_purpose}</small></td>
                <td><StatusBadge status={o.status} /></td>
                <td className="row-actions">
                  {o.status === 'pending' && (<>
                    <button className="btn primary small-btn" onClick={() => act(o.id, 'respond', { decision: 'approved' }, 'Slot transferred to the requester.')}>Approve</button>
                    <button className="btn danger small-btn" onClick={() => act(o.id, 'respond', { decision: 'declined' }, 'Request rejected.')}>Reject</button>
                  </>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Requests I sent</h3>
        <table>
          <thead><tr><th>Current holder</th><th>Room</th><th>Date &amp; time</th><th>My section / subject</th><th>My purpose</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {data.outgoing.length === 0 && <tr><td colSpan={7} className="muted center">You have not sent any requests.</td></tr>}
            {data.outgoing.map((o) => (
              <tr key={o.id}>
                <td>{o.holder_name}</td>
                <td>{o.room_name}</td>
                <td>{prettyDate(o.reservation_date)}<br />{fmtTime(o.start_time)}-{fmtTime(o.end_time)}</td>
                <td>{o.section || '-'}<br />{o.subject || '-'}</td>
                <td>{o.purpose}</td>
                <td><StatusBadge status={o.status} /></td>
                <td className="row-actions">
                  {o.status === 'pending' && <button className="btn ghost small-btn" onClick={() => act(o.id, 'cancel', undefined, 'Request withdrawn.')}>Withdraw</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
