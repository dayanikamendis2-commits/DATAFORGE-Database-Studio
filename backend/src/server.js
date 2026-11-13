import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import api from './routes/api.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: env.clientOrigin.split(',').map(v => v.trim()), methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','x-dataforge-session'] }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api', api);
app.use((req, res) => res.status(404).json({ message: 'API route not found.' }));
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (env.nodeEnv !== 'production') console.error(err);
  res.status(status).json({ message: status === 500 ? 'An unexpected server error occurred.' : err.message });
});
app.listen(env.port, () => console.log(`DATAFORGE API running on http://localhost:${env.port}`));