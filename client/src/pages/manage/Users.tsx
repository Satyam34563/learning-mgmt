import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, className, formatDate, type Role, type SchoolClass, type Teacher } from '../../lib/api';
import { useAuthOptions, useClasses, useMe, useTeachers } from '../../lib/hooks';
import { ErrorBox, PageHeader, Spinner } from '../../components/ui';

interface UserRow {
  _id: string;
  name: string;
  email?: string;
  role: Role;
  source: 'local' | 'sms';
  teacher?: Teacher | null;
  class?: SchoolClass | null;
  lastLoginAt?: string;
}

export default function Users() {
  const { data: me } = useMe();
  const { data: opts } = useAuthOptions();
  const { data: teachers } = useTeachers();
  const { data: classes } = useClasses();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api.get<UserRow[]>('/users') });
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] });
  const update = useMutation({ mutationFn: ({ id, body }: { id: string; body: unknown }) => api.put(`/users/${id}`, body), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => api.del(`/users/${id}`), onSuccess: refresh });

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={opts?.sms ? 'People who sign in with the School Management System appear here automatically. You can adjust their role, linked teacher profile, or class.' : undefined}
      />
      <ErrorBox error={update.error ?? remove.error} />
      {isLoading ? <Spinner /> : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th>Teacher profile / class</th><th className="hidden md:table-cell">Sign-in</th><th className="hidden md:table-cell">Last login</th><th /></tr></thead>
            <tbody>
              {data?.map((u) => (
                <tr key={u._id}>
                  <td>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs muted">{u.email}</div>
                  </td>
                  <td>
                    <select className="input w-auto" value={u.role} disabled={u._id === me?.id} onChange={(e) => update.mutate({ id: u._id, body: { role: e.target.value } })}>
                      <option value="admin">Admin</option>
                      <option value="teacher">Teacher</option>
                      <option value="student">Student</option>
                    </select>
                  </td>
                  <td>
                    {u.role === 'teacher' && (
                      <select className="input w-auto" value={u.teacher?._id ?? ''} onChange={(e) => update.mutate({ id: u._id, body: { teacher: e.target.value || null } })}>
                        <option value="">Not linked</option>
                        {teachers?.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                      </select>
                    )}
                    {u.role === 'student' && (
                      <select className="input w-auto" value={u.class?._id ?? ''} onChange={(e) => update.mutate({ id: u._id, body: { class: e.target.value || null } })}>
                        <option value="">No class</option>
                        {classes?.map((c) => <option key={c._id} value={c._id}>{className(c)}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="hidden md:table-cell"><span className="chip">{u.source === 'sms' ? 'SMS' : 'Local'}</span></td>
                  <td className="hidden muted md:table-cell">{formatDate(u.lastLoginAt) || '—'}</td>
                  <td className="text-right">
                    {u._id !== me?.id && <button className="btn-danger" onClick={() => confirm(`Remove ${u.name}?`) && remove.mutate(u._id)}>Remove</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {opts?.local && <NewLocalUser onCreated={refresh} />}
    </div>
  );
}

function NewLocalUser({ onCreated }: { onCreated: () => void }) {
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'teacher' as Role });
  const create = useMutation({
    mutationFn: () => api.post('/users', f),
    onSuccess: () => {
      setF({ name: '', email: '', password: '', role: 'teacher' });
      onCreated();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };
  return (
    <form onSubmit={submit} className="card mt-8 max-w-3xl space-y-3 p-5">
      <h2 className="text-base">Add a local account</h2>
      <p className="text-xs muted">For people who aren't in the School Management System, or for testing.</p>
      <ErrorBox error={create.error} />
      <div className="grid gap-2 sm:grid-cols-4">
        <input className="input" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <input className="input" type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <input className="input" type="password" placeholder="Password (8+)" minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
        <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button className="btn-primary" disabled={create.isPending}>Create account</button>
    </form>
  );
}
