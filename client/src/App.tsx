import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import { isStaff, useAuthOptions, useMe } from './lib/hooks';
import Home from './pages/Home';
import Browse from './pages/Browse';
import ClassView from './pages/ClassView';
import LectureView from './pages/LectureView';
import Timetable from './pages/Timetable';
import MyLearning from './pages/MyLearning';
import Login from './pages/Login';
import Analytics from './pages/Analytics';
import ManageLayout from './pages/manage/ManageLayout';
import ManageLectures from './pages/manage/ManageLectures';
import LectureForm from './pages/manage/LectureForm';
import Catalog from './pages/manage/Catalog';
import Import from './pages/manage/Import';
import Users from './pages/manage/Users';
import Gaps from './pages/manage/Gaps';

type Guard = 'user' | 'staff' | 'admin';

/** Redirects to login (or home) when the current user can't see the page. */
function Protected({ need, children }: { need: Guard; children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  const location = useLocation();
  if (isLoading) return <Spinner />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if ((need === 'staff' && !isStaff(me)) || (need === 'admin' && me.role !== 'admin')) return <Navigate to="/" replace />;
  return children;
}

/** When the server requires login to browse, gate the public pages too. */
function Viewable({ children }: { children: ReactNode }) {
  const { data: opts } = useAuthOptions();
  return opts?.requireLoginToView ? <Protected need="user">{children}</Protected> : children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Viewable><Home /></Viewable>} />
        <Route path="/lectures" element={<Viewable><Browse /></Viewable>} />
        <Route path="/lectures/:id" element={<Viewable><LectureView /></Viewable>} />
        <Route path="/classes/:classId" element={<Viewable><ClassView /></Viewable>} />
        <Route path="/timetable" element={<Viewable><Timetable /></Viewable>} />
        <Route path="/me" element={<Protected need="user"><MyLearning /></Protected>} />
        <Route path="/analytics" element={<Protected need="admin"><Analytics /></Protected>} />
        <Route path="/manage" element={<Protected need="staff"><ManageLayout /></Protected>}>
          <Route index element={<Navigate to="lectures" replace />} />
          <Route path="lectures" element={<ManageLectures />} />
          <Route path="lectures/new" element={<LectureForm />} />
          <Route path="lectures/:id/edit" element={<LectureForm />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="import" element={<Import />} />
          <Route path="gaps" element={<Gaps />} />
          <Route path="users" element={<Protected need="admin"><Users /></Protected>} />
        </Route>
        <Route path="*" element={<p className="muted">Page not found.</p>} />
      </Route>
    </Routes>
  );
}
