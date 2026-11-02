/**
 * Bulk lecture import from CSV or Excel.
 *
 * Columns (header names are case-insensitive):
 *   title*, subject*, classes* (names separated by ";", e.g. "Class 9;Class 10"),
 *   chapter (number or title), teacher (name), description, videoUrl, durationMinutes,
 *   lectureDate (YYYY-MM-DD), period, tags (";"-separated), status (draft|published),
 *   meta.<key>  any number of columns, e.g. "meta.term", "meta.board"
 *
 * POST /api/import/lectures?dryRun=true  validates only and reports per-row errors.
 * Names that don't exist yet (subject/class/chapter/teacher) are reported as errors
 * unless ?create=true, in which case they're created.
 */
import { Router } from 'express';
import { Types } from 'mongoose';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { ClassModel, Subject, Chapter, Teacher, Lecture } from '../models/index.js';
import { config } from '../config.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError } from '../lib/http.js';
import { buildImportTemplate } from '../lib/importTemplate.js';

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadMb * 1024 * 1024 } });
const MAX_ROWS = 50_000;

type Row = Record<string, string>;

async function readRows(file: Express.Multer.File): Promise<Row[]> {
  const name = file.originalname.toLowerCase();
  if (name.endsWith('.csv')) {
    return parse(file.buffer, { columns: true, skip_empty_lines: true, trim: true, bom: true }) as Row[];
  }
  if (name.endsWith('.xlsx')) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
    const sheet = wb.worksheets[0];
    if (!sheet) return [];
    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell, col) => (headers[col] = String(cell.text).trim()));
    const rows: Row[] = [];
    sheet.eachRow((row, i) => {
      if (i === 1) return;
      const obj: Row = {};
      headers.forEach((h, col) => {
        if (!h) return;
        const v = row.getCell(col).value;
        obj[h] = v instanceof Date ? v.toISOString().slice(0, 10) : String(row.getCell(col).text ?? '').trim();
      });
      if (Object.values(obj).some(Boolean)) rows.push(obj);
    });
    return rows;
  }
  throw new HttpError(400, 'Upload a .csv or .xlsx file');
}

const split = (v?: string) => (v ?? '').split(/[;|]/).map((s) => s.trim()).filter(Boolean);
const norm = (s: string) => s.trim().toLowerCase();

/** Excel template with dropdowns and this school's names (see lib/importTemplate.ts). */
r.get('/lectures/template.xlsx', requireRole('admin', 'teacher'), async (_req, res) => {
  res
    .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .attachment('lecture-import-template.xlsx')
    .send(await buildImportTemplate());
});

/** Plain CSV version, for people who prefer it. */
r.get('/lectures/template', (_req, res) => {
  const header = 'title,subject,classes,chapter,teacher,description,videoUrl,durationMinutes,lectureDate,period,tags,status,meta.term,meta.board';
  const example = 'Polynomials - Intro,Mathematics,Class 9,Polynomials,Mrs. Anjali Sharma,Basics of polynomials,https://www.youtube.com/watch?v=xxxx,40,2026-07-14,2,concepts;algebra,published,Term 1,CBSE';
  res.type('text/csv').attachment('lecture-import-template.csv').send(`${header}\n${example}\n`);
});

