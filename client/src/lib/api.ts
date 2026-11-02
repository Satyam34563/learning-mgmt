export type Role = 'admin' | 'teacher' | 'student';

export interface Me {
  id: string;
  role: Role;
  name: string;
  teacher?: string;
  class?: string;
}

export interface SchoolClass {
  _id: string;
  name: string;
  section?: string;
  order: number;
}
export interface Subject {
  _id: string;
  name: string;
  code?: string;
  color: string;
  icon?: string;
}
export interface Chapter {
  _id: string;
  subject: Subject | string;
  classes: string[] | SchoolClass[];
  number: number;
  title: string;
}
export interface Teacher {
  _id: string;
  name: string;
  email?: string;
  subjects: Subject[] | string[];
}
export interface MetaPair {
  key: string;
  value: string;
}
export interface Resource {
  label: string;
  url: string;
  kind: 'link' | 'file';
  size?: number;
}
export interface Lecture {
  _id: string;
  title: string;
  description: string;
  classes: SchoolClass[];
  subject: Subject;
  chapter?: Chapter | null;
  teacher?: Teacher | null;
  videoUrl: string;
  resources: Resource[];
  durationMinutes?: number;
  lectureDate?: string;
  period?: number;
  tags: string[];
  meta: MetaPair[];
  status: 'draft' | 'published';
  views: number;
  createdAt: string;
}
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}
export interface Progress {
  _id: string;
  lecture: Lecture;
  positionSeconds: number;
  durationSeconds: number;
  completed: boolean;
  updatedAt: string;
}
export interface Bookmark {
  _id: string;
  lecture: Lecture;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`/api${url}`, {
    method,
    credentials: 'include',
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? res.statusText);
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body),
  del: <T = void>(url: string) => request<T>('DELETE', url),
};

/** Builds a query string, skipping empty values. */
export function qs(params: Record<string, string | number | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
}

export const className = (c: Pick<SchoolClass, 'name' | 'section'>) => (c.section ? `${c.name} ${c.section}` : c.name);

export const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const formatBytes = (n?: number) =>
  !n ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
