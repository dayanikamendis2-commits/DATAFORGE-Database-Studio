import pg from 'pg';
import mysql from 'mysql2/promise';
import initSqlJs from 'sql.js';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { AppError } from '../utils/errors.js';
import { quoteIdentifier, assertAllowed } from '../utils/identifiers.js';

const { Pool } = pg;
const require = createRequire(import.meta.url);
let sqliteRuntime;

async function getSqliteRuntime() {
  if (!sqliteRuntime) {
    const wasmDirectory = path.dirname(require.resolve('sql.js'));
    sqliteRuntime = await initSqlJs({ locateFile: file => path.join(wasmDirectory, file) });
  }
  return sqliteRuntime;
}

function createSqliteConnection(db, filename) {
  const persist = () => {
    const directory = path.dirname(filename);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(filename, Buffer.from(db.export()));
  };
  return {
    async query(sql, params = []) {
      const normalized = sql.replace(/\$\d+/g, '?');
      let statement;
      try {
        statement = db.prepare(normalized);
        statement.bind(params);
        const columns = statement.getColumnNames();
        const rows = [];
        while (statement.step()) {
          if (columns.length) rows.push(statement.getAsObject());
        }
        if (!columns.length) persist();
        return columns.length ? { rows } : { rows: [], changes: db.getRowsModified() };
      } finally {
        statement?.free();
      }
    },
    close() { persist(); db.close(); }
  };
}