r.post('/lectures', requireRole('admin', 'teacher'), upload.single('file'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No file uploaded');
  const dryRun = req.query.dryRun === 'true';
  const create = req.query.create === 'true' && req.user!.role === 'admin';

  const raw = await readRows(req.file);
  if (!raw.length) throw new HttpError(400, 'The file has no rows');
  if (raw.length > MAX_ROWS) throw new HttpError(400, `Max ${MAX_ROWS} rows per import`);
  // lower-case header keys, keep meta.<key> casing-insensitive too
  // "title*" in the Excel template marks a required column; the "*" isn't part of the name.
  const rows = raw.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [norm(k).replace(/\*$/, ''), String(v ?? '').trim()])));

  const [classes, subjects, chapters, teachers] = await Promise.all([
    ClassModel.find().lean(),
    Subject.find().lean(),
    Chapter.find().lean(),
    Teacher.find().lean(),
  ]);
  const classByName = new Map(classes.map((c) => [norm(c.section ? `${c.name} ${c.section}` : c.name), c._id]));
  for (const c of classes) if (!classByName.has(norm(c.name))) classByName.set(norm(c.name), c._id);
  const subjectByName = new Map(subjects.flatMap((s) => [[norm(s.name), s._id], ...(s.code ? [[norm(s.code), s._id] as const] : [])]));
  const teacherByName = new Map(teachers.map((t) => [norm(t.name), t._id]));

  const errors: { row: number; message: string }[] = [];
  const docs: Record<string, unknown>[] = [];

  // Names that don't exist yet (admin ticked "create"): given ids now, saved only if the whole file is valid
  // and this isn't a dry run, so "Check file" never changes anything and a failed import leaves nothing behind.
  const pending = { subjects: [] as object[], classes: [] as object[], chapters: [] as object[], teachers: [] as object[] };
  const newId = () => new Types.ObjectId();
  const created = { subjects: 0, classes: 0, chapters: 0, teachers: 0 };

  for (const [i, row] of rows.entries()) {
    const rowNo = i + 2; // header is row 1
    const fail = (message: string) => errors.push({ row: rowNo, message });
    if (!row.title) { fail('title is required'); continue; }

    let subjectId = row.subject && subjectByName.get(norm(row.subject));
    if (!subjectId && row.subject && create) {
      subjectId = newId();
      pending.subjects.push({ _id: subjectId, name: row.subject });
      subjectByName.set(norm(row.subject), subjectId);
    }
    if (!subjectId) { fail(`unknown subject "${row.subject ?? ''}"`); continue; }

    const classIds: Types.ObjectId[] = [];
    for (const name of split(row.classes ?? row.class)) {
      let id = classByName.get(norm(name));
      if (!id && create) {
        id = newId();
        pending.classes.push({ _id: id, name, order: Number(name.match(/\d+/)?.[0] ?? 0) });
        classByName.set(norm(name), id);
      }
      if (id) classIds.push(id);
      else fail(`unknown class "${name}"`);
    }
    if (!classIds.length) { fail('at least one class is required'); continue; }

    let chapterId;
    if (row.chapter) {
      const inSubject = chapters.filter((c) => String(c.subject) === String(subjectId));
      const ch = /^\d+$/.test(row.chapter)
        ? inSubject.find((c) => c.number === Number(row.chapter))
        : inSubject.find((c) => norm(c.title) === norm(row.chapter));
      if (ch) chapterId = ch._id;
      else if (create && !/^\d+$/.test(row.chapter)) {
        // numbered within the class (Class 9's first chapter is 1, whatever other classes have)
        const sameClass = inSubject.filter((c) => c.classes.some((id) => classIds.some((cid) => String(cid) === String(id))));
        const number = sameClass.reduce((m, c) => Math.max(m, c.number ?? 0), 0) + 1;
        const chapter = { _id: newId(), subject: subjectId, classes: classIds, title: row.chapter, number };
        pending.chapters.push(chapter);
        chapters.push(chapter as (typeof chapters)[number]);
        chapterId = chapter._id;
      } else { fail(`unknown chapter "${row.chapter}" in ${row.subject}`); continue; }
    }

    let teacherId;
    if (row.teacher) {
      teacherId = teacherByName.get(norm(row.teacher));
      if (!teacherId && create) {
        teacherId = newId();
        pending.teachers.push({ _id: teacherId, name: row.teacher, subjects: [subjectId] });
        teacherByName.set(norm(row.teacher), teacherId);
      }
      if (!teacherId) { fail(`unknown teacher "${row.teacher}"`); continue; }
    }

    const date = row.lecturedate ? new Date(row.lecturedate) : undefined;
    if (date && Number.isNaN(date.getTime())) { fail(`bad lectureDate "${row.lecturedate}"`); continue; }
    if (row.videourl && !URL.canParse(row.videourl)) { fail(`bad videoUrl "${row.videourl}"`); continue; }
    const duration = row.durationminutes ? Number(row.durationminutes) : undefined;
    if (duration !== undefined && !(duration >= 0)) { fail(`bad durationMinutes "${row.durationminutes}"`); continue; }
    const period = row.period ? Number(row.period) : undefined;
    if (period !== undefined && !(Number.isInteger(period) && period >= 1 && period <= 12)) { fail(`period must be 1–12, got "${row.period}"`); continue; }
    const status = norm(row.status ?? '') || 'published';
    if (status !== 'published' && status !== 'draft') { fail(`status must be "published" or "draft", got "${row.status}"`); continue; }

    docs.push({
      title: row.title,
      description: row.description ?? '',
      classes: classIds,
      subject: subjectId,
      chapter: chapterId,
      teacher: teacherId ?? (req.user!.role === 'teacher' ? req.user!.teacher : undefined),
      videoUrl: row.videourl ?? '',
      durationMinutes: duration,
      lectureDate: date,
      period,
      tags: split(row.tags).map(norm),
      status,
      meta: Object.entries(row)
        .filter(([k, v]) => k.startsWith('meta.') && v)
        .map(([k, v]) => ({ key: k.slice(5), value: v })),
      createdBy: req.user!.id,
    });
  }

  const willImport = !dryRun && !errors.length;
  if (willImport) {
    // order matters: chapters and teachers refer to subjects / classes
    if (pending.subjects.length) created.subjects = (await Subject.insertMany(pending.subjects)).length;
    if (pending.classes.length) created.classes = (await ClassModel.insertMany(pending.classes)).length;
    if (pending.chapters.length) created.chapters = (await Chapter.insertMany(pending.chapters)).length;
    if (pending.teachers.length) created.teachers = (await Teacher.insertMany(pending.teachers)).length;
    await Lecture.insertMany(docs);
  }
  res.json({
    total: rows.length,
    valid: docs.length,
    imported: willImport ? docs.length : 0,
    // on a check, what *would* be created
    toCreate: Object.fromEntries(Object.entries(pending).map(([k, v]) => [k, v.length])),
    created,
    errors,
  });
});

export default r;
