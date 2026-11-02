import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const opts = { timestamps: true } as const;

/* ---------- Taxonomy ---------- */

const classSchema = new Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Class 8"
    section: { type: String, trim: true, default: '' }, // e.g. "A"
    order: { type: Number, default: 0 }, // for sorting Class 1..12
  },
  opts,
);
classSchema.index({ name: 1, section: 1 }, { unique: true });

const subjectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, trim: true, uppercase: true },
    color: { type: String, default: '#2563eb' }, // notebook-cover colour in the UI
    icon: { type: String, default: '📘' },
  },
  opts,
);

const chapterSchema = new Schema(
  {
    subject: { type: Types.ObjectId, ref: 'Subject', required: true },
    classes: [{ type: Types.ObjectId, ref: 'Class' }],
    number: { type: Number, default: 0 },
    title: { type: String, required: true, trim: true },
  },
  opts,
);
chapterSchema.index({ subject: 1, number: 1 });

const teacherSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    subjects: [{ type: Types.ObjectId, ref: 'Subject' }],
  },
  opts,
);

/* ---------- Lecture ---------- */

const metaSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const lectureSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    classes: {
      type: [{ type: Types.ObjectId, ref: 'Class' }],
      validate: [(v: unknown[]) => v.length > 0, 'A lecture needs at least one class'],
    },
    subject: { type: Types.ObjectId, ref: 'Subject', required: true },
    chapter: { type: Types.ObjectId, ref: 'Chapter' },
    teacher: { type: Types.ObjectId, ref: 'Teacher' },
    videoUrl: { type: String, trim: true, default: '' },
    // Attachments: uploaded files (served from /uploads) or external links
    resources: [{ label: String, url: String, kind: { type: String, default: 'link' }, size: Number, _id: false }],
    durationMinutes: { type: Number, min: 0 },
    lectureDate: { type: Date },
    period: { type: Number, min: 1, max: 12 }, // timetable period on lectureDate
    tags: [{ type: String, trim: true, lowercase: true }],
    meta: [metaSchema], // free-form key-value pairs, e.g. { key: "term", value: "Term 1" }
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    views: { type: Number, default: 0 },
    createdBy: { type: Types.ObjectId, ref: 'User' },
  },
  opts,
);
lectureSchema.index({ classes: 1, subject: 1, chapter: 1 });
lectureSchema.index({ teacher: 1 });
lectureSchema.index({ lectureDate: 1, period: 1 });
lectureSchema.index({ 'meta.key': 1, 'meta.value': 1 });
lectureSchema.index({ tags: 1 });
lectureSchema.index(
  { title: 'text', description: 'text', tags: 'text' },
  { weights: { title: 5, tags: 3, description: 1 } },
);

/* ---------- Users ---------- */

export const ROLES = ['admin', 'teacher', 'student'] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    // Local (dev/fallback) accounts have a password; SMS accounts are identified by smsId.
    passwordHash: { type: String, select: false },
    source: { type: String, enum: ['local', 'sms'], default: 'local' },
    smsId: { type: String },
    smsIdNo: { type: String }, // admission / employee number shown in the SMS
    role: { type: String, enum: ROLES, default: 'student' },
    teacher: { type: Types.ObjectId, ref: 'Teacher' }, // links a teacher login to their profile
    class: { type: Types.ObjectId, ref: 'Class' }, // a student's own class
    lastLoginAt: Date,
  },
  opts,
);
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });
userSchema.index({ smsId: 1 }, { unique: true, partialFilterExpression: { smsId: { $type: 'string' } } });

/* ---------- Per-user learning state ---------- */

const progressSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    lecture: { type: Types.ObjectId, ref: 'Lecture', required: true },
    positionSeconds: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
  },
  opts,
);
progressSchema.index({ user: 1, lecture: 1 }, { unique: true });
progressSchema.index({ user: 1, updatedAt: -1 });

const bookmarkSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    lecture: { type: Types.ObjectId, ref: 'Lecture', required: true },
  },
  opts,
);
bookmarkSchema.index({ user: 1, lecture: 1 }, { unique: true });

export const ClassModel = model('Class', classSchema);
export const Subject = model('Subject', subjectSchema);
export const Chapter = model('Chapter', chapterSchema);
export const Teacher = model('Teacher', teacherSchema);
export const Lecture = model('Lecture', lectureSchema);
export const User = model('User', userSchema);
export const Progress = model('Progress', progressSchema);
export const Bookmark = model('Bookmark', bookmarkSchema);

export type LectureDoc = InferSchemaType<typeof lectureSchema>;
