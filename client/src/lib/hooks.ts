import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs, type Chapter, type Me, type SchoolBranding, type SchoolClass, type Subject, type Teacher } from './api';

export interface AuthOptions {
  sms: boolean;
  userIdLogin: boolean;
  local: boolean;
  requireLoginToView: boolean;
}

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => api.get<Me | null>('/auth/me'), staleTime: 5 * 60_000 });
export const useAuthOptions = () =>
  useQuery({ queryKey: ['auth-options'], queryFn: () => api.get<AuthOptions>('/auth/options'), staleTime: Infinity });

export const useSchool = () =>
  useQuery({ queryKey: ['school'], queryFn: () => api.get<SchoolBranding>('/school'), staleTime: 10 * 60_000 });

/** "DLCS Lectures", or just "Lectures" until the school is known. */
export const portalTitle = (s?: SchoolBranding) => [s?.short_name || s?.name, 'Lectures'].filter(Boolean).join(' ');

export const isStaff = (me?: Me | null) => me?.role === 'admin' || me?.role === 'teacher';

const taxonomy = { staleTime: 5 * 60_000 };
export const useClasses = () => useQuery({ queryKey: ['classes'], queryFn: () => api.get<SchoolClass[]>('/classes'), ...taxonomy });
export const useSubjects = () => useQuery({ queryKey: ['subjects'], queryFn: () => api.get<Subject[]>('/subjects'), ...taxonomy });
export const useTeachers = () => useQuery({ queryKey: ['teachers'], queryFn: () => api.get<Teacher[]>('/teachers'), ...taxonomy });
export const useChapters = (filter: { subject?: string; class?: string } = {}) =>
  useQuery({
    queryKey: ['chapters', filter],
    queryFn: () => api.get<Chapter[]>(`/chapters${qs(filter)}`),
    ...taxonomy,
  });

export interface Stats {
  lectures: number;
  classes: number;
  subjects: number;
  teachers: number;
  byClass: Record<string, number>;
  bySubject: Record<string, number>;
}
export const useStats = () => useQuery({ queryKey: ['stats'], queryFn: () => api.get<Stats>('/stats') });

/** Bookmark ids for the logged-in user, plus a toggle. */
export function useBookmarks() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const ids = useQuery({
    queryKey: ['bookmark-ids'],
    queryFn: () => api.get<string[]>('/me/bookmarks/ids'),
    enabled: !!me,
  });
  const toggle = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) =>
      on ? api.put(`/me/bookmarks/${id}`) : api.del(`/me/bookmarks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookmark-ids'] });
      qc.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
  return { enabled: !!me, ids: new Set(ids.data ?? []), toggle: (id: string, on: boolean) => toggle.mutate({ id, on }) };
}
