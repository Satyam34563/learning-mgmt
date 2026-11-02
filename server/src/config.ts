import fs from 'node:fs';
import path from 'node:path';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

const bool = (name: string, fallback: boolean) => {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v === 'true' || v === '1';
};

const isProd = process.env.NODE_ENV === 'production';

export const config = {
  // API_PORT wins over PORT so tools that export PORT for the web dev server don't clash.
  port: Number(process.env.API_PORT ?? process.env.PORT ?? 4000),
  isProd,
  mongoUri: required('MONGO_URI'),
  jwtSecret: required('JWT_SECRET'),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? 'uploads'),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 25),
  /** When true, anonymous visitors can't browse lectures at all. */
  requireLoginToView: bool('REQUIRE_LOGIN_TO_VIEW', false),
  /** Email/password accounts stored in this portal. Keep on for dev; usually off once SMS login works. */
  allowLocalLogin: bool('ALLOW_LOCAL_LOGIN', !isProd),

  sms: {
    /** SMS page that authenticates the user, then redirects to `<redirect_uri>?token=<jwt>`. */
    loginUrl: process.env.SMS_LOGIN_URL ?? '',
    /** Verify the SMS token with a shared secret (HS256) or a PEM public key (RS256). */
    tokenSecret: process.env.SMS_TOKEN_SECRET ?? '',
    tokenPublicKey: process.env.SMS_TOKEN_PUBLIC_KEY_FILE
      ? fs.readFileSync(process.env.SMS_TOKEN_PUBLIC_KEY_FILE, 'utf8')
      : (process.env.SMS_TOKEN_PUBLIC_KEY?.replace(/\\n/g, '\n') ?? ''),
    issuer: process.env.SMS_TOKEN_ISSUER || undefined,
    audience: process.env.SMS_TOKEN_AUDIENCE || undefined,
    /** Maps SMS role names to portal roles, e.g. {"operator":"admin"}. Unmapped names pass through as-is. */
    roleMap: JSON.parse(process.env.SMS_ROLE_MAP || '{}') as Record<string, string>,
    /** Dev only: serve a fake SMS login page at /api/auth/sms/mock so SSO can be tested end to end. */
    mock: bool('SMS_MOCK', false) && !isProd,
  },
};

export const smsEnabled = () => Boolean((config.sms.loginUrl || config.sms.mock) && (config.sms.tokenSecret || config.sms.tokenPublicKey));
