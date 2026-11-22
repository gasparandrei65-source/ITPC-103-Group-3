require('dotenv').config();
process.env.TZ = process.env.TZ || 'Asia/Manila';   // keep cut-off math in local campus time

const path = require('path');
const express = require('express');
const { pool } = require('./src/db');
const { HttpError } = require('./src/util');

const app = express();
app.use(express.json({ limit: '100kb' }));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/public', require('./src/routes/public'));
app.use('/api/reservations', require('./src/routes/reservations'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.use(express.static(path.join(__dirname, 'public')));

// Friendly message if the React app hasn't been built yet.
app.use((req, res, next) => {
  if (req.method === 'GET' && !require('fs').existsSync(path.join(__dirname, 'public', 'index.html'))) {
    return res.status(503).type('text').send('The React frontend has not been built yet.\nStop the server and run:  npm run build   then   npm start');
  }
  next();
});

app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body.' });
  if (err.errno === 1451) return res.status(409).json({ error: 'This record is still in use (for example it has reservations). Deactivate or close it instead of deleting it.' });
  if (err.errno === 1062) return res.status(409).json({ error: 'That value already exists. Use a different one.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

(async () => {
  try {
    await pool.query('SELECT 1 FROM settings LIMIT 1');
  } catch (e) {
    console.error('\nCannot reach the database: ' + e.message);
    console.error('1) Make sure MySQL is running.  2) Check DB_* values in .env.  3) Run "npm run setup" once.\n');
    process.exit(1);
  }
  app.listen(PORT, HOST, () => console.log(`\nCICS Room & Timetable System running at http://localhost:${PORT}\n`));
})();
