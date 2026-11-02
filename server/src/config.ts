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

/** SMS public key from SMS_TOKEN_PUBLIC_KEY_FILE or inline SMS_TOKEN_PUBLIC_KEY. A missing file disables SMS login instead of crashing. */
function readPublicKey() {
  const file = process.env.SMS_TOKEN_PUBLIC_KEY_FILE;
  if (file) {
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
    console.warn(`SMS public key not found at ${file}; SMS login is disabled until it's there`);
    return '';
  }
  return process.env.SMS_TOKEN_PUBLIC_KEY?.replace(/\\n/g, '\n') ?? '';
}

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

  sms: smsConfig(),
};

/**
 * Everything SMS login needs can be derived from one address. A portal at
 * https://dlcs.lectures.managemyschools.in talks to https://dlcs.managemyschools.in unless SMS_BASE_URL says otherwise.
 */
function smsConfig() {
  const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
  const derived = new URL(clientOrigin).hostname.match(/^([^.]+)\.lectures\.(.+)$/);
  const baseUrl = (process.env.SMS_BASE_URL || (derived ? `https://${derived[1]}.${derived[2]}` : '')).replace(/\/$/, '');
  const mock = bool('SMS_MOCK', false) && !isProd;
  return {
    baseUrl,
    /** SMS page that authenticates the user, then redirects to `<redirect_uri>?token=<jwt>`. */
    loginUrl: process.env.SMS_LOGIN_URL || (baseUrl && `${baseUrl}/sso/lectures`),
    /** RS256 public key: a file, inline PEM, or (default) fetched from the SMS. */
    tokenPublicKey: readPublicKey(),
    publicKeyUrl: process.env.SMS_TOKEN_PUBLIC_KEY_URL || (baseUrl && `${baseUrl}/sso/lectures/public-key`),
    /** Shared secret (HS256). Only the dev mock uses it. */
    tokenSecret: process.env.SMS_TOKEN_SECRET ?? '',
    // The SMS signs iss = its own domain and aud = this portal's origin.
    issuer: process.env.SMS_TOKEN_ISSUER || (!mock && baseUrl ? new URL(baseUrl).host : undefined),
    audience: process.env.SMS_TOKEN_AUDIENCE || (!mock && baseUrl ? clientOrigin : undefined),
    /** Maps SMS role names to portal roles, e.g. {"operator":"admin"}. Unmapped names pass through as-is. */
    roleMap: JSON.parse(process.env.SMS_ROLE_MAP || '{}') as Record<string, string>,
    /** Dev only: serve a fake SMS login page at /api/auth/sms/mock so SSO can be tested end to end. */
    mock,
  };
}

export const smsEnabled = () =>
  config.sms.mock
    ? Boolean(config.sms.tokenSecret)
    : Boolean(config.sms.loginUrl && (config.sms.tokenPublicKey || config.sms.publicKeyUrl));
