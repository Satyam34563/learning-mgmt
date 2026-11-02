import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from '../config.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError } from '../lib/http.js';

/**
 * Attachment storage on local disk (UPLOAD_DIR, a Docker volume in prod).
 * Files are served at /uploads/<yyyy-mm>/<random>.<ext>. To move to S3/MinIO later,
 * swap this router's storage and keep the same response shape.
 */
const ALLOWED = new Set([
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.csv',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp3', '.mp4', '.zip',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(config.uploadDir, new Date().toISOString().slice(0, 7));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${crypto.randomBytes(12).toString('hex')}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ALLOWED.has(path.extname(file.originalname).toLowerCase());
    if (ok) cb(null, true);
    else cb(new HttpError(400, `File type not allowed: ${file.originalname}`));
  },
});

const r = Router();

r.post('/', requireRole('admin', 'teacher'), upload.single('file'), (req, res) => {
  if (!req.file) throw new HttpError(400, 'No file uploaded');
  const rel = path.relative(config.uploadDir, req.file.path).split(path.sep).join('/');
  res.status(201).json({
    label: req.file.originalname,
    url: `/uploads/${rel}`,
    kind: 'file',
    size: req.file.size,
  });
});

export default r;
