<<<<<<< HEAD
# DATAFORGE
**Zero-Code Visual Dynamic Database Admin & Form Generator Studio**

A full-stack starter implementation based on the supplied WhiteCoder Internship 2026 proposal.

## Features
- Connect to PostgreSQL, MySQL or SQLite using a database URI.
- Connection credentials are kept in backend memory only (not written to disk).
- Discover tables, columns, primary keys, foreign keys and SQL data types.
- Dynamic table grid with search, sorting and pagination.
- Type-aware create/edit forms.
- Insert, update and delete records using parameterized values.
- Session expiry and explicit disconnect.
- Identifier allow-listing based on discovered schema metadata.

## Requirements
- Node.js 20+ (Node.js 22 LTS is recommended for broad native-driver compatibility; SQLite uses the WebAssembly-based `sql.js` package and does not require Visual Studio C++ build tools).
- npm
- A reachable PostgreSQL or MySQL database, or a writable local folder for SQLite files
- The database user should have only the permissions required for the intended work.

## Run locally
1. Open this folder in VS Code.
2. Install root and app dependencies:
   ```bash
   npm run install:all
   ```
3. Copy `backend/.env.example` to `backend/.env` and adjust the values if needed.
4. Start both applications:
   ```bash
   npm run dev
   ```
5. Open http://localhost:5173

Backend API: http://localhost:5000/api/health

## Windows installation troubleshooting

If npm reports `EPERM` while cleaning `node_modules`, close running DATAFORGE terminals and VS Code processes that may be using the project, then open a fresh PowerShell window in the project root and run:

```powershell
Remove-Item -Recurse -Force .\node_modules, .\backend\node_modules, .\frontend\node_modules -ErrorAction SilentlyContinue
npm run install:all
npm run dev
```

The SQLite adapter uses `sql.js` (WebAssembly), not `better-sqlite3`, so installation does not need Visual Studio C++ build tools. If Windows still reports `EPERM`, restart the terminal (or Windows) and retry before running the install command.

## Connect
Choose PostgreSQL, MySQL or SQLite, paste a connection URI, then click **Test & Connect**.
Examples (replace placeholders):
- PostgreSQL: `postgresql://username:password@localhost:5432/database_name`
- MySQL: `mysql://username:password@localhost:3306/database_name`
- SQLite (Windows): `sqlite:///C:/Projects/dataforge/sample.db`
- SQLite (Linux/macOS): `sqlite:////absolute/path/to/sample.db`

Use a dedicated, non-production database account. Do not paste production administrator credentials into an untrusted deployment.

## Important security notes
- This is an internship/demo-grade implementation, not a hardened public multi-tenant database gateway.
- Connection URIs are held in process memory and disappear when the backend restarts. A session ID is returned to the browser and stored in `sessionStorage`.
- Do not expose the backend publicly without adding authentication, rate limiting, TLS, CSRF protections, strict origin controls, audit logging and stronger session management.
- A user with a connection URI can perform operations allowed by that database account. Use a least-privilege database account and preferably a disposable test database.
- SQL values are parameterized. Table and column identifiers cannot be parameterized, so they are checked against the schema metadata allow-list and safely quoted.
- The in-memory session store is not shared across multiple Render instances and is not suitable for horizontally scaled deployment without a shared secure session store.
- The app does not save database credentials to localStorage, files or a persistent database.

## Supported scope
PostgreSQL and MySQL tables. Views are displayed as read-only where primary-key metadata is unavailable. Composite primary keys are currently treated as read-only for row editing/deletion. Foreign key metadata is displayed; FK selector widgets are a future enhancement.

## Deployment
- Frontend: deploy `frontend` to Vercel. Set `VITE_API_URL` to your deployed backend URL (for example `https://your-api.onrender.com/api`).
- Backend: deploy `backend` to Render. Set `PORT`, `CLIENT_ORIGIN` and `SESSION_TTL_MINUTES`.
- Ensure the database is network-accessible from the backend host. Free hosting plans may sleep or have networking limitations.
- Never commit `.env` files.

## Main API
- `POST /api/connect`
- `POST /api/disconnect`
- `GET /api/schema/tables`
- `GET /api/schema/tables/:name`
- `GET /api/data/:table?page=1&limit=20&search=...&sort=column&order=asc`
- `POST /api/data/:table`
- `PUT /api/data/:table/:id`
- `DELETE /api/data/:table/:id`

## Project structure
```text
DATAFORGE/
  backend/
    src/
      config/
      middleware/
      routes/
      services/
      utils/
      server.js
  frontend/
    src/
      components/
      pages/
      services/
      App.jsx
      main.jsx
      styles.css
```


## DATAFORGE Studio updates

- Responsive workspace layout for desktop, tablet and mobile screens.
- Persistent light/dark appearance preference (stored in the browser).
- Updated themed Edit and Delete actions.
- Activity History in the sidebar records connection, disconnect, table navigation and record create/update/delete events locally in the browser (up to 100 entries). It is activity history, not authenticated login/audit history.
- Database engines: PostgreSQL, MySQL and SQLite. SQLite is a local file connection and must be accessible to the backend host.

### SQLite connection

Use a URI such as `sqlite:////absolute/path/to/database.db` (Linux/macOS) or the equivalent absolute path URI for the backend host. SQLite runs through `sql.js` (WebAssembly), so it does not require native compilation or Visual Studio C++ build tools. The backend creates a database file if the path does not already exist; make sure its parent folder is writable. SQLite is intended for local files accessible to the backend process.

### Database support scope

DATAFORGE uses database-specific drivers and schema adapters. It cannot connect to literally every database automatically; each additional engine (for example SQL Server, Oracle, MongoDB or cloud warehouses) requires a compatible driver, authentication handling and schema/query adapter.
=======
# DATAFORGE-Database-Studio
A Modern Database Management Studio for MySQL, PostgreSQL and SQLite.
>>>>>>> origin/main
