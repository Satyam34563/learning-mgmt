import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { config } from './config.js';
import { loadUser, viewGate } from './middleware/auth.js';
import { errorHandler } from './lib/http.js';
import { authRouter, usersRouter } from './routes/auth.js';
import { classesRouter, subjectsRouter, chaptersRouter, teachersRouter } from './routes/taxonomy.js';
import lecturesRouter from './routes/lectures.js';
import statsRouter from './routes/stats.js';
import meRouter from './routes/me.js';
import uploadsRouter from './routes/uploads.js';
import importRouter from './routes/import.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(morgan(config.isProd ? 'combined' : 'dev'));
  app.use(loadUser);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/me', meRouter);
  app.use('/api/classes', viewGate, classesRouter);
  app.use('/api/subjects', viewGate, subjectsRouter);
  app.use('/api/chapters', viewGate, chaptersRouter);
  app.use('/api/teachers', viewGate, teachersRouter);
  app.use('/api/lectures', viewGate, lecturesRouter);
  app.use('/api/stats', viewGate, statsRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/import', importRouter);

  // Uploaded attachments. Random file names, so long caching is safe.
  app.use('/uploads', viewGate, express.static(config.uploadDir, { maxAge: '30d', index: false }));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);
  return app;
}
