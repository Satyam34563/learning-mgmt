/**
 * DEMO DATA for trying the portal locally: sample classes, subjects, chapters, teachers and lectures, plus
 * demo accounts. It WIPES all classes, subjects, chapters, teachers, lectures, progress and bookmarks first,
 * so never run it against a school's real data.
 *   npm run seed:demo   -> sample school + admin@school.local, teacher@school.local, student@school.local
 *   npm run seed:admin  -> only make sure the local admin (SEED_ADMIN_EMAIL) exists; touches nothing else
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { ClassModel, Subject, Chapter, Teacher, Lecture, User, Progress, Bookmark } from '../models/index.js';

await mongoose.connect(config.mongoUri);

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@school.local';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';
await User.syncIndexes();
if (!(await User.exists({ email: adminEmail }))) {
  await User.create({
    name: 'School Admin',
    email: adminEmail,
    role: 'admin',
    source: 'local',
    passwordHash: await bcrypt.hash(adminPassword, 10),
  });
  console.log(`Created admin ${adminEmail}`);
}

if (process.argv.includes('--admin')) {
  await mongoose.disconnect();
  process.exit(0);
}

for (const m of [Lecture, Chapter, Teacher, Subject, ClassModel, Progress, Bookmark] as mongoose.Model<any>[]) {
  await m.deleteMany({});
  await m.syncIndexes();
}

const classes = await ClassModel.insertMany(
  [6, 7, 8, 9, 10].map((n) => ({ name: `Class ${n}`, order: n })),
);
const cls = Object.fromEntries(classes.map((c) => [c.name, c._id]));

const subjects = await Subject.insertMany([
  { name: 'Mathematics', code: 'MATH', color: '#2563eb', icon: '📐' },
  { name: 'Science', code: 'SCI', color: '#16a34a', icon: '🔬' },
  { name: 'English', code: 'ENG', color: '#dc2626', icon: '📖' },
  { name: 'Social Studies', code: 'SST', color: '#d97706', icon: '🌍' },
  { name: 'Hindi', code: 'HIN', color: '#9333ea', icon: '✍️' },
]);
const sub = Object.fromEntries(subjects.map((s) => [s.name, s._id]));

const teachers = await Teacher.insertMany([
  { name: 'Mrs. Anjali Sharma', subjects: [sub.Mathematics] },
  { name: 'Mr. Rakesh Verma', subjects: [sub.Science] },
  { name: 'Ms. Priya Nair', subjects: [sub.English] },
  { name: 'Mr. Imran Khan', subjects: [sub['Social Studies']] },
]);
const tch = Object.fromEntries(teachers.map((t) => [t.name, t._id]));

const chapterSpecs: [string, string[], string[]][] = [
  ['Mathematics', ['Class 8'], ['Rational Numbers', 'Linear Equations in One Variable', 'Understanding Quadrilaterals', 'Squares and Square Roots']],
  ['Mathematics', ['Class 9'], ['Number Systems', 'Polynomials', 'Coordinate Geometry', 'Triangles']],
  ['Mathematics', ['Class 10'], ['Real Numbers', 'Quadratic Equations', 'Arithmetic Progressions', 'Trigonometry']],
  ['Science', ['Class 8'], ['Crop Production', 'Microorganisms', 'Force and Pressure', 'Light']],
  ['Science', ['Class 9', 'Class 10'], ['Motion', 'Atoms and Molecules', 'The Fundamental Unit of Life']],
  ['English', ['Class 6', 'Class 7', 'Class 8'], ['Grammar: Tenses', 'Grammar: Active & Passive Voice', 'Letter Writing']],
  ['Social Studies', ['Class 9'], ['The French Revolution', 'Physical Features of India', 'What is Democracy?']],
];
const chapters = await Chapter.insertMany(
  chapterSpecs.flatMap(([subject, classNames, titles]) =>
    titles.map((title, i) => ({
      subject: sub[subject],
      classes: classNames.map((c) => cls[c]),
      number: i + 1,
      title,
    })),
  ),
);

const subjectTeacher: Record<string, string | undefined> = {
  Mathematics: 'Mrs. Anjali Sharma',
  Science: 'Mr. Rakesh Verma',
  English: 'Ms. Priya Nair',
  'Social Studies': 'Mr. Imran Khan',
};
const subjectName = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));
const sampleVideos = [
  'https://www.youtube.com/watch?v=Zi_XLOBDo_Y',
  'https://www.youtube.com/watch?v=ZM8ECpBuQYE',
  'https://www.youtube.com/watch?v=kjBOesZCoqc',
];

// One or two lectures per chapter, leaving the last chapter of each block empty so the gap report has something.
const lectures = chapters.flatMap((ch, idx) => {
  const isLastInBlock = !chapters[idx + 1] || String(chapters[idx + 1].subject) !== String(ch.subject) || chapters[idx + 1].number === 1;
  if (isLastInBlock) return [];
  const parts = idx % 3 === 0 ? 2 : 1;
  const name = subjectName[String(ch.subject)];
  const teacherName = subjectTeacher[name];
  return Array.from({ length: parts }, (_, p) => ({
    title: parts > 1 ? `${ch.title} — Part ${p + 1}` : ch.title,
    description: `Chapter ${ch.number} of ${name}. In this lecture we cover the key ideas of "${ch.title}" with worked examples and practice questions.`,
    classes: ch.classes,
    subject: ch.subject,
    chapter: ch._id,
    teacher: teacherName ? tch[teacherName] : undefined,
    videoUrl: sampleVideos[(idx + p) % sampleVideos.length],
    durationMinutes: 30 + ((idx * 7) % 25),
    lectureDate: new Date(Date.UTC(2026, 9, 1 + ((idx * 3 + p) % 40))),
    period: 1 + ((idx + p) % 7),
    tags: [name.toLowerCase().split(' ')[0], p === 0 ? 'concepts' : 'practice'],
    meta: [
      { key: 'term', value: idx % 2 ? 'Term 2' : 'Term 1' },
      { key: 'board', value: 'CBSE' },
      { key: 'language', value: idx % 4 === 0 ? 'Hindi' : 'English' },
    ],
    status: 'published' as const,
    views: (idx * 37) % 400,
  }));
});
const savedLectures = await Lecture.insertMany(lectures);

// Demo local accounts for each role (password = SEED_ADMIN_PASSWORD). Real users come from SMS login.
const demoHash = await bcrypt.hash(adminPassword, 10);
await User.deleteMany({ email: { $in: ['teacher@school.local', 'student@school.local'] } });
await User.create({ name: 'Mrs. Anjali Sharma', email: 'teacher@school.local', role: 'teacher', source: 'local', passwordHash: demoHash, teacher: tch['Mrs. Anjali Sharma'] });
const student = await User.create({ name: 'Riya Singh', email: 'student@school.local', role: 'student', source: 'local', passwordHash: demoHash, class: cls['Class 9'] });

// Give the demo student some history so "Continue watching" isn't empty.
const class9 = savedLectures.filter((l) => l.classes.some((c) => String(c) === String(cls['Class 9'])));
await Progress.insertMany(
  class9.slice(0, 4).map((l, i) => ({ user: student._id, lecture: l._id, positionSeconds: [300, 900, 2400, 120][i], durationSeconds: 2400, completed: i === 2 })),
);
await Bookmark.insertMany(class9.slice(4, 6).map((l) => ({ user: student._id, lecture: l._id })));

console.log(
  `Seeded ${classes.length} classes, ${subjects.length} subjects, ${chapters.length} chapters, ${teachers.length} teachers, ${lectures.length} lectures`,
);
await mongoose.disconnect();
