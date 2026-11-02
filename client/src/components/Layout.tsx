import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { isStaff, useMe } from '../lib/hooks';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2.5 py-1.5 text-sm ${isActive ? 'bg-zinc-100 font-medium dark:bg-zinc-800' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`;

export default function Layout() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

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
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
              <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor"><path d="M5 3.5v9l7-4.5z" /></svg>
            </span>
            Lectures
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
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
