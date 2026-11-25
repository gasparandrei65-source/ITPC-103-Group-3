import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Reservations from './pages/Reservations.jsx';
import Overrides from './pages/Overrides.jsx';
import Rooms from './pages/Rooms.jsx';
import Timetable from './pages/Timetable.jsx';
import Colleges from './pages/Colleges.jsx';
import Users from './pages/Users.jsx';
import Notifications from './pages/Notifications.jsx';

function Protected({ adminOnly, facultyOnly, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  if (facultyOnly && user.role !== 'faculty') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/reservations" element={<Reservations />} />
        <Route path="/overrides" element={<Protected facultyOnly><Overrides /></Protected>} />
        <Route path="/timetable" element={<Timetable />} />
        <Route path="/rooms" element={<Protected adminOnly><Rooms /></Protected>} />
        <Route path="/colleges" element={<Protected adminOnly><Colleges /></Protected>} />
        <Route path="/users" element={<Protected adminOnly><Users /></Protected>} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
