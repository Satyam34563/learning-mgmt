import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, type Me } from '../lib/api';
import { useAuthOptions, useMe, useSchool, useSchoolHead } from '../lib/hooks';
import { Crest } from '../components/SchoolLogo';
import { ErrorBox } from '../components/ui';

/**
 * Same layout and colours as the SMS login: the school panel on the left (building photo under a navy wash,
 * gold frame, crest, name, motto, address), the form on the right. On phones the panel becomes a header and the
 * form a card overlapping it.
 */
export default function Login() {
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const { data: me } = useMe();
  const { data: opts } = useAuthOptions();
  const { data: school } = useSchool();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState<string | null>(params.get('error'));
  const [busy, setBusy] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  useSchoolHead('Log in');

  if (me) return <Navigate to={next} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      qc.setQueryData(['me'], await api.post<Me>('/auth/login', { userId, password, remember }));
      qc.invalidateQueries();
      navigate(next, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const checkCaps = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState?.('CapsLock') ?? false);
  const canLogIn = opts && (opts.userIdLogin || opts.local);
  const photo = school?.building_url && !photoFailed ? school.building_url : null;
  const office = [school?.phone, school?.email].filter(Boolean).join(' · ');

  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] bg-page lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:grid-rows-1">
      {/* ---------- school panel ---------- */}
      <aside className="school-band relative isolate flex flex-col items-center justify-center overflow-hidden px-6 pt-9 pb-16 text-center text-white lg:px-14 lg:py-16">
        {photo && (
          <>
            <img src={photo} alt="" className="absolute inset-0 -z-20 size-full object-cover" onError={() => setPhotoFailed(true)} />
            {/* navy wash keeps the crest and text readable while the building shows through */}
            <div className="school-band absolute inset-0 -z-10 opacity-[0.86]" />
          </>
        )}
        {/* double gold frame, as on the printed documents */}
        <div className="pointer-events-none absolute inset-[22px] hidden rounded-[18px] border border-gold/40 lg:block" />
        <div className="pointer-events-none absolute inset-[28px] hidden rounded-[14px] border border-gold/15 lg:block" />

        <div className="hidden lg:block"><Crest size={136} /></div>
        <div className="lg:hidden"><Crest size={92} /></div>
        <h1 className="mt-5 max-w-[460px] text-[clamp(19px,5vw,26px)] tracking-[0.08em] text-balance uppercase lg:mt-8 lg:text-[clamp(22px,2.2vw,30px)]">
          {school?.name ?? 'Lectures'}
        </h1>
        {school?.tagline && (
          <p className="mt-3 max-w-[420px] font-serif text-[15px] font-medium text-balance text-gold-soft italic lg:text-base">{school.tagline}</p>
        )}
        <div className="gold-rule mt-6 hidden lg:flex"><i className="size-[7px] rotate-45 bg-current" /></div>
        <ul className="mt-5 hidden max-w-[380px] space-y-2 text-[13.5px] text-white/80 lg:block">
          {school?.address && <Info icon={<PinIcon />}>{school.address}</Info>}
          {school?.phone && <Info icon={<PhoneIcon />}>{school.phone}</Info>}
        </ul>
      </aside>

      {/* ---------- form panel ---------- */}
      <main className="relative z-10 flex items-start justify-center px-4 pb-8 lg:items-center lg:px-10 lg:py-12">
        <div className="-mt-9 w-full max-w-[400px] rounded-2xl bg-card px-6 py-7 shadow-[0_12px_36px_rgb(16_28_56/0.14)] lg:mt-0 lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
          <h2 className="text-2xl font-bold lg:text-[28px]">Welcome back</h2>
          <p className="mt-1.5 mb-6 text-muted lg:mb-7">Sign in to your learning portal.</p>

          <div className="space-y-4">
            <ErrorBox error={error} />

            {canLogIn && (
              <form onSubmit={submit}>
                <Field label="User ID" htmlFor="userId">
                  <Control icon={<UserIcon />}>
                    <input
                      id="userId"
                      className="login-input"
                      placeholder="Enter your user ID"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      required
                      autoFocus
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                  </Control>
                </Field>

                <Field label="Password" htmlFor="password">
                  <Control icon={<LockIcon />}>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className="login-input pr-12"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyUp={checkCaps}
                      onKeyDown={checkCaps}
                      onBlur={() => setCapsLock(false)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute top-1/2 right-1.5 grid size-[38px] -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-muted hover:text-ink"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </Control>
                  {capsLock && <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-gold">Caps Lock is on</p>}
                </Field>

                <div className="mt-1 mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <label className="inline-flex cursor-pointer items-center gap-2 select-none">
                    <input type="checkbox" className="size-[17px] cursor-pointer accent-navy dark:accent-gold" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    Remember me
                  </label>
                  <button type="button" className="link cursor-pointer" onClick={() => setShowHelp((s) => !s)} aria-expanded={showHelp}>
                    Forgot password?
                  </button>
                </div>
                {showHelp && (
                  <p className="-mt-3 mb-5 rounded-lg bg-subtle px-3.5 py-3 text-sm text-ink">
                    This is the same password as the School Management System. Ask the school office to reset it{office ? `: ${office}` : '.'}
                  </p>
                )}

                <button
                  className="flex h-[50px] w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-navy text-[15px] font-bold tracking-[0.08em] text-white uppercase shadow-[0_6px_18px_rgb(31_58_110/0.28)] transition hover:bg-navy-deep active:translate-y-px disabled:cursor-progress disabled:opacity-75 dark:hover:bg-navy-light"
                  disabled={busy}
                >
                  {busy && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            )}

            {opts?.sms && (
              <>
                {canLogIn && (
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <div className="h-px flex-1 bg-line" />or<div className="h-px flex-1 bg-line" />
                  </div>
                )}
                {/* Full-page navigation: the server redirects to the SMS and back. Handy when already logged in there. */}
                <a className="btn min-h-[46px] w-full text-center leading-snug" href={`/api/auth/sms/login?next=${encodeURIComponent(next)}`}>
                  Continue with School Management System
                </a>
              </>
            )}

            {opts && !opts.userIdLogin && (
              <p className="text-xs text-muted">
                {opts.local
                  ? "The School Management System can't be reached right now, so only portal accounts (email address as user ID) can sign in."
                  : "The School Management System can't be reached right now. Please try again later."}
              </p>
            )}
          </div>

          <div className="mt-6 space-y-2 border-t border-line pt-5 text-center text-[13px] text-muted">
            <p>Use your School Management System user ID and password. Passwords are issued by the school authority.</p>
            {opts && !opts.requireLoginToView && (
              <p><Link to="/" className="link">Browse lectures without signing in →</Link></p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="mb-[18px]">
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
    </div>
  );
}

function Control({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">{icon}</span>
      {children}
    </div>
  );
}

function Info({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start justify-center gap-2 text-left">
      <span className="mt-0.5 shrink-0 text-gold">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

/* ---------- icons (stroke, 18px) ---------- */
const svg = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const UserIcon = () => <svg {...svg}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
const LockIcon = () => <svg {...svg}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
const EyeIcon = () => <svg {...svg} width={20} height={20}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
const EyeOffIcon = () => <svg {...svg} width={20} height={20}><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6" /></svg>;
const PinIcon = () => <svg {...svg} width={15} height={15}><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>;
const PhoneIcon = () => <svg {...svg} width={15} height={15}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>;
