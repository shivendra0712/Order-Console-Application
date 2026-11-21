import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { config } from './config';
import { AppError } from './errors';
import { router } from './routes';

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', router);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      const fields = err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: fields[0]?.message ?? 'Invalid request.', details: { fields } },
      });
      return;
    }
    if (err instanceof AppError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
      return;
    }
    if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } });
      return;
    }
    // Mongoose schema validation (e.g. stock would go negative) or a bad id.
    if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
      return;
    }
    if (!config.isTest) console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on the server.' } });
  };
  app.use(errorHandler);

  return app;
}
