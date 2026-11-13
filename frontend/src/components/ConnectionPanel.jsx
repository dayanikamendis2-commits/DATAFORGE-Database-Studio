import { useState } from 'react';
import { Database, ShieldCheck, PlugZap } from 'lucide-react';
import { request, setSession } from '../services/api';
export default function ConnectionPanel({ onConnected }) {
  const [dialect, setDialect] = useState('postgres');
  const [uri, setUri] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function connect(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const result = await request('/connect', { method: 'POST', body: JSON.stringify({ dialect, uri }) });
      setSession(result.sessionId); setUri(''); onConnected(result);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="connect-card">
    <div className="connect-icon"><Database size={25}/></div>
    <span className="eyebrow">NEW CONNECTION</span>
    <h2>Connect your database</h2>
    <p className="muted">Connect PostgreSQL, MySQL or a local SQLite database to inspect schemas and manage records visually.</p>
    <form onSubmit={connect} className="connect-form">
      <label>Database engine</label>
      <div className="engine-switch">
        <button type="button" className={dialect === 'postgres' ? 'engine active' : 'engine'} onClick={() => setDialect('postgres')}>PostgreSQL</button>
        <button type="button" className={dialect === 'mysql' ? 'engine active' : 'engine'} onClick={() => setDialect('mysql')}>MySQL</button>
        <button type="button" className={dialect === 'sqlite' ? 'engine active' : 'engine'} onClick={() => setDialect('sqlite')}>SQLite</button>
      </div>
      <label htmlFor="db-uri">Connection URI</label>
      <input id="db-uri" type="password" autoComplete="off" value={uri} onChange={e => setUri(e.target.value)} placeholder={dialect === 'postgres' ? 'postgresql://user:password@host:5432/database' : dialect === 'mysql' ? 'mysql://user:password@host:3306/database' : 'sqlite:///absolute/path/to/database.db'} required/>
      <div className="secure-note"><ShieldCheck size={16}/> Credentials are kept in backend memory for this session only.</div>
      {error && <div className="alert error">{error}</div>}
      <button className="primary-btn full" disabled={busy || !uri.trim()}>{busy ? 'Connecting…' : <><PlugZap size={17}/> Test & Connect</>}</button>
    </form>
  </div>;
}