import { AppError } from './errors.js';

export function quoteIdentifier(value, dialect) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_$-]+$/.test(value)) {
    throw new AppError('Invalid database identifier.', 400);
  }
  const q = dialect === 'mysql' ? '`' : '"';
  return `${q}${value.replaceAll(q, q + q)}${q}`;
}
export function assertAllowed(value, allowed, label = 'identifier') {
  if (!allowed.includes(value)) throw new AppError(`Unknown ${label}.`, 404);
  return value;
}