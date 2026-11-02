import { Router, type Response, urlencoded } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User, ROLES } from '../models/index.js';
import { AUTH_COOKIE, requireRole, signToken, type AuthUser } from '../middleware/auth.js';
import { HttpError, isObjectId } from '../lib/http.js';
import { callbackUrl, loginWithSmsPassword, mockLoginPage, smsReady, upsertSmsUser, verifySmsToken } from '../lib/sms.js';
import { config, smsEnabled } from '../config.js';

export const authRouter = Router();

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

type UserLike = { _id: unknown; role: AuthUser['role']; name: string; teacher?: unknown; class?: unknown };

function startSession(res: Response, user: UserLike): AuthUser {
  const authUser: AuthUser = {
    id: String(user._id),
    role: user.role,
    name: user.name,
    teacher: user.teacher ? String(user.teacher) : undefined,
    class: user.class ? String(user.class) : undefined,
  };
  res.cookie(AUTH_COOKIE, signToken(authUser), cookieOpts);
  return authUser;
}

/** Only allow same-site relative redirects after login. */
const safeNext = (v: unknown) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : '/');

/** Tells the client which login options to show. */
authRouter.get('/options', async (_req, res) => {
  const sms = await smsReady();
  res.json({
    sms, // "continue with SMS" redirect button
    userIdLogin: sms && !config.sms.mock, // user ID + password checked by the SMS
    local: config.allowLocalLogin, // portal accounts (email + password)
    requireLoginToView: config.requireLoginToView,
  });
});

authRouter.get('/me', (req, res) => {
  res.json(req.user ?? null);
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...cookieOpts, maxAge: undefined });
  res.status(204).end();
});

/* ---------- User ID + password form ---------- */

/** Wrong-password brake per client IP, on top of the SMS's own per-user-ID limit. */
const attempts = new Map<string, { count: number; until: number }>();
function checkRate(ip: string) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (a && a.until > now && a.count >= 20) throw new HttpError(429, 'Too many attempts. Please wait a few minutes.');
  if (!a || a.until <= now) attempts.set(ip, { count: 1, until: now + 10 * 60_000 });
  else a.count++;
  if (attempts.size > 10_000) for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
}

/**
 * The SMS user ID and password are checked by the school's SMS (never stored here); a portal account
 * (created on Manage → Users, identified by email) is checked locally.
 */
authRouter.post('/login', async (req, res) => {
  const { userId, password } = z
    .object({ userId: z.string().trim().min(1, 'Enter your user ID').max(100), password: z.string().min(1, 'Enter your password').max(200) })
    .parse(req.body);
  checkRate(req.ip ?? '');

  const isPortalAccount = userId.includes('@');
  const smsConfigured = !config.sms.mock && Boolean(config.sms.passwordLoginUrl);
  if (!isPortalAccount && smsConfigured) {
    // smsReady() makes sure the SMS key is there to verify the token with
    if (!(await smsReady())) throw new HttpError(503, 'Could not reach the School Management System, please try again');
    const claims = await loginWithSmsPassword(userId, password);
    res.json(startSession(res, await upsertSmsUser(claims)));
    return;
  }

  if (!config.allowLocalLogin) throw new HttpError(403, 'Portal accounts are turned off; use your school user ID');
  const user = await User.findOne({ email: userId.toLowerCase(), source: 'local' }).select('+passwordHash');
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Wrong user ID or password');
  }
  user.lastLoginAt = new Date();
  await user.save();
  res.json(startSession(res, user));
});

/* ---------- SMS single sign-on ---------- */

const signState = (next: string) => jwt.sign({ next }, config.jwtSecret, { expiresIn: '10m' });
const readState = (state: unknown) => {
  try {
    return safeNext((jwt.verify(String(state), config.jwtSecret) as { next: string }).next);
  } catch {
    throw new HttpError(400, 'Login link expired, please try again');
  }
};

authRouter.get('/sms/login', (req, res) => {
  if (!smsEnabled()) throw new HttpError(404, 'SMS login is not configured');
  const target = new URL(config.sms.mock ? `${config.clientOrigin}/api/auth/sms/mock` : config.sms.loginUrl);
  target.searchParams.set('redirect_uri', callbackUrl());
  target.searchParams.set('state', signState(safeNext(req.query.next)));
  res.redirect(target.toString());
});

authRouter.get('/sms/callback', async (req, res) => {
  const next = readState(req.query.state);
  try {
    const claims = await verifySmsToken(String(req.query.token ?? ''));
    startSession(res, await upsertSmsUser(claims));
    res.redirect(`${config.clientOrigin}${next}`);
  } catch (err) {
    const msg = err instanceof HttpError ? err.message : 'Login failed';
    res.redirect(`${config.clientOrigin}/login?error=${encodeURIComponent(msg)}`);
  }
});

if (config.sms.mock) {
  authRouter.get('/sms/mock', (req, res) => {
    res.type('html').send(mockLoginPage(String(req.query.redirect_uri), String(req.query.state)));
  });
  authRouter.post('/sms/mock', urlencoded({ extended: false }), (req, res) => {
    const { redirect_uri, state, ...claims } = req.body as Record<string, string>;
    const token = jwt.sign(claims, config.sms.tokenSecret, {
      expiresIn: '2m',
      ...(config.sms.issuer && { issuer: config.sms.issuer }),
      ...(config.sms.audience && { audience: config.sms.audience }),
    });
    const url = new URL(redirect_uri);
    url.searchParams.set('token', token);
    url.searchParams.set('state', state);
    res.redirect(url.toString());
  });
}

/* ---------- User management (admin only) ---------- */

export const usersRouter = Router();
usersRouter.use(requireRole('admin'));

usersRouter.get('/', async (_req, res) => {
  res.json(await User.find().populate('teacher').populate('class').sort({ role: 1, name: 1 }).lean());
});

/** Creates a local account. SMS users are created automatically on first login. */
usersRouter.post('/', async (req, res) => {
  const data = z
    .object({
      name: z.string().trim().min(1),
      email: z.email(),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      role: z.enum(ROLES),
      teacher: z.string().refine(isObjectId).optional(),
      class: z.string().refine(isObjectId).optional(),
    })
    .parse(req.body);
  const user = await User.create({ ...data, source: 'local', passwordHash: await bcrypt.hash(data.password, 10) });
  res.status(201).json({ _id: user._id, name: user.name, email: user.email, role: user.role });
});

/** Admins can adjust role / linked teacher profile / class (e.g. when SMS data is incomplete). */
usersRouter.put('/:id', async (req, res) => {
  const data = z
    .object({
      role: z.enum(ROLES).optional(),
      teacher: z.union([z.string().refine(isObjectId), z.null()]).optional(),
      class: z.union([z.string().refine(isObjectId), z.null()]).optional(),
    })
    .parse(req.body);
  const user = await User.findByIdAndUpdate(req.params.id, data, { new: true });
  if (!user) throw new HttpError(404, 'User not found');
  res.json(user);
});

usersRouter.delete('/:id', async (req, res) => {
  if (req.params.id === req.user!.id) throw new HttpError(400, "You can't delete yourself");
  await User.findByIdAndDelete(req.params.id);
  res.status(204).end();
});
