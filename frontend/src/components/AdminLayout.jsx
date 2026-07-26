import { NavLink, Outlet, Navigate, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Library,
  FileText,
  Database,
  Sparkles,
  ClipboardList,
  BarChart3,
  Settings,
  ArrowLeft,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const nav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/students', label: 'Students', icon: Users },
  { to: '/admin/courses', label: 'Courses', icon: BookOpen },
  { to: '/admin/materials', label: 'Content', icon: Library },
  { to: '/admin/questions', label: 'Question Bank', icon: Database },
  { to: '/admin/ai-exam', label: 'AI Exam LLM', icon: Sparkles },
  { to: '/admin/exams', label: 'Exams & Mocks', icon: ClipboardList },
  { to: '/admin/results', label: 'Results', icon: FileText },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const { user, loading, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand">
        <div className="animate-pulse-soft text-forest">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  function signOut() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-[#f0ebe3] lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="flex flex-col bg-ink text-sand lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <div className="font-display text-lg">EduGate</div>
            <div className="text-xs text-mint/60">Admin Panel</div>
          </div>
          <Link to="/" className="rounded-lg p-2 hover:bg-white/10 lg:hidden">
            <ArrowLeft size={18} />
          </Link>
        </div>
        <div className="px-4 pb-2">
          <div className="rounded-lg bg-white/10 px-3 py-2 text-xs text-mint/80">
            <div className="truncate font-medium text-sand">{user.name}</div>
            <div className="truncate text-mint/50">{user.email}</div>
          </div>
        </div>
        <nav className="flex flex-1 gap-1 overflow-x-auto px-2 pb-4 lg:flex-col">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  isActive ? 'bg-teal text-sand' : 'text-mint/70 hover:bg-white/10 hover:text-sand'
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 p-3">
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-coral/90 px-3 py-2.5 text-sm font-semibold text-white hover:bg-coral"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </div>
    </div>
  );
}
