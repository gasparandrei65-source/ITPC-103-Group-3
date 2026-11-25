import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import collegeRoutes from './routes/colleges.js';
import userRoutes from './routes/users.js';
import roomRoutes from './routes/rooms.js';
import timetableRoutes from './routes/timetable.js';
import availabilityRoutes from './routes/availability.js';
import reservationRoutes from './routes/reservations.js';
import overrideRoutes from './routes/overrides.js';
import notificationRoutes from './routes/notifications.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/colleges', collegeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/overrides', overrideRoutes);
app.use('/api/notifications', notificationRoutes);

// Central error handler (Express 5 forwards async errors here automatically)
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ message: err.message, ...err.extra });
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server' });
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
