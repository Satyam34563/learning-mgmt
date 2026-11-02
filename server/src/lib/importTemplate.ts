/**
 * The Excel template for bulk lecture import (Manage → Bulk import → Download template).
 *
 * Sheet 1 "Lectures"     the sheet to fill in; the importer reads only this one. Header row only, so nothing
 *                        stray gets imported. Dropdowns for subject / teacher / status, checks on dates and numbers.
 * Sheet 2 "How to fill"  what each column means, with a worked example.
 * Sheet 3 "Lists"        this school's current classes, subjects, chapters and teachers, spelled exactly as
 *                        the importer expects. Feeds the dropdowns.
 */
import ExcelJS from 'exceljs';
import { ClassModel, Subject, Chapter, Teacher } from '../models/index.js';

const NAVY = 'FF1F3A6E';
const GOLD = 'FFE3A82B';
const ROWS = 1000; // rows that get dropdowns / checks

interface Column {
  key: string;
  width: number;
  required?: boolean;
  help: string;
  example: string;
}

export const COLUMNS: Column[] = [
  { key: 'title', width: 38, required: true, help: 'Lecture title.', example: 'Polynomials – Introduction' },
  { key: 'subject', width: 18, required: true, help: 'Subject name or code, exactly as in the Lists sheet.', example: 'Mathematics' },
  { key: 'classes', width: 20, required: true, help: 'One or more class names separated by ";" (e.g. "Class 9;Class 10"). Add the section if your classes have one ("Class 9 A").', example: 'Class 9' },
  { key: 'chapter', width: 26, help: 'Chapter number (e.g. 2) or exact chapter title within that subject.', example: '2' },
  { key: 'teacher', width: 22, help: 'Teacher name, exactly as in the Lists sheet.', example: 'Mrs. Anjali Sharma' },
  { key: 'description', width: 40, help: 'What the lecture covers.', example: 'Degree of a polynomial, zeroes, worked examples.' },
  { key: 'videoUrl', width: 40, help: 'YouTube, Google Drive or a direct video link.', example: 'https://www.youtube.com/watch?v=XXXXXXXXXXX' },
  { key: 'durationMinutes', width: 16, help: 'Length in minutes (whole number).', example: '40' },
  { key: 'lectureDate', width: 14, help: 'Date the lecture was taught (an Excel date, or YYYY-MM-DD).', example: '2026-07-14' },
  { key: 'period', width: 9, help: 'Timetable period, 1 to 12.', example: '2' },
  { key: 'tags', width: 22, help: 'Keywords separated by ";".', example: 'concepts;algebra' },
  { key: 'status', width: 12, help: '"published" (everyone sees it) or "draft" (staff only). Empty = published.', example: 'published' },
  { key: 'meta.term', width: 12, help: 'Extra detail columns: any header starting with "meta." becomes a filter in Browse. Rename, add or delete these freely.', example: 'Term 1' },
  { key: 'meta.board', width: 12, help: 'Another extra detail, e.g. CBSE / ICSE / State board.', example: 'CBSE' },
];

const colLetter = (i: number) => String.fromCharCode(65 + i); // fine for < 26 columns

