import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, ChevronsUpDown, CirclePlus, Database, FilePlus2, Layers3, LogOut, RefreshCw, Search, ShieldCheck, Table2, Trash2, Pencil, PanelLeftClose, PanelLeftOpen, History, Sun, Moon, Clock3, ArrowLeft, PlugZap } from 'lucide-react';
import { getSession, request, setSession } from '../services/api';
import ConnectionPanel from '../components/ConnectionPanel';
import DynamicForm from '../components/DynamicForm';
function formatValue(value) {
  if (value === null || value === undefined) return <span className="null-value">NULL</span>;
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  return String(value);
}
export default function Workspace() {
  const [connected, setConnected] = useState(Boolean(getSession()));
  const [dialect, setDialect] = useState('');
  const [tables, setTables] = useState([]);
  const [active, setActive] = useState('');
  const [data, setData] = useState({ rows: [], total: 0, page: 1, totalPages: 1, schema: null });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('');
  const [order, setOrder] = useState('asc');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast] = useState('');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dataforge-theme') === 'dark');
  const [activeView, setActiveView] = useState('explorer');
  const [history, setHistory] = useState(() => { try { return JSON.parse(localStorage.getItem('dataforge-history') || '[]'); } catch { return []; } });
  function addHistory(action, detail) { setHistory(old => { const next = [{ id: Date.now(), action, detail, at: new Date().toISOString() }, ...old].slice(0, 100); localStorage.setItem('dataforge-history', JSON.stringify(next)); return next; }); }
  async function loadTables() {
    const result = await request('/schema/tables'); setTables(result.tables);
    if (!active && result.tables.length) setActive(result.tables[0].name);
  }
  async function loadRows(table = active, nextPage = page, q = search, s = sort, o = order) {
    if (!table) return;
    setBusy(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(nextPage), limit: '15', search: q, sort: s, order: o });
      const result = await request(`/data/${encodeURIComponent(table)}?${params}`);
      setData(result);
    } catch (err) { setError(err.message); if (err.message.toLowerCase().includes('session')) setConnected(false); }
    finally { setBusy(false); }
  }
  useEffect(() => { document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'; localStorage.setItem('dataforge-theme', darkMode ? 'dark' : 'light'); }, [darkMode]);
  useEffect(() => {
    if (!connected) return;
    loadTables().catch(err => { setError(err.message); setConnected(false); });
  }, [connected]);
  useEffect(() => { if (connected && active) loadRows(active, page, search, sort, order); }, [connected, active, page, search, sort, order]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 2800); return () => clearTimeout(timer); }, [toast]);
  async function disconnect() {
    try { await request('/disconnect', { method: 'POST' }); } catch {}
    addHistory('Disconnected', `${dialect || 'Database'} session closed`); setSession(''); setConnected(false); setTables([]); setActive(''); setData({ rows: [], total: 0, page: 1, totalPages: 1, schema: null }); setDialect('');
  }
  function saved() { addHistory(form?.record ? 'Record updated' : 'Record created', `${active} · ${form?.record ? 'Updated existing row' : 'New row added'}`); setForm(null); setToast('Record saved successfully'); loadRows(); }
  async function remove(row) {
    const pk = data.schema?.primaryKeys?.[0];
    if (!pk || !window.confirm(`Delete this record (${row[pk]})? This action cannot be undone.`)) return;
    try { await request(`/data/${encodeURIComponent(active)}/${encodeURIComponent(row[pk])}`, { method: 'DELETE' }); addHistory('Record deleted', `${active} · ${pk}: ${row[pk]}`); setToast('Record deleted'); loadRows(); }
    catch (err) { setError(err.message); }
  }
  const columns = data.schema?.columns || [];
  const canEdit = data.schema?.editable;
  const stats = useMemo(() => ({ tables: tables.length, rows: data.total, columns: columns.length }), [tables, data.total, columns.length]);
  if (!connected) return <main className="connect-screen"><div className="brand top-brand"><div className="brand-mark">D</div><div><b>DATAFORGE</b><small>DATABASE STUDIO</small></div></div><ConnectionPanel onConnected={r => { setDialect(r.dialect); setConnected(true); addHistory('Connected', `${r.dialect} database session established`); }}/><p className="bottom-caption">A visual workspace for relational data · PostgreSQL & MySQL</p></main>;
  return <div className={`app-shell ${darkMode ? 'theme-dark' : 'theme-light'}`}>
    <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
      <div className="brand"><div className="brand-mark">D</div>{sidebarOpen && <div><b>DATAFORGE</b><small>DATABASE STUDIO</small></div>}</div>
      <div className="side-label">{sidebarOpen ? 'WORKSPACE' : ' '}</div>
      <button className={`side-link ${activeView === 'explorer' ? 'active' : ''}`} onClick={() => setActiveView('explorer')}><Layers3 size={17}/>{sidebarOpen && 'Data explorer'}</button>
      <button className={`side-link ${activeView === 'history' ? 'active' : ''}`} onClick={() => setActiveView('history')}><History size={17}/>{sidebarOpen && 'History'}{sidebarOpen && history.length > 0 && <span className="nav-count">{history.length}</span>}</button>
      <button className="side-link" onClick={() => loadTables()}><RefreshCw size={17}/>{sidebarOpen && 'Refresh schema'}</button>
      <div className="side-label table-label">{sidebarOpen ? `TABLES · ${tables.length}` : ''}</div>
      <div className="table-nav">{tables.map(t => <button key={t.name} title={t.name} className={`table-link ${active === t.name ? 'selected' : ''}`} onClick={() => { setActive(t.name); setPage(1); setActiveView('explorer'); addHistory('Opened table', t.name); }}><Table2 size={15}/>{sidebarOpen && <><span>{t.name}</span><small>{t.type === 'VIEW' ? 'VIEW' : ''}</small></>}</button>)}</div>
      <div className="sidebar-bottom"><button className="side-link theme-switch" onClick={() => setDarkMode(v => !v)}>{darkMode ? <Sun size={17}/> : <Moon size={17}/ >}{sidebarOpen && (darkMode ? 'Light appearance' : 'Dark appearance')}</button><div className="connection-state"><span className="status-dot"/>{sidebarOpen && <span>Connected · {dialect || 'Database'}</span>}</div><button className="side-link" onClick={() => setSidebarOpen(v => !v)}>{sidebarOpen ? <PanelLeftClose size={17}/> : <PanelLeftOpen size={17}/ >}{sidebarOpen && 'Collapse sidebar'}</button><button className="side-link disconnect" onClick={disconnect}><LogOut size={17}/>{sidebarOpen && 'Disconnect'}</button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><span className="eyebrow">DATABASE WORKSPACE</span><h1>{activeView === 'history' ? 'Activity history' : (active || 'Data explorer')}</h1></div><div className="top-actions"><div className="secure-pill"><ShieldCheck size={15}/> Session secured</div>{activeView === 'explorer' && <><button className="icon-btn" title="Refresh data" onClick={() => loadRows()}><RefreshCw size={17}/></button><button className="primary-btn" onClick={() => setForm({ record: null })} disabled={!canEdit}><CirclePlus size={17}/> Add record</button></>}</div></header>
      <section className="content">
        {activeView === 'history' ? <div className="history-panel panel"><div className="panel-toolbar"><div><h2><Clock3 size={19}/> Recent activity</h2><p className="muted">Connection and data changes on this device</p></div><button className="secondary-btn" onClick={() => { setHistory([]); localStorage.removeItem('dataforge-history'); }}>Clear history</button></div>{history.length ? <div className="history-list">{history.map(item => <div className="history-item" key={item.id}><span className="history-icon"><Activity size={16}/></span><div className="history-copy"><b>{item.action}</b><small>{item.detail}</small></div><time>{new Date(item.at).toLocaleString()}</time></div>)}</div> : <div className="empty-state"><History size={32}/><h3>No activity yet</h3><p>Your recent database actions will appear here.</p></div>}</div> : <>
        <div className="stat-row">
          <div className="stat-card"><span><Database size={17}/> TABLES</span><strong>{stats.tables}</strong><small>Discovered in database</small></div>
          <div className="stat-card"><span><Activity size={17}/> MATCHING RECORDS</span><strong>{stats.rows.toLocaleString()}</strong><small>In selected table</small></div>
          <div className="stat-card"><span><Layers3 size={17}/> COLUMNS</span><strong>{stats.columns}</strong><small>Detected in this table</small></div>
        </div>
        <div className="panel">
          <div className="panel-toolbar"><div><h2><Table2 size={19}/> Data grid</h2><p className="muted">{active ? `Browsing ${active}` : 'Choose a table to begin'}</p></div><div className="toolbar-actions"><div className="search-box"><Search size={16}/><input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search records…"/></div><button className="secondary-btn" onClick={() => loadRows()}><RefreshCw size={15}/> Refresh</button></div></div>
          {error && <div className="alert error inline-alert">{error}</div>}
          {!tables.length ? <div className="empty-state"><Database size={32}/><h3>No tables found</h3><p>This database has no tables in its default schema.</p></div> :
          <div className="grid-wrap">
            {busy && <div className="loading-line"/>}
            <table className="data-grid"><thead><tr>{columns.map(c => <th key={c.name}><button className="sort-button" onClick={() => { const next = sort === c.name && order === 'asc' ? 'desc' : 'asc'; setSort(c.name); setOrder(next); }}><span>{c.name}</span><ChevronsUpDown size={13}/></button><small>{c.dataType}</small></th>)}{canEdit && <th className="actions-head">ACTIONS</th>}</tr></thead>
              <tbody>{data.rows.map((row, i) => <tr key={data.schema?.primaryKeys?.map(k => row[k]).join('-') || i}>{columns.map(c => <td key={c.name}><span className="cell-value" title={String(row[c.name] ?? '')}>{formatValue(row[c.name])}</span></td>)}{canEdit && <td><div className="row-actions"><button className="action-btn edit-action" title="Edit record" onClick={() => setForm({ record: row })}><Pencil size={13}/><span>Edit</span></button><button className="action-btn delete-action" title="Delete record" onClick={() => remove(row)}><Trash2 size={13}/><span>Delete</span></button></div></td>}</tr>)}</tbody>
            </table>
            {!data.rows.length && <div className="empty-state"><FilePlus2 size={30}/><h3>No records found</h3><p>Try another search or add a new record.</p></div>}
          </div>}
          <div className="pagination"><span>Showing {data.rows.length ? (page - 1) * 15 + 1 : 0}–{Math.min(page * 15, data.total)} of {data.total.toLocaleString()} records</span><div><button className="icon-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={17}/></button><span className="page-count">Page {page} of {data.totalPages}</span><button className="icon-btn" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={17}/></button></div></div>
        </div>
        <div className="schema-panel"><div><h3>Schema overview</h3><p className="muted">Detected table structure and constraints</p></div><div className="schema-chips">{columns.map(c => <span key={c.name} className="schema-chip"><b>{c.name}</b><small>{c.dataType}{c.primaryKey ? ' · PK' : ''}{c.foreignKey ? ' · FK' : ''}</small></span>)}</div></div>
        <footer className="workspace-footer"><span>DATAFORGE · VISUAL DATABASE STUDIO</span><span><span className="status-dot"/> Live session</span></footer>
        </>}
      </section>
    </main>
    {form && data.schema && <DynamicForm table={active} schema={data.schema} record={form.record} onClose={() => setForm(null)} onSaved={saved}/>}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}