import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { BookOpen, Menu, X, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Home' },
  { to: '/courses', label: 'Courses' },
  { to: '/study-materials', label: 'Study Materials' },
  { to: '/video-lectures', label: 'Videos' },
  { to: '/practice', label: 'Practice' },
  { to: '/mock-tests', label: 'Mock Tests' },
  { to: '/previous-papers', label: 'Previous Papers' },
  { to: '/current-affairs', label: 'Current Affairs' },
  { to: '/ai-tutor', label: 'AI Tutor' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export default function PublicLayout() {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-forest/10 bg-sand/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-amber-soft">
              <BookOpen size={18} />
            </span>
            <span className="font-display text-xl tracking-tight text-forest">EduGate</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {links.slice(0, 7).map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `rounded-lg px-2.5 py-1.5 text-sm transition ${
                    isActive ? 'bg-mint text-forest font-medium' : 'text-slate hover:text-forest'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to={user && !isAdmin ? '/dashboard/ai-tutor' : '/ai-tutor'}
              className="hidden items-center gap-1.5 rounded-full bg-amber/15 px-3 py-1.5 text-sm font-medium text-forest sm:inline-flex"
            >
              <Sparkles size={14} className="text-amber" />
              AI Tutor
            </Link>
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate(isAdmin ? '/admin' : '/dashboard')}
                  className="rounded-lg bg-forest px-3 py-2 text-sm font-medium text-white"
                >
                  {isAdmin ? 'Admin' : 'Dashboard'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  className="rounded-lg border border-forest/15 bg-white px-3 py-2 text-sm font-medium text-forest hover:bg-mint"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/login" className="rounded-lg bg-forest px-3 py-2 text-sm font-medium text-white">
                Login
              </Link>
            )}
            <button
              type="button"
              className="lg:hidden rounded-lg p-2 text-forest"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Close menu' : 'Open menu'}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-forest/10 bg-sand px-4 py-3 lg:hidden">
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === '/'}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm text-forest hover:bg-mint"
                >
                  {l.label}
                </NavLink>
              ))}
              {user && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    logout();
                    navigate('/login');
                  }}
                  className="mt-2 rounded-lg border border-coral/30 px-3 py-2 text-left text-sm font-medium text-coral hover:bg-coral/10"
                >
                  Sign out
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-forest/10 bg-forest text-sand">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="font-display text-2xl">EduGate</div>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-mint/80">
              AI-powered learning ecosystem for RRB, SSC, Banking, UPSC and State exams — learn, practice, and take CBT mocks in one place.
            </p>
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-wider text-amber-soft">Learn</div>
            <ul className="mt-3 space-y-2 text-sm text-mint/80">
              <li><Link to="/courses">Courses</Link></li>
              <li><Link to="/video-lectures">Video Lectures</Link></li>
              <li>
                <Link to={user && !isAdmin ? '/dashboard/ai-tutor' : '/ai-tutor'}>AI Tutor</Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-wider text-amber-soft">Practice</div>
            <ul className="mt-3 space-y-2 text-sm text-mint/80">
              <li><Link to="/practice">Practice Tests</Link></li>
              <li><Link to="/mock-tests">Mock Tests</Link></li>
              <li>
                <Link
                  to={
                    isAdmin
                      ? '/admin/ai-exam'
                      : user
                        ? '/dashboard/ai-generator'
                        : '/ai-generator'
                  }
                >
                  AI Question Generator
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-mint/60">
          © {new Date().getFullYear()} EduGate — AI Learning + CBT Examination Platform
        </div>
      </footer>
    </div>
  );
}
