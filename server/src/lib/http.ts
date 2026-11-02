import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const isObjectId = (v: unknown): v is string =>
  typeof v === 'string' && mongoose.isValidObjectId(v);

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
  } else if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message });
  } else if (err instanceof ZodError) {
    res.status(400).json({ error: 'Invalid input', issues: err.issues });
  } else if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ error: err.message });
  } else if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: `Invalid ${err.path}` });
  } else if (err?.code === 11000) {
    res.status(409).json({ error: 'That already exists' });
  } else {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};
