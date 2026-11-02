import { Router } from 'express';
import { z } from 'zod';
import { Bookmark, Lecture, Progress } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError, isObjectId } from '../lib/http.js';

/** Per-user learning state: watch progress, continue watching, bookmarks. Any logged-in role. */
const r = Router();
r.use(requireRole());

const LECTURE_POPULATE = { path: 'lecture', populate: ['subject', 'chapter', 'teacher', 'classes'] };
const COMPLETE_AT = 0.9; // 90% watched counts as done

function lectureId(id: unknown) {
  if (!isObjectId(id)) throw new HttpError(400, 'Invalid lecture id');
  return id;
}

r.put('/progress/:lectureId', async (req, res) => {
  const lecture = lectureId(req.params.lectureId);
  const { positionSeconds, durationSeconds, completed } = z
    .object({
      positionSeconds: z.number().min(0).default(0),
      durationSeconds: z.number().min(0).default(0),
      completed: z.boolean().optional(),
    })
    .parse(req.body);
  if (!(await Lecture.exists({ _id: lecture }))) throw new HttpError(404, 'Lecture not found');

  const set: Record<string, unknown> = { positionSeconds, durationSeconds };
  // Reaching 90% marks it done; only an explicit completed:false un-completes it.
  if (completed !== undefined) set.completed = completed;
  else if (durationSeconds > 0 && positionSeconds / durationSeconds >= COMPLETE_AT) set.completed = true;
  const progress = await Progress.findOneAndUpdate({ user: req.user!.id, lecture }, { $set: set }, { upsert: true, new: true });
  res.json(progress);
});

r.get('/progress/:lectureId', async (req, res) => {
  res.json(await Progress.findOne({ user: req.user!.id, lecture: lectureId(req.params.lectureId) }).lean());
});

/** Started but not finished, most recent first. */
r.get('/continue', async (req, res) => {
  const rows = await Progress.find({ user: req.user!.id, completed: false, positionSeconds: { $gt: 0 } })
    .sort({ updatedAt: -1 })
    .limit(12)
    .populate(LECTURE_POPULATE)
    .lean();
  res.json(rows.filter((p) => p.lecture));
});

r.get('/history', async (req, res) => {
  const rows = await Progress.find({ user: req.user!.id }).sort({ updatedAt: -1 }).limit(100).populate(LECTURE_POPULATE).lean();
  res.json(rows.filter((p) => p.lecture));
});

r.get('/bookmarks', async (req, res) => {
  const rows = await Bookmark.find({ user: req.user!.id }).sort({ createdAt: -1 }).populate(LECTURE_POPULATE).lean();
  res.json(rows.filter((b) => b.lecture));
});

/** Ids only, so lecture cards can show a filled bookmark icon cheaply. */
r.get('/bookmarks/ids', async (req, res) => {
  res.json((await Bookmark.find({ user: req.user!.id }, { lecture: 1 }).lean()).map((b) => String(b.lecture)));
});

r.put('/bookmarks/:lectureId', async (req, res) => {
  const lecture = lectureId(req.params.lectureId);
  await Bookmark.updateOne({ user: req.user!.id, lecture }, {}, { upsert: true });
  res.status(204).end();
});

r.delete('/bookmarks/:lectureId', async (req, res) => {
  await Bookmark.deleteOne({ user: req.user!.id, lecture: lectureId(req.params.lectureId) });
  res.status(204).end();
});

export default r;