export async function openDatabase(uri, dialect) {
  if (typeof uri !== 'string' || uri.length > 2048) throw new AppError('Please provide a valid database URI.');
  let parsed;
  try { parsed = new URL(uri); } catch { throw new AppError('The connection URI is not valid.'); }
  const allowedProtocols = dialect === 'postgres' ? ['postgres:', 'postgresql:'] : dialect === 'mysql' ? ['mysql:'] : dialect === 'sqlite' ? ['sqlite:'] : [];
  if (!allowedProtocols.includes(parsed.protocol)) throw new AppError('The URI does not match the selected database type.');
  if (dialect !== 'sqlite' && (!parsed.hostname || !parsed.pathname || parsed.pathname === '/')) throw new AppError('The URI must include a host and database name.');
  if (dialect === 'sqlite') {
    let filename = decodeURIComponent(parsed.pathname || '');
    // URL parsing adds a leading slash to Windows drive paths: /C:/folder/db.sqlite.
    if (/^\/[A-Za-z]:\//.test(filename)) filename = filename.slice(1);
    if (!filename || filename === '/' || filename.includes('..')) throw new AppError('Provide a valid SQLite file path (for example sqlite:////absolute/path/database.db or sqlite:///C:/folder/database.db).');
    try {
      filename = path.resolve(filename);
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      const SQL = await getSqliteRuntime();
      const db = fs.existsSync(filename) ? new SQL.Database(fs.readFileSync(filename)) : new SQL.Database();
      const connection = createSqliteConnection(db, filename);
      await connection.query('PRAGMA foreign_keys = ON');
      // Persist an empty database immediately so the selected file exists on disk.
      if (!fs.existsSync(filename)) fs.writeFileSync(filename, Buffer.from(db.export()));
      return connection;
    } catch (error) { throw new AppError(`SQLite connection failed: ${safeDbMessage(error.message)}`, 400); }
  }
  let connection;
  try {
    if (dialect === 'postgres') {
      connection = new Pool({ connectionString: uri, max: 3, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, ssl: parsed.searchParams.get('sslmode') === 'require' ? { rejectUnauthorized: false } : undefined });
      await connection.query('SELECT 1');
    } else {
      connection = mysql.createPool({ uri, connectionLimit: 3, connectTimeout: 10000, enableKeepAlive: true });
      await connection.query('SELECT 1');
    }
    return connection;
  } catch (error) {
    if (connection) {
      try { await (connection.end ? connection.end() : connection.close()); } catch {}
    }
    throw new AppError(`Database connection failed: ${safeDbMessage(error.message)}`, 400);
  }
}
function safeDbMessage(message = '') {
  return String(message).replace(/(password|pwd)=([^\\s&]+)/ig, '$1=[hidden]').slice(0, 220);
}
export async function listTables(connection, dialect) {
  if (dialect === 'sqlite') { const { rows } = await connection.query("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name"); return rows.map(r => ({ name: r.name, type: r.type === 'view' ? 'VIEW' : 'TABLE' })); }
  if (dialect === 'postgres') {
    const { rows } = await connection.query(
      `SELECT table_name AS name, table_type AS type FROM information_schema.tables WHERE table_schema = current_schema() AND table_type IN ('BASE TABLE','VIEW') ORDER BY table_name`
    );
    return rows.map(r => ({ name: r.name, type: r.type === 'VIEW' ? 'VIEW' : 'TABLE' }));
  }
  const [rows] = await connection.query(
    `SELECT TABLE_NAME AS name, TABLE_TYPE AS type FROM information_schema.tables WHERE table_schema = DATABASE() AND TABLE_TYPE IN ('BASE TABLE','VIEW') ORDER BY TABLE_NAME`
  );
  return rows.map(r => ({ name: r.name, type: r.type }));
}
export async function getTableSchema(connection, dialect, tableName) {
  const tables = await listTables(connection, dialect);
  assertAllowed(tableName, tables.map(t => t.name), 'table');
  let columns, keys;
  if (dialect === 'sqlite') {
    ({ rows: columns } = await connection.query(`PRAGMA table_info(${quoteIdentifier(tableName, dialect)})`));
    ({ rows: keys } = await connection.query(`PRAGMA foreign_key_list(${quoteIdentifier(tableName, dialect)})`));
    columns = columns.map(c => ({ name: c.name, data_type: c.type || 'TEXT', udt_name: c.type || 'TEXT', is_nullable: c.notnull ? 'NO' : 'YES', column_default: c.dflt_value, ordinal_position: c.cid, primary_key: c.pk }));
    keys = [...columns.filter(c => c.primary_key).map(c => ({ column_name: c.name, constraint_type: 'PRIMARY KEY' })), ...keys.map(k => ({ column_name: columns.find(c => c.ordinal_position === k.from)?.name || k.from, constraint_type: 'FOREIGN KEY', foreign_table: k.table, foreign_column: k.to }))];
  } else if (dialect === 'postgres') {
    ({ rows: columns } = await connection.query(
      `SELECT c.column_name AS name, c.data_type AS data_type, c.udt_name AS udt_name, c.is_nullable AS is_nullable, c.column_default AS column_default, c.ordinal_position AS ordinal_position
       FROM information_schema.columns c WHERE c.table_schema = current_schema() AND c.table_name = $1 ORDER BY c.ordinal_position`, [tableName]));
    ({ rows: keys } = await connection.query(
      `SELECT kcu.column_name, tc.constraint_type, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
       FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
       WHERE tc.table_schema = current_schema() AND tc.table_name = $1`, [tableName]));
  } else {
    ([columns] = await connection.query(
      `SELECT COLUMN_NAME AS name, DATA_TYPE AS data_type, COLUMN_TYPE AS udt_name, IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default, ORDINAL_POSITION AS ordinal_position, EXTRA AS extra
       FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ORDINAL_POSITION`, [tableName]));
    ([keys] = await connection.query(
      `SELECT k.COLUMN_NAME AS column_name, tc.CONSTRAINT_TYPE AS constraint_type, k.REFERENCED_TABLE_NAME AS foreign_table, k.REFERENCED_COLUMN_NAME AS foreign_column
       FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.TABLE_CONSTRAINTS tc
       ON k.CONSTRAINT_NAME = tc.CONSTRAINT_NAME AND k.TABLE_SCHEMA = tc.TABLE_SCHEMA AND k.TABLE_NAME = tc.TABLE_NAME
       WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = ?`, [tableName]));
  }
  const primaryKeys = keys.filter(k => k.constraint_type === 'PRIMARY KEY').map(k => k.column_name);
  const foreignKeys = keys.filter(k => k.constraint_type === 'FOREIGN KEY').map(k => ({ column: k.column_name, table: k.foreign_table, referencedColumn: k.foreign_column }));
  return {
    name: tableName, type: tables.find(t => t.name === tableName)?.type || 'TABLE',
    columns: columns.map(c => ({
      name: c.name, dataType: c.data_type, nativeType: c.udt_name,
      nullable: c.is_nullable === 'YES', defaultValue: c.column_default,
      primaryKey: primaryKeys.includes(c.name) || Boolean(c.primary_key), foreignKey: foreignKeys.find(f => f.column === c.name) || null,
      generated: Boolean(c.extra?.includes('auto_increment')) || (dialect === 'sqlite' && Boolean(c.primary_key) && /INT/i.test(c.udt_name || '')) || String(c.column_default || '').includes('nextval(')
    })),
    primaryKeys, foreignKeys, editable: primaryKeys.length === 1 && tables.find(t => t.name === tableName)?.type !== 'VIEW'
  };
}
function isSearchable(type = '') {
  return !['bytea', 'blob', 'longblob', 'mediumblob', 'tinyblob', 'json', 'jsonb'].includes(type.toLowerCase());
}
export async function getRows(connection, dialect, tableName, schema, opts) {
  const { page, limit, search, sort, order } = opts;
  const table = quoteIdentifier(tableName, dialect);
  const conditions = [];
  const values = [];
  const searchable = schema.columns.filter(c => isSearchable(c.dataType) && !['boolean'].includes(c.dataType));
  if (search && searchable.length) {
    if (dialect === 'postgres' || dialect === 'sqlite') {
      const clauses = searchable.map(c => {
        values.push(`%${search}%`);
        return `CAST(${quoteIdentifier(c.name, dialect)} AS TEXT) ${dialect === 'postgres' ? 'ILIKE' : 'LIKE'} $${values.length}`;
      });
      conditions.push(`(${clauses.join(' OR ')})`);
    } else {
      const clauses = searchable.map(c => {
        values.push(`%${search}%`);
        return `CAST(${quoteIdentifier(c.name, dialect)} AS CHAR) LIKE ?`;
      });
      conditions.push(`(${clauses.join(' OR ')})`);
    }
  }
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  const countSql = `SELECT COUNT(*) AS total FROM ${table}${where}`;
  const countResult = dialect === 'postgres' || dialect === 'sqlite'
    ? (await connection.query(countSql, values)).rows[0]
    : (await connection.query(countSql, values))[0][0];
  const total = Number(countResult.total);
  const safeSort = schema.columns.some(c => c.name === sort) ? sort : schema.columns[0]?.name;
  const orderSql = safeSort ? ` ORDER BY ${quoteIdentifier(safeSort, dialect)} ${order === 'desc' ? 'DESC' : 'ASC'}` : '';
  const offset = (page - 1) * limit;
  let rows;
  if (dialect === 'postgres' || dialect === 'sqlite') {
    rows = (await connection.query(`SELECT * FROM ${table}${where}${orderSql} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, offset])).rows;
  } else {
    [rows] = await connection.query(`SELECT * FROM ${table}${where}${orderSql} LIMIT ? OFFSET ?`, [...values, limit, offset]);
  }
  return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
function normalizeValue(value, column) {
  if (value === '' && column.nullable) return null;
  if (value === undefined) return undefined;
  return value;
}
export async function insertRow(connection, dialect, tableName, schema, body) {
  if (!schema.editable) throw new AppError('This table does not have a single primary key and is read-only in this version.', 400);
  const allowed = schema.columns.filter(c => !c.generated).map(c => c.name);
  const entries = Object.entries(body || {}).filter(([key, value]) => allowed.includes(key) && value !== undefined);
  if (!entries.length) throw new AppError('Enter at least one field value.');
  const names = entries.map(([key]) => quoteIdentifier(key, dialect));
  const vals = entries.map(([key, value]) => normalizeValue(value, schema.columns.find(c => c.name === key)));
  const placeholders = entries.map((_, i) => dialect === 'postgres' ? `$${i + 1}` : '?');
  const sql = `INSERT INTO ${quoteIdentifier(tableName, dialect)} (${names.join(', ')}) VALUES (${placeholders.join(', ')})`;
  if (dialect === 'postgres') await connection.query(sql, vals);
  else await connection.query(sql, vals);
}
export async function updateRow(connection, dialect, tableName, schema, id, body) {
  if (!schema.editable) throw new AppError('This table is read-only in this version.', 400);
  const pk = schema.primaryKeys[0];
  const entries = Object.entries(body || {}).filter(([key, value]) => schema.columns.some(c => c.name === key && !c.primaryKey && !c.generated) && value !== undefined);
  if (!entries.length) throw new AppError('No editable values were provided.');
  const vals = entries.map(([key, value]) => normalizeValue(value, schema.columns.find(c => c.name === key)));
  const sets = entries.map(([key], i) => `${quoteIdentifier(key, dialect)} = ${dialect === 'postgres' ? `$${i + 1}` : '?'}`);
  vals.push(id);
  const whereParam = dialect === 'postgres' ? `$${vals.length}` : '?';
  await connection.query(`UPDATE ${quoteIdentifier(tableName, dialect)} SET ${sets.join(', ')} WHERE ${quoteIdentifier(pk, dialect)} = ${whereParam}`, vals);
}
export async function deleteRow(connection, dialect, tableName, schema, id) {
  if (!schema.editable) throw new AppError('This table is read-only in this version.', 400);
  const pk = schema.primaryKeys[0];
  const sql = `DELETE FROM ${quoteIdentifier(tableName, dialect)} WHERE ${quoteIdentifier(pk, dialect)} = ${dialect === 'postgres' ? '$1' : '?'}`;
  await connection.query(sql, [id]);
}