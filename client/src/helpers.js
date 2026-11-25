export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const fmtTime = (t) => (t ? t.slice(0, 5) : '');

export const todayStr = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

// Hours from now until the slot starts (negative = already started)
export const hoursUntil = (date, time) =>
  (new Date(`${date}T${fmtTime(time)}:00`).getTime() - Date.now()) / 36e5;

export const prettyDate = (d) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
