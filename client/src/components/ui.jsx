export function Alert({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div className={`alert ${msg.type || 'info'}`}>
      <span>{msg.text}</span>
      {msg.action}
      {onClose && <button className="x" onClick={onClose} aria-label="Close">×</button>}
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className={`pill ${status}`}>{status}</span>;
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}
