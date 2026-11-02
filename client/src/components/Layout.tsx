import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { isStaff, portalTitle, useMe, useSchool } from '../lib/hooks';
import SchoolLogo from './SchoolLogo';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2.5 py-1.5 text-sm ${isActive ? 'bg-zinc-100 font-medium dark:bg-zinc-800' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`;

export default function Layout() {
  const { data: me } = useMe();
  const { data: school } = useSchool();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  // Tab title and icon follow the school
  useEffect(() => {
    document.title = portalTitle(school);
    if (school?.logo_url) {
      const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.head.appendChild(document.createElement('link'));
      icon.rel = 'icon';
      icon.href = school.logo_url;
    }
  }, [school]);

  async function logout() {
    await api.post('/auth/logout');
    qc.clear();
    navigate('/');
  }

  function search(e: FormEvent) {
    e.preventDefault();
    navigate(`/lectures?q=${encodeURIComponent(q.trim())}`);
    setOpen(false);
  }

  const links = (
    <>
      <NavLink to="/lectures" end className={navCls}>Browse</NavLink>
      <NavLink to="/timetable" className={navCls}>Timetable</NavLink>
      {me && <NavLink to="/me" className={navCls}>My learning</NavLink>}
      {isStaff(me) && <NavLink to="/manage" className={navCls}>Manage</NavLink>}
      {me?.role === 'admin' && <NavLink to="/analytics" className={navCls}>Analytics</NavLink>}
    </>
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2" title={school?.name ?? undefined}>
            <SchoolLogo />
            <span className="truncate font-semibold">{school?.short_name || school?.name || 'Lectures'}</span>
            {(school?.short_name || school?.name) && <span className="hidden text-sm muted sm:inline">Lectures</span>}
          </Link>
          <nav className="hidden items-center gap-1 md:flex">{links}</nav>
          <form onSubmit={search} className="ml-auto hidden w-64 sm:block">
            <input className="input" placeholder="Search lectures…" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            {me ? (
              <>
                <span className="hidden text-sm text-zinc-500 lg:inline">
                  {me.name} · <span className="capitalize">{me.role}</span>
                </span>
                <button className="btn" onClick={logout}>Log out</button>
              </>
            ) : (
              <Link className="btn-primary" to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}>
                Log in
              </Link>
            )}
            <button className="btn md:hidden" aria-label="Menu" onClick={() => setOpen((o) => !o)}>☰</button>
          </div>
        </div>
        {open && (
          <div className="flex flex-col gap-1 border-t border-zinc-200 px-4 py-3 md:hidden dark:border-zinc-800" onClick={() => setOpen(false)}>
            <form onSubmit={search} className="mb-2 sm:hidden" onClick={(e) => e.stopPropagation()}>
              <input className="input" placeholder="Search lectures…" value={q} onChange={(e) => setQ(e.target.value)} />
            </form>
            {links}
          </div>
        )}
      </header>
      <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      {school?.name && (
        <footer className="border-t border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-5 text-xs muted">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{school.name}</span>
            {school.address && <span>{school.address}</span>}
            {school.phone && <a href={`tel:${school.phone}`} className="hover:underline">{school.phone}</a>}
            {school.email && <a href={`mailto:${school.email}`} className="hover:underline">{school.email}</a>}
            {school.website && (
              <a href={/^https?:\/\//.test(school.website) ? school.website : `https://${school.website}`} target="_blank" rel="noreferrer" className="hover:underline">
                {school.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