export async function buildImportTemplate(): Promise<Buffer> {
  const [classes, subjects, chapters, teachers] = await Promise.all([
    ClassModel.find().sort({ order: 1, name: 1, section: 1 }).lean(),
    Subject.find().sort({ name: 1 }).lean(),
    Chapter.find().populate('subject').sort({ number: 1 }).lean(),
    Teacher.find().sort({ name: 1 }).lean(),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Lectures portal';
  wb.created = new Date();

  /* ---------- Sheet 1: Lectures ---------- */
  const ws = wb.addWorksheet('Lectures', { views: [{ state: 'frozen', ySplit: 1 }], properties: { tabColor: { argb: NAVY } } });
  ws.columns = COLUMNS.map((c) => ({ header: c.required ? `${c.key}*` : c.key, key: c.key, width: c.width }));
  const header = ws.getRow(1);
  header.height = 22;
  header.eachCell((cell, i) => {
    const col = COLUMNS[i - 1];
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col.required ? NAVY : 'FF3A5A94' } };
    cell.alignment = { vertical: 'middle' };
    cell.border = { bottom: { style: 'medium', color: { argb: GOLD } } };
    cell.note = col.help;
  });
  // The importer matches headers case-insensitively and ignores the "*", see routes/import.ts.

  const idx = (key: string) => COLUMNS.findIndex((c) => c.key === key);
  const validate = (key: string, v: ExcelJS.DataValidation) => {
    for (let r = 2; r <= ROWS + 1; r++) ws.getCell(`${colLetter(idx(key))}${r}`).dataValidation = v;
  };
  validate('status', { type: 'list', allowBlank: true, formulae: ['"published,draft"'] });
  validate('period', { type: 'whole', allowBlank: true, operator: 'between', formulae: [1, 12], showErrorMessage: true, error: 'Period must be a whole number from 1 to 12.' });
  validate('durationMinutes', { type: 'whole', allowBlank: true, operator: 'between', formulae: [0, 1000], showErrorMessage: true, error: 'Duration is a whole number of minutes.' });
  validate('lectureDate', {
    type: 'date', allowBlank: true, operator: 'greaterThan', formulae: [new Date(Date.UTC(2000, 0, 1))],
    showErrorMessage: true, error: 'Enter a date (e.g. 14/07/2026) or YYYY-MM-DD.',
  });
  for (let r = 2; r <= ROWS + 1; r++) ws.getCell(`${colLetter(idx('lectureDate'))}${r}`).numFmt = 'yyyy-mm-dd';
  // Dropdowns from the Lists sheet; still free text, so new names work when "create missing" is ticked.
  if (subjects.length) validate('subject', { type: 'list', allowBlank: true, formulae: [`Lists!$B$2:$B$${subjects.length + 1}`], showErrorMessage: false });
  if (teachers.length) validate('teacher', { type: 'list', allowBlank: true, formulae: [`Lists!$D$2:$D$${teachers.length + 1}`], showErrorMessage: false });

  /* ---------- Sheet 2: How to fill ---------- */
  const help = wb.addWorksheet('How to fill', { properties: { tabColor: { argb: GOLD } } });
  help.columns = [{ width: 18 }, { width: 11 }, { width: 70 }, { width: 40 }];
  help.addRow(['Bulk lecture import']).font = { bold: true, size: 16, color: { argb: NAVY } };
  help.addRow(['Fill one row per lecture in the "Lectures" sheet, then upload this file on Manage → Bulk import. "Check file" first: nothing is saved until every row is valid.']);
  help.mergeCells('A2:D2');
  help.getRow(2).alignment = { wrapText: true };
  help.getRow(2).height = 32;
  help.addRow([]);
  const h = help.addRow(['Column', 'Required', 'What to enter', 'Example']);
  h.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  });
  for (const c of COLUMNS) {
    const row = help.addRow([c.key, c.required ? 'Yes' : '', c.help, c.example]);
    row.alignment = { wrapText: true, vertical: 'top' };
  }
  help.addRow([]);
  help.addRow(['Tips']).font = { bold: true, color: { argb: NAVY } };
  for (const tip of [
    'Names must match the portal exactly (see the "Lists" sheet). An admin can tick "Create … that don\'t exist yet" when importing to add new ones automatically.',
    'Several classes or tags: separate with ";".',
    'Leave the header row as it is. Extra "meta.<something>" columns are allowed; the "*" in headers is ignored.',
    'Up to 50,000 rows per file.',
  ]) {
    const r = help.addRow([`• ${tip}`]);
    help.mergeCells(`A${r.number}:D${r.number}`);
    r.alignment = { wrapText: true };
    r.height = 30;
  }

  /* ---------- Sheet 3: Lists ---------- */
  const lists = wb.addWorksheet('Lists', { properties: { tabColor: { argb: 'FF9AA6C2' } } });
  lists.columns = [
    { header: 'Classes', width: 16 },
    { header: 'Subjects', width: 22 },
    { header: 'Chapters (subject: number. title)', width: 48 },
    { header: 'Teachers', width: 26 },
  ];
  lists.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  });
  const cols = [
    classes.map((c) => (c.section ? `${c.name} ${c.section}` : c.name)),
    subjects.map((s) => s.name),
    chapters.map((c) => `${(c.subject as unknown as { name?: string })?.name ?? ''}: ${c.number}. ${c.title}`),
    teachers.map((t) => t.name),
  ];
  const longest = Math.max(1, ...cols.map((c) => c.length));
  for (let i = 0; i < longest; i++) lists.addRow(cols.map((c) => c[i] ?? (i === 0 && !c.length ? '(none yet)' : '')));
  lists.views = [{ state: 'frozen', ySplit: 1 }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}
