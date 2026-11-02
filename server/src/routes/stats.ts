import { Router } from 'express';
import { ClassModel, Subject, Chapter, Teacher, Lecture, Progress, User } from '../models/index.js';
import { Types } from 'mongoose';
import { isStaff, requireRole } from '../middleware/auth.js';
import { HttpError, isObjectId } from '../lib/http.js';

const r = Router();

const published = { status: 'published' as const };
const toMap = (rows: { _id: unknown; count: number }[]) =>
  Object.fromEntries(rows.map((row) => [String(row._id), row.count]));

/** Headline counts plus lecture counts per class and per subject, for the home page. */
r.get('/', async (_req, res) => {
  const [lectures, classes, subjects, teachers, byClass, bySubject] = await Promise.all([
    Lecture.countDocuments(published),
    ClassModel.countDocuments(),
    Subject.countDocuments(),
    Teacher.countDocuments(),
    Lecture.aggregate([{ $match: published }, { $unwind: '$classes' }, { $group: { _id: '$classes', count: { $sum: 1 } } }]),
    Lecture.aggregate([{ $match: published }, { $group: { _id: '$subject', count: { $sum: 1 } } }]),
  ]);
  res.json({ lectures, classes, subjects, teachers, byClass: toMap(byClass), bySubject: toMap(bySubject) });
});

/** Lecture counts for one class, per subject and per chapter: the class page's sidebar and chapter list. */
r.get('/class/:classId', async (req, res) => {
  if (!isObjectId(req.params.classId)) throw new HttpError(400, 'Invalid class');
  const match = { classes: new Types.ObjectId(req.params.classId), ...(isStaff(req.user) ? {} : published) };
  const [row] = await Lecture.aggregate<{ total: { n: number }[]; bySubject: { _id: unknown; n: number }[]; byChapter: { _id: unknown; n: number }[] }>([
    { $match: match },
    {
      $facet: {
        total: [{ $count: 'n' }],
        bySubject: [{ $group: { _id: '$subject', n: { $sum: 1 } } }],
        byChapter: [{ $group: { _id: '$chapter', n: { $sum: 1 } } }],
      },
    },
  ]);
  const map = (rows: { _id: unknown; n: number }[]) => Object.fromEntries(rows.map((x) => [String(x._id), x.n]));
  res.json({ total: row?.total[0]?.n ?? 0, bySubject: map(row?.bySubject ?? []), byChapter: map(row?.byChapter ?? []) });
});

/** Chapters with no published lecture yet: what still needs recording. Staff only. */
r.get('/gaps', requireRole('admin', 'teacher'), async (_req, res) => {
  const covered = await Lecture.distinct('chapter', { ...published, chapter: { $ne: null } });
  const gaps = await Chapter.find({ _id: { $nin: covered } })
    .populate('subject')
    .populate('classes')
    .sort({ subject: 1, number: 1 })
    .lean();
  res.json(gaps);
});

/** Admin analytics: most watched, per-teacher output, completion, recent activity. */
r.get('/analytics', requireRole('admin'), async (_req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [topLectures, byTeacher, completion, activeLearners, drafts, users, recentlyAdded] = await Promise.all([
    Lecture.find(published).sort({ views: -1 }).limit(10).populate('subject').populate('classes').select('title views subject classes').lean(),
    Lecture.aggregate([
      { $match: published },
      { $group: { _id: '$teacher', lectures: { $sum: 1 }, views: { $sum: '$views' } } },
      { $lookup: { from: 'teachers', localField: '_id', foreignField: '_id', as: 'teacher' } },
      { $project: { lectures: 1, views: 1, name: { $ifNull: [{ $first: '$teacher.name' }, 'Unassigned'] } } },
      { $sort: { lectures: -1 } },
    ]),
    Progress.aggregate([{ $group: { _id: null, started: { $sum: 1 }, completed: { $sum: { $cond: ['$completed', 1, 0] } } } }]),
    Progress.distinct('user', { updatedAt: { $gte: since } }),
    Lecture.countDocuments({ status: 'draft' }),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Lecture.countDocuments({ createdAt: { $gte: since } }),
  ]);
  res.json({
    topLectures,
    byTeacher,
    completion: completion[0] ?? { started: 0, completed: 0 },
    activeLearners30d: activeLearners.length,
    lecturesAdded30d: recentlyAdded,
    drafts,
    usersByRole: toMap(users),
  });
});

export default r;
