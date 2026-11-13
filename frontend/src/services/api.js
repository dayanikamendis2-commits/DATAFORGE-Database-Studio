const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
let sessionId = sessionStorage.getItem('dataforge_session') || '';
export function setSession(id) { sessionId = id || ''; if (id) sessionStorage.setItem('dataforge_session', id); else sessionStorage.removeItem('dataforge_session'); }
export function getSession() { return sessionId; }
export async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(sessionId ? { 'x-dataforge-session': sessionId } : {}), ...options.headers };
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}