import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { isStaff, useMe, useSchool, useSchoolHead } from '../lib/hooks';
import { Crest } from './SchoolLogo';

// On the navy header: white text, a gold underline for the current page.
const navCls = ({ isActive }: { isActive: boolean }) =>
  `relative px-3 py-2 text-sm font-medium transition-colors after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full ${
    isActive ? 'text-white after:bg-gold' : 'text-white/70 hover:text-white after:bg-transparent'
  }`;

export default function Layout() {
  const { data: me } = useMe();
  const { data: school } = useSchool();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  useSchoolHead();

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

  const searchBox = (
    <input
      className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-[16px] text-white outline-none sm:text-sm placeholder:text-white/55 focus:border-gold focus:bg-white/15"
      placeholder="Search lectures…"
      value={q}
      onChange={(e) => setQ(e.target.value)}
    />
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="school-band sticky top-0 z-20 text-white shadow-[0_2px_12px_rgb(20_40_82/0.25)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-5 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-3" title={school?.name ?? undefined}>
            <Crest size={38} glow={false} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-serif text-[17px] font-bold tracking-wide">{school?.short_name || school?.name || 'Lectures'}</span>
              <span className="block text-[11px] font-semibold tracking-[0.18em] text-gold-soft uppercase">Learning portal</span>
            </span>
          </Link>
          <nav className="hidden h-16 items-center md:flex">{links}</nav>
          <form onSubmit={search} className="ml-auto hidden w-60 sm:block">{searchBox}</form>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            {me ? (
              <>
                <span className="hidden text-right text-xs leading-tight lg:block">
                  <span className="block font-semibold text-white">{me.name}</span>
                  <span className="text-white/60 capitalize">{me.role}</span>
                </span>
                <button className="btn-base border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={logout}>Log out</button>
              </>
            ) : (
              <Link className="btn-base border-gold bg-gold text-navy-deep hover:bg-gold-soft" to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}>
                Log in
              </Link>
            )}
            <button className="btn-base border-white/20 bg-white/10 text-white md:hidden" aria-label="Menu" onClick={() => setOpen((o) => !o)}>☰</button>
          </div>
        </div>
        {open && (
          <div className="flex flex-col gap-1 border-t border-white/10 px-4 py-3 md:hidden [&>a]:py-3" onClick={() => setOpen(false)}>
            <form onSubmit={search} className="mb-2 sm:hidden" onClick={(e) => e.stopPropagation()}>{searchBox}</form>
            {links}
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="bg-navy-deep text-white/70">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center">
          <p className="font-serif text-base font-bold tracking-[0.08em] text-white uppercase">{school?.name ?? 'Lectures'}</p>
          {school?.tagline && <p className="mt-1 font-serif text-sm text-gold-soft italic">{school.tagline}</p>}
          <div className="gold-rule mt-4"><i className="size-1.5 rotate-45 bg-current" /></div>
          <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs">
            {school?.address && <span>{school.address}</span>}
            {school?.phone && <a href={`tel:${school.phone}`} className="hover:text-white">{school.phone}</a>}
            {school?.email && <a href={`mailto:${school.email}`} className="hover:text-white">{school.email}</a>}
            {school?.website && (
              <a href={/^https?:\/\//.test(school.website) ? school.website : `https://${school.website}`} target="_blank" rel="noreferrer" className="hover:text-white">
                {school.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
