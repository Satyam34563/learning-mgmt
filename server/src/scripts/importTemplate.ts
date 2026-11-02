/**
 * Writes the bulk-import Excel template (same as Manage → Bulk import → Download) to a file.
 *   npm run import-template                  -> ../downloads/lecture-import-template.xlsx
 *   npm run import-template -- out.xlsx      -> out.xlsx
 */
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { config } from '../config.js';
import { buildImportTemplate } from '../lib/importTemplate.js';

const out = path.resolve(process.argv[2] ?? '../downloads/lecture-import-template.xlsx');
await mongoose.connect(config.mongoUri);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, await buildImportTemplate());
await mongoose.disconnect();
console.log(`Wrote ${out}`);
