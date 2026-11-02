import { Router, type Request } from 'express';
import type { QueryFilter } from 'mongoose';
import { z } from 'zod';
import { Bookmark, Lecture, Progress, type LectureDoc } from '../models/index.js';
import { isStaff, requireRole } from '../middleware/auth.js';
import { HttpError, isObjectId } from '../lib/http.js';

const r = Router();

const objectId = z.string().refine(isObjectId, 'Invalid id');
const optionalId = z.union([objectId, z.literal(''), z.null()]).transform((v) => v || undefined);

const lectureInput = z.object({
  title: z.string().trim().min(1),
  description: z.string().default(''),
  classes: z.array(objectId).min(1, 'Pick at least one class'),
  subject: objectId,
  chapter: optionalId.optional(),
  teacher: optionalId.optional(),
  videoUrl: z.union([z.url(), z.literal('')]).default(''),
  resources: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        url: z.string().refine((u) => u.startsWith('/uploads/') || URL.canParse(u), 'Invalid URL'),
        kind: z.enum(['link', 'file']).default('link'),
        size: z.number().optional(),
      }),
    )
    .default([]),
  durationMinutes: z.coerce.number().min(0).optional(),
  lectureDate: z.coerce.date().optional(),
  period: z.coerce.number().int().min(1).max(12).optional(),
  tags: z.array(z.string().trim().toLowerCase().min(1)).default([]),
  meta: z
    .array(z.object({ key: z.string().trim().toLowerCase().min(1), value: z.string().trim().min(1) }))
    .default([]),
  status: z.enum(['draft', 'published']).default('published'),
});

const POPULATE = ['classes', 'subject', 'chapter', 'teacher'];

const asList = (v: unknown): string[] =>
  (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []).map(String).filter(Boolean);

/** Teachers may only touch lectures they created or that are assigned to them. */
function assertCanEdit(req: Request, lecture: { createdBy?: unknown; teacher?: unknown }) {
  const u = req.user!;
  if (u.role === 'admin') return;
  const mine =
    String(lecture.createdBy) === u.id || (u.teacher && String(lecture.teacher) === u.teacher);
  if (!mine) throw new HttpError(403, 'You can only edit your own lectures');
}

/**
 * GET /api/lectures
 *   ?class=&subject=&chapter=&teacher=   (ids; class/subject/teacher accept comma lists)
 *   &tag=a,b  &meta=term:Term 1,board:CBSE  &q=search text
 *   &from=2026-07-01&to=2026-07-07 (lectureDate range)
 *   &status=draft|published (staff only)  &sort=newest|oldest|title|popular|timetable|recent
 *   &page=1&limit=24
 */
r.get('/', async (req, res) => {
  const q = req.query;
  const filter: QueryFilter<LectureDoc> = {};

  const classes = asList(q.class).filter(isObjectId);
  if (classes.length) filter.classes = { $in: classes };
  const subjects = asList(q.subject).filter(isObjectId);
  if (subjects.length) filter.subject = { $in: subjects };
  const teachers = asList(q.teacher).filter(isObjectId);
  if (teachers.length) filter.teacher = { $in: teachers };
  if (isObjectId(q.chapter)) filter.chapter = q.chapter;

  const tags = asList(q.tag).map((t) => t.toLowerCase());
  if (tags.length) filter.tags = { $all: tags };

  const metaPairs = asList(q.meta)
    .map((pair) => {
      const i = pair.indexOf(':');
      return i > 0 ? { key: pair.slice(0, i).trim().toLowerCase(), value: pair.slice(i + 1).trim() } : null;
    })
    .filter((p) => p !== null);
  if (metaPairs.length) filter.$and = metaPairs.map((m) => ({ meta: { $elemMatch: m } }));

  if (q.from || q.to) {
    filter.lectureDate = {
      ...(q.from && { $gte: new Date(String(q.from)) }),
      ...(q.to && { $lte: new Date(String(q.to)) }),
    };
  }

  if (!isStaff(req.user)) filter.status = 'published';
  else if (q.status === 'draft' || q.status === 'published') filter.status = q.status;

  const search = typeof q.q === 'string' ? q.q.trim() : '';
  if (search) filter.$text = { $search: search };

  const sorts: Record<string, Record<string, 1 | -1>> = {
    newest: { lectureDate: -1, createdAt: -1 },
    oldest: { lectureDate: 1, createdAt: 1 },
    timetable: { lectureDate: 1, period: 1 },
    recent: { createdAt: -1 },
    title: { title: 1 },
    popular: { views: -1 },
  };
  const sort = search && !q.sort ? { score: { $meta: 'textScore' } } : (sorts[String(q.sort)] ?? sorts.newest);

  const limit = Math.min(Math.max(Number(q.limit) || 24, 1), 100);
  const page = Math.max(Number(q.page) || 1, 1);

  let query = Lecture.find(filter, search ? { score: { $meta: 'textScore' } } : {})
    .sort(sort as Record<string, 1 | -1>)
    .skip((page - 1) * limit)
    .limit(limit);
  for (const p of POPULATE) query = query.populate(p);

  const [items, total] = await Promise.all([query.lean(), Lecture.countDocuments(filter)]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
});

/** Distinct meta keys with their values, for building filter dropdowns. */
r.get('/meta-keys', async (_req, res) => {
  const rows = await Lecture.aggregate<{ _id: string; values: string[] }>([
    { $match: { status: 'published' } },
    { $unwind: '$meta' },
    { $group: { _id: '$meta.key', values: { $addToSet: '$meta.value' } } },
    { $sort: { _id: 1 } },
  ]);
  res.json(rows.map((r) => ({ key: r._id, values: r.values.sort() })));
});

r.get('/tags', async (_req, res) => {
  const rows = await Lecture.aggregate<{ _id: string; count: number }>([
    { $match: { status: 'published' } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 50 },
  ]);
  res.json(rows.map((r) => ({ tag: r._id, count: r.count })));
});

r.get('/:id', async (req, res) => {
  let query = Lecture.findById(req.params.id);
  for (const p of POPULATE) query = query.populate(p);
  const lecture = await query.lean();
  if (!lecture || (lecture.status !== 'published' && !isStaff(req.user))) throw new HttpError(404, 'Lecture not found');
  if (!isStaff(req.user)) await Lecture.updateOne({ _id: lecture._id }, { $inc: { views: 1 } });
  res.json(lecture);
});

r.post('/', requireRole('admin', 'teacher'), async (req, res) => {
  const data = lectureInput.parse(req.body);
  // A teacher's lectures default to their own teacher profile.
  if (req.user!.role === 'teacher' && !data.teacher) data.teacher = req.user!.teacher;
  const lecture = await Lecture.create({ ...data, createdBy: req.user!.id });
  res.status(201).json(lecture);
});

r.put('/:id', requireRole('admin', 'teacher'), async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) throw new HttpError(404, 'Lecture not found');
  assertCanEdit(req, lecture);
  const data = lectureInput.parse(req.body);
  lecture.set({
    ...data,
    chapter: data.chapter ?? null,
    teacher: data.teacher ?? null,
    period: data.period ?? null,
    lectureDate: data.lectureDate ?? null,
    durationMinutes: data.durationMinutes ?? null,
  });
  await lecture.save();
  res.json(lecture);
});

r.delete('/:id', requireRole('admin', 'teacher'), async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) throw new HttpError(404, 'Lecture not found');
  assertCanEdit(req, lecture);
  await Promise.all([lecture.deleteOne(), Progress.deleteMany({ lecture: lecture._id }), Bookmark.deleteMany({ lecture: lecture._id })]);
  res.status(204).end();
});

export default r;
