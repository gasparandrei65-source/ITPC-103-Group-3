import 'dotenv/config';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-secret';

export const signToken = (u) =>
  jwt.sign({ id: u.id, name: u.name, role: u.role, college_id: u.college_id }, SECRET, { expiresIn: '8h' });

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Please log in first' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Session expired, please log in again' });
  }
}

export const requireAdmin = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ message: 'Administrator access only' });

export const requireFaculty = (req, res, next) =>
  req.user.role === 'faculty' ? next() : res.status(403).json({ message: 'Only faculty staff can do this' });
