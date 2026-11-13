import { getSession } from '../services/sessionStore.js';
import { AppError } from '../utils/errors.js';

export function requireSession(req, res, next) {
  const id = req.header('x-dataforge-session');
  const session = id && getSession(id);
  if (!session) return next(new AppError('Database session expired or disconnected. Please connect again.', 401));
  req.dbSession = session;
  next();
}