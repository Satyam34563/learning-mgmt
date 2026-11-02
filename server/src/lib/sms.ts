/**
 * Single sign-on with the school's main School Management System (SMS).
 *
 * Flow:
 *   1. Browser hits GET /api/auth/sms/login?next=/somewhere
 *   2. We redirect to SMS_LOGIN_URL?redirect_uri=<portal>/api/auth/sms/callback&state=<signed next>
 *   3. SMS authenticates the user and redirects back with ?token=<JWT>&state=...
 *   4. We verify the JWT, upsert the user, set our own session cookie, and redirect to `next`.
 *
 * Expected token claims (adjust `claimsSchema` to match the SMS):
 *   sub      SMS user id (required)
 *   name     display name (required)
 *   email    optional
 *   role     SMS role name, mapped through SMS_ROLE_MAP (falls back to the same name)
 *   class    student's class name, e.g. "Class 9" (optional)
 *   section  student's section, e.g. "A" (optional)
 *   id_no    admission / employee number in the SMS (optional)
 *
 * The SMS side lives in the SMS repo: LecturesSsoController + config/lectures_sso.php (RS256).
 */
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { ClassModel, Teacher, User, ROLES, type Role } from '../models/index.js';
import { HttpError } from './http.js';

const claimsSchema = z.object({
  sub: z.coerce.string().min(1),
  name: z.string().min(1),
  email: z.string().optional(),
  role: z.string().min(1),
  class: z.string().optional(),
  section: z.string().optional(),
  id_no: z.string().optional(),
});
export type SmsClaims = z.infer<typeof claimsSchema>;

export function callbackUrl() {
  return `${config.clientOrigin}/api/auth/sms/callback`;
}

export function verifySmsToken(token: string): SmsClaims {
  const key = config.sms.tokenPublicKey || config.sms.tokenSecret;
  try {
    const payload = jwt.verify(token, key, {
      algorithms: config.sms.tokenPublicKey ? ['RS256'] : ['HS256'],
      issuer: config.sms.issuer,
      audience: config.sms.audience,
      clockTolerance: 30, // seconds of clock drift allowed between the SMS and portal servers
    });
    return claimsSchema.parse(payload);
  } catch (err) {
    console.warn('Rejected SMS token:', (err as Error).message);
    throw new HttpError(401, 'Could not verify your School Management System login');
  }
}

export function mapRole(smsRole: string): Role {
  const key = smsRole.toLowerCase();
  const mapped = (config.sms.roleMap[key] ?? config.sms.roleMap[smsRole] ?? key) as Role;
  if (!ROLES.includes(mapped)) throw new HttpError(403, `SMS role "${smsRole}" has no access to the lecture portal`);
  return mapped;
}

/** Creates or updates the portal user for an SMS identity, linking teacher profiles and student classes. */
export async function upsertSmsUser(claims: SmsClaims) {
  const role = mapRole(claims.role);
  const email = claims.email?.toLowerCase() || undefined;

  let classId;
  if (role === 'student' && claims.class) {
    const cls = await ClassModel.findOne({ name: claims.class, section: claims.section ?? '' }).lean()
      ?? await ClassModel.findOne({ name: claims.class }).lean();
    classId = cls?._id;
  }

  let teacherId;
  if (role === 'teacher') {
    const existing = await Teacher.findOne(email ? { email } : { name: claims.name });
    teacherId = (existing ?? (await Teacher.create({ name: claims.name, email })))._id;
  }

  return User.findOneAndUpdate(
    { smsId: claims.sub },
    {
      $set: {
        name: claims.name,
        role,
        source: 'sms',
        lastLoginAt: new Date(),
        ...(email && { email }),
        ...(claims.id_no && { smsIdNo: claims.id_no }),
        ...(classId && { class: classId }),
        ...(teacherId && { teacher: teacherId }),
      },
    },
    { upsert: true, new: true },
  );
}

/** Dev-only fake SMS login page. */
export function mockLoginPage(redirectUri: string, state: string) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!doctype html><meta charset="utf-8"><title>Mock SMS login</title>
<style>body{font:15px system-ui;max-width:360px;margin:60px auto;color:#111}label{display:block;margin:12px 0 4px}
input,select{width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;box-sizing:border-box}button{margin-top:16px;padding:9px 14px;border:0;border-radius:6px;background:#111;color:#fff}</style>
<h2>Mock School Management System</h2><p>Dev only. Pretend to log in as:</p>
<form method="post">
<input type="hidden" name="redirect_uri" value="${esc(redirectUri)}"><input type="hidden" name="state" value="${esc(state)}">
<label>SMS user id</label><input name="sub" value="sms-1001" required>
<label>Name</label><input name="name" value="Aarav Gupta" required>
<label>Email</label><input name="email" value="aarav@school.local">
<label>Role (as the SMS sends it)</label><select name="role"><option>Student</option><option>Teacher</option><option>Admin</option><option>Operator</option><option>Driver</option></select>
<label>Class (students)</label><input name="class" value="Class 9">
<label>Section (students)</label><input name="section" value="">
<label>ID no.</label><input name="id_no" value="DPS2024-0193">
<button>Log in</button></form>`;
}
