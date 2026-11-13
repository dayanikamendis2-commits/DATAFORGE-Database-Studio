import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: Number(process.env.PORT || 5000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  sessionTtlMinutes: Number(process.env.SESSION_TTL_MINUTES || 30),
  nodeEnv: process.env.NODE_ENV || 'development'
};