import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../utils/errors.js';
import { createSession, removeSession } from '../services/sessionStore.js';
import { openDatabase, listTables, getTableSchema, getRows, insertRow, updateRow, deleteRow } from '../services/dbService.js';
import { requireSession } from '../middleware/requireSession.js';

const router = Router();
const connectSchema = z.object({
  dialect: z.enum(['postgres', 'mysql', 'sqlite']),
  uri: z.string().min(10).max(2048)
});
router.get('/health', (req, res) => res.json({ status: 'ok', service: 'DATAFORGE API' }));

router.post('/connect', asyncHandler(async (req, res) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError('Select a database type and provide a valid connection URI.');
  const connection = await openDatabase(parsed.data.uri, parsed.data.dialect);
  const sessionId = createSession({ dialect: parsed.data.dialect, connection });
  res.json({ success: true, sessionId, dialect: parsed.data.dialect, message: 'Database connection established.' });
}));
router.post('/disconnect', asyncHandler(async (req, res) => {
  const id = req.header('x-dataforge-session');
  if (id) await removeSession(id);
  res.json({ success: true });
}));

router.use(requireSession);
router.get('/schema/tables', asyncHandler(async (req, res) => {
  const { dialect, connection } = req.dbSession.connection;
  res.json({ tables: await listTables(connection, dialect) });
}));
router.get('/schema/tables/:name', asyncHandler(async (req, res) => {
  const { dialect, connection } = req.dbSession.connection;
  res.json(await getTableSchema(connection, dialect, req.params.name));
}));
router.get('/data/:table', asyncHandler(async (req, res) => {
  const { dialect, connection } = req.dbSession.connection;
  const schema = await getTableSchema(connection, dialect, req.params.table);
  const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1));
  const limit = Math.max(5, Math.min(100, Number(req.query.limit) || 20));
  const search = String(req.query.search || '').slice(0, 150);
  const sort = String(req.query.sort || '');
  const order = req.query.order === 'desc' ? 'desc' : 'asc';
  res.json({ schema, ...(await getRows(connection, dialect, req.params.table, schema, { page, limit, search, sort, order })) });
}));
router.post('/data/:table', asyncHandler(async (req, res) => {
  const { dialect, connection } = req.dbSession.connection;
  const schema = await getTableSchema(connection, dialect, req.params.table);
  await insertRow(connection, dialect, req.params.table, schema, req.body);
  res.status(201).json({ success: true, message: 'Record created.' });
}));
router.put('/data/:table/:id', asyncHandler(async (req, res) => {
  const { dialect, connection } = req.dbSession.connection;
  const schema = await getTableSchema(connection, dialect, req.params.table);
  await updateRow(connection, dialect, req.params.table, schema, req.params.id, req.body);
  res.json({ success: true, message: 'Record updated.' });
}));
router.delete('/data/:table/:id', asyncHandler(async (req, res) => {
  const { dialect, connection } = req.dbSession.connection;
  const schema = await getTableSchema(connection, dialect, req.params.table);
  await deleteRow(connection, dialect, req.params.table, schema, req.params.id);
  res.json({ success: true, message: 'Record deleted.' });
}));
export default router;