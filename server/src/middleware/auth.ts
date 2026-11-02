import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { Role } from '../models/index.js';
import { HttpError } from '../lib/http.js';

export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  teacher?: string;
  class?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const AUTH_COOKIE = 'lp_token';

export function signToken(user: AuthUser, expiresIn: jwt.SignOptions['expiresIn'] = '7d') {
  return jwt.sign(user, config.jwtSecret, { expiresIn });
}

/** Attaches req.user when a valid token cookie is present; never rejects. */
export function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (token) {
    try {
      const { id, role, name, teacher, class: cls } = jwt.verify(token, config.jwtSecret) as AuthUser;
      req.user = { id, role, name, teacher, class: cls };
    } catch {
      // expired or tampered token: treat as anonymous
    }
  }
  next();
}

/** Blocks anonymous access to content when REQUIRE_LOGIN_TO_VIEW is on. */
export function viewGate(req: Request, _res: Response, next: NextFunction) {
  if (config.requireLoginToView && !req.user) return next(new HttpError(401, 'Please log in'));
  next();
}

/** Staff = anyone who can manage content. */
export const isStaff = (user?: AuthUser) => user?.role === 'admin' || user?.role === 'teacher';

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Please log in'));
    if (roles.length && !roles.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have permission to do that'));
    }
    next();
  };
}
