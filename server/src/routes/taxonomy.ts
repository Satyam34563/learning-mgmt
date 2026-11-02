import { Router } from 'express';
import type { Model } from 'mongoose';
import { z } from 'zod';
import { ClassModel, Subject, Chapter, Teacher, Lecture, type Role } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError, isObjectId } from '../lib/http.js';

const objectId = z.string().refine(isObjectId, 'Invalid id');

interface CrudOptions {
  model: Model<any>;
  schema: z.ZodObject<any>;
  sort: Record<string, 1 | -1>;
  populate?: string[];
  /** Lecture field that references this entity, to block deleting things still in use. */
  lectureField: string;
  /** Builds the list filter from query params. */
  filter?: (q: Record<string, unknown>) => Record<string, unknown>;
  writeRoles: Role[];
}

function crudRouter({ model, schema, sort, populate = [], lectureField, filter, writeRoles }: CrudOptions) {
  const r = Router();
  const canWrite = requireRole(...writeRoles);

  r.get('/', async (req, res) => {
    let query = model.find(filter ? filter(req.query) : {}).sort(sort);
    for (const p of populate) query = query.populate(p);
    res.json(await query.lean());
  });

  r.get('/:id', async (req, res) => {
    let query = model.findById(req.params.id);
    for (const p of populate) query = query.populate(p);
    const doc = await query.lean();
    if (!doc) throw new HttpError(404, 'Not found');
    res.json(doc);
  });

  r.post('/', canWrite, async (req, res) => {
    const doc = await model.create(schema.parse(req.body));
    res.status(201).json(doc);
  });

  r.put('/:id', canWrite, async (req, res) => {
    const doc = await model.findByIdAndUpdate(req.params.id, schema.partial().parse(req.body), {
      new: true,
      runValidators: true,
    });
    if (!doc) throw new HttpError(404, 'Not found');
    res.json(doc);
  });

  r.delete('/:id', canWrite, async (req, res) => {
    const inUse = await Lecture.countDocuments({ [lectureField]: req.params.id });
    if (inUse) throw new HttpError(409, `Still used by ${inUse} lecture(s); move them first`);
    const doc = await model.findByIdAndDelete(req.params.id);
    if (!doc) throw new HttpError(404, 'Not found');
    res.status(204).end();
  });

  return r;
}

export const classesRouter = crudRouter({
  model: ClassModel,
  schema: z.object({
    name: z.string().trim().min(1),
    section: z.string().trim().optional(),
    order: z.coerce.number().optional(),
  }),
  sort: { order: 1, name: 1, section: 1 },
  lectureField: 'classes',
  writeRoles: ['admin'],
});

export const subjectsRouter = crudRouter({
  model: Subject,
  schema: z.object({
    name: z.string().trim().min(1),
    code: z.string().trim().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    icon: z.string().max(8).optional(),
  }),
  sort: { name: 1 },
  lectureField: 'subject',
  writeRoles: ['admin'],
});

export const chaptersRouter = crudRouter({
  model: Chapter,
  schema: z.object({
    subject: objectId,
    classes: z.array(objectId).default([]),
    number: z.coerce.number().optional(),
    title: z.string().trim().min(1),
  }),
  sort: { number: 1, title: 1 },
  populate: ['subject'],
  lectureField: 'chapter',
  filter: (q) => ({
    ...(isObjectId(q.subject) && { subject: q.subject }),
    ...(isObjectId(q.class) && { classes: q.class }),
  }),
  writeRoles: ['admin', 'teacher'],
});

export const teachersRouter = crudRouter({
  model: Teacher,
  schema: z.object({
    name: z.string().trim().min(1),
    email: z.union([z.email(), z.literal('')]).optional(),
    subjects: z.array(objectId).default([]),
  }),
  sort: { name: 1 },
  populate: ['subjects'],
  lectureField: 'teacher',
  writeRoles: ['admin'],
});
