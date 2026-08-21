import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BookMarked,
  PlayCircle,
  PenLine,
  ClipboardList,
  Trophy,
  KeyRound,
  Award,
  User,
  Sparkles,
  Wand2,
  ArrowLeft,
  Bookmark,
  LogOut,
  Brain,
  AlertCircle,
  Gauge,
  Search,
  Map,
  Bell,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { studentApi } from '../api/client';

const nav = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/readiness', label: 'Readiness', icon: Gauge },
  { to: '/dashboard/diagnosis', label: 'Diagnosis', icon: Search },
  { to: '/dashboard/exam-guide', label: 'Crack Exam', icon: Map },
  { to: '/dashboard/diagnostic', label: 'Diagnostic', icon: Brain },
  { to: '/dashboard/mistakes', label: 'Mistake Book', icon: AlertCircle },
  { to: '/dashboard/courses', label: 'My Courses', icon: BookMarked },
  { to: '/dashboard/bookmarks', label: 'Bookmarks', icon: Bookmark },
  { to: '/dashboard/continue', label: 'Continue Watching', icon: PlayCircle },
  { to: '/dashboard/practice', label: 'Practice Questions', icon: PenLine },
  { to: '/dashboard/mocks', label: 'Mock Tests', icon: ClipboardList },
  { to: '/dashboard/live', label: 'Live Exams', icon: Trophy },
  { to: '/dashboard/results', label: 'Results', icon: KeyRound },
  { to: '/dashboard/certificates', label: 'Certificates', icon: Award },
  { to: '/dashboard/profile', label: 'Profile', icon: User },
  { to: '/dashboard/ai-tutor', label: 'AI Coach', icon: Sparkles },
  { to: '/dashboard/ai-generator', label: 'AI Generator', icon: Wand2 },
];

export default function DashboardLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notes, setNotes] = useState([]);
  const [unread, setUnread] = useState(0);
  const [openNotes, setOpenNotes] = useState(false);
  const notesRef = useRef(null);

  async function loadNotes() {
    if (!user || user.role !== 'student') return;
    try {
      const data = await studentApi.notifications();
      setNotes(data.items || []);
      setUnread(data.unread || 0);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadNotes();
    if (user?.role !== 'student') return undefined;
    const t = setInterval(loadNotes, 25000);
    return () => clearInterval(t);
  }, [user?.id, user?.role]);

  useEffect(() => {
    function onDoc(e) {
      if (notesRef.current && !notesRef.current.contains(e.target)) setOpenNotes(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand">
        <div className="animate-pulse-soft text-forest">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const path = location.pathname;
  const onOnboarding = path.startsWith('/dashboard/onboarding');
  const onDiagnostic = path.startsWith('/dashboard/diagnostic');
  if (user.role === 'student' && !user.onboarding_done && !onOnboarding) {
    return <Navigate to="/dashboard/onboarding" replace />;
  }
  if (
    user.role === 'student' &&
    user.onboarding_done &&
    !user.diagnostic_done &&
    !onDiagnostic &&
    !onOnboarding
  ) {
    return <Navigate to="/dashboard/diagnostic" replace />;
  }

  function signOut() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-sand lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="flex flex-col border-b border-forest/10 bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-4">
          <Link to="/" className="font-display text-xl text-forest">
            EduGate
          </Link>
          <Link to="/" className="rounded-lg p-2 text-slate hover:bg-mint lg:hidden">
            <ArrowLeft size={18} />
          </Link>
        </div>
        <div className="px-4 pb-3">
          <div className="rounded-xl bg-forest px-3 py-3 text-sand">
            <div className="text-xs text-mint/70">Signed in as</div>
            <div className="mt-0.5 truncate text-sm font-medium">{user.name}</div>
            {user.target_exam && (
              <div className="mt-1 text-xs text-amber-soft">Target: {user.target_exam}</div>
            )}
            {(user.xp != null || user.plan) && (
              <div className="mt-1 text-xs text-mint/80 capitalize">
                {user.plan || 'free'} plan
              </div>
            )}
          </div>
        </div>
        <nav className="flex flex-1 gap-1 overflow-x-auto px-2 pb-3 lg:flex-col lg:overflow-visible">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  isActive ? 'bg-mint font-medium text-forest' : 'text-slate hover:bg-mint/50 hover:text-forest'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-forest/10 p-3">
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-coral/30 bg-coral/10 px-3 py-2.5 text-sm font-semibold text-coral hover:bg-coral/20"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="p-4 lg:p-8">
        {user.role === 'student' && (
          <div className="mb-4 flex justify-end">
            <div className="relative" ref={notesRef}>
              <button
                type="button"
                onClick={() => {
                  setOpenNotes((v) => !v);
                  loadNotes();
                }}
                className="relative rounded-xl border border-forest/10 bg-white p-2.5 text-forest shadow-sm hover:bg-mint/40"
                aria-label="Notifications"
              >
                <Bell size={18} />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-coral px-1 text-center text-[10px] font-bold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              {openNotes && (
                <div className="absolute right-0 z-30 mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-forest/10 bg-white p-2 shadow-lg">
                  <div className="mb-2 flex items-center justify-between px-2 py-1">
                    <span className="text-sm font-semibold text-forest">Exam alerts</span>
                    {unread > 0 && (
                      <button
                        type="button"
                        className="text-xs text-teal hover:underline"
                        onClick={async () => {
                          await studentApi.markAllNotificationsRead();
                          await loadNotes();
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  {!notes.length && (
                    <p className="px-2 py-6 text-center text-sm text-slate">No exam notifications yet.</p>
                  )}
                  <ul className="max-h-80 space-y-1 overflow-y-auto">
                    {notes.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                            n.is_read ? 'text-slate' : 'bg-mint/40 text-forest'
                          }`}
                          onClick={async () => {
                            if (!n.is_read) await studentApi.markNotificationRead(n.id);
                            setOpenNotes(false);
                            navigate(n.link || '/dashboard/live');
                            loadNotes();
                          }}
                        >
                          <div className="font-medium">{n.title}</div>
                          <div className="mt-0.5 text-xs leading-snug opacity-80">{n.body}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
