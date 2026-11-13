import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

const sessions = new Map();
const ttl = Math.max(5, env.sessionTtlMinutes) * 60 * 1000;

export function createSession(connection) {
  const id = randomUUID();
  sessions.set(id, { connection, createdAt: Date.now(), touchedAt: Date.now() });
  return id;
}
export function getSession(id) {
  const item = sessions.get(id);
  if (!item) return null;
  if (Date.now() - item.touchedAt > ttl) {
    item.connection.end?.().catch?.(() => {});
    item.connection.close?.().catch?.(() => {});
    sessions.delete(id);
    return null;
  }
  item.touchedAt = Date.now();
  return item;
}
export async function removeSession(id) {
  const item = sessions.get(id);
  if (!item) return;
  sessions.delete(id);
  try {
    if (item.connection.end) await item.connection.end();
    else if (item.connection.close) await item.connection.close();
  } catch { /* connection may already be closed */ }
}
setInterval(() => {
  for (const [id, item] of sessions) {
    if (Date.now() - item.touchedAt > ttl) removeSession(id);
  }
}, 60_000).unref();