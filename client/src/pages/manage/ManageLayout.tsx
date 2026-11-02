import { NavLink, Outlet } from 'react-router-dom';
import { useMe } from '../../lib/hooks';

const tab = ({ isActive }: { isActive: boolean }) =>
  `-mb-px shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${isActive ? 'border-accent font-semibold text-accent' : 'border-transparent muted hover:text-ink'}`;

export default function ManageLayout() {
  const { data: me } = useMe();
  return (
    <div>
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        <NavLink to="/manage/lectures" className={tab}>Lectures</NavLink>
        <NavLink to="/manage/catalog" className={tab}>Classes & subjects</NavLink>
        <NavLink to="/manage/import" className={tab}>Bulk import</NavLink>
        <NavLink to="/manage/gaps" className={tab}>Missing lectures</NavLink>
        {me?.role === 'admin' && <NavLink to="/manage/users" className={tab}>Users</NavLink>}
      </div>
      <Outlet />
    </div>
  );
}
