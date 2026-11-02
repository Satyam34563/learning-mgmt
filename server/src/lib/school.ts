import { config } from '../config.js';

/** Public school details shown across the portal (header, login page, footer, page title). */
export interface SchoolBranding {
  name: string | null;
  short_name: string | null;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  building_url: string | null;
}

const TTL_MS = 10 * 60 * 1000;
const RETRY_MS = 60 * 1000;
let cached: { data: SchoolBranding | null; at: number; ok: boolean } | undefined;

/** Fetches from the school's SMS (cached 10 min); env SCHOOL_* values fill gaps or replace it entirely. */
export async function getSchoolBranding(): Promise<SchoolBranding> {
  const fresh = cached && Date.now() - cached.at < (cached.ok ? TTL_MS : RETRY_MS);
  if (!fresh && config.sms.schoolUrl) {
    try {
      const res = await fetch(config.sms.schoolUrl, { signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cached = { data: (await res.json()) as SchoolBranding, at: Date.now(), ok: true };
    } catch (err) {
      console.warn(`Could not fetch school branding from ${config.sms.schoolUrl}:`, (err as Error).message);
      // keep showing the last good branding while the SMS is unreachable
      cached = { data: cached?.data ?? null, at: Date.now(), ok: false };
    }
  }
  const sms = cached?.data;
  const pick = (override: string, value?: string | null) => override || value?.trim() || null;
  return {
    name: pick(config.school.name, sms?.name),
    short_name: pick(config.school.shortName, sms?.short_name),
    tagline: sms?.tagline ?? null,
    address: sms?.address ?? null,
    phone: sms?.phone ?? null,
    email: sms?.email ?? null,
    website: sms?.website ?? null,
    logo_url: pick(config.school.logoUrl, sms?.logo_url),
    building_url: sms?.building_url ?? null,
  };
}

/* The school logo as the site icon, served from the portal itself so the browser tab, bookmarks and
   home-screen shortcuts show it from the first load. Cached in memory; falls back to a neutral icon. */
const FALLBACK_ICON = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#18181b"/><path d="M12 9.5v13l11-6.5z" fill="#fff"/></svg>',
);
const MAX_ICON_BYTES = 2 * 1024 * 1024;
let icon: { body: Buffer; type: string; url: string | null; at: number } | undefined;

export async function getSchoolIcon(): Promise<{ body: Buffer; type: string }> {
  const { logo_url: url } = await getSchoolBranding();
  if (icon && icon.url === url && Date.now() - icon.at < TTL_MS) return icon;
  if (url) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const type = res.headers.get('content-type') ?? '';
      const body = Buffer.from(await res.arrayBuffer());
      if (!res.ok || !type.startsWith('image/') || body.length > MAX_ICON_BYTES) throw new Error(`HTTP ${res.status} ${type}`);
      icon = { body, type, url, at: Date.now() };
      return icon;
    } catch (err) {
      console.warn(`Could not fetch school logo from ${url}:`, (err as Error).message);
      if (icon?.url === url) return icon; // keep the last good copy
    }
  }
  return { body: FALLBACK_ICON, type: 'image/svg+xml' };
}
