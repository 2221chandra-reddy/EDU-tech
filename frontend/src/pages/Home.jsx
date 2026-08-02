import { Link } from 'react-router-dom';
import { ArrowRight, Bot, BookOpen, Timer, LineChart, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const exams = [
  'RRB NTPC', 'RRB ALP', 'RRB Group D', 'SSC CGL', 'SSC CHSL', 'SSC MTS',
  'IBPS / SBI', 'UPSC', 'APPSC', 'TSPSC', 'Police', 'DRDO', 'ISRO',
];

const journey = [
  'Register & choose exam',
  'Study books, videos, notes',
  'Ask AI Tutor',
  'Practice topic tests',
  'Take full mocks',
  'Get AI analysis',
  'Follow study plan',
  'Attempt CBT',
];

export default function Home() {
  const { user, isAdmin } = useAuth();
  const isStudent = Boolean(user && !isAdmin);
  const startPath = isStudent ? '/dashboard' : isAdmin ? '/admin' : '/register';
  const mockPath = isStudent ? '/dashboard/mocks' : '/mock-tests';

  return (
    <div>
      <section className="bg-mesh relative overflow-hidden text-sand">
        <div className="absolute inset-0 opacity-30 pattern-dots" style={{ backgroundSize: '22px 22px' }} />
        <div className="relative mx-auto grid min-h-[88vh] max-w-7xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-20">
          <div className="animate-fade-up">
            <div className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              EduGate
            </div>
            <h1 className="mt-5 max-w-xl text-2xl font-medium leading-snug text-mint sm:text-3xl">
              Learn. Practice. Crack the exam — with AI by your side.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-mint/75">
              Books, video lectures, AI tutor, unlimited practice, and realistic CBT mocks for RRB, SSC, Banking, UPSC & State exams.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={startPath}
                className="inline-flex items-center gap-2 rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-ink transition hover:bg-amber-soft"
              >
                {isStudent ? 'Open student dashboard' : isAdmin ? 'Open admin' : 'Start learning free'}
                <ArrowRight size={16} />
              </Link>
              <Link
                to={mockPath}
                className="inline-flex items-center gap-2 rounded-xl border border-mint/30 px-5 py-3 text-sm font-medium text-sand hover:bg-white/10"
              >
                Try a CBT mock
              </Link>
            </div>
          </div>

          <div className="animate-fade-up-delay relative hidden lg:block">
            <div className="absolute -inset-4 rounded-[2rem] bg-amber/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-teal/40 via-forest to-ink p-8 shadow-2xl shadow-black/30">
              <div className="space-y-4">
                <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-xs text-mint/70">CBT Timer</div>
                  <div className="font-mono text-3xl font-semibold text-amber-soft">29:42</div>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex h-9 items-center justify-center rounded-lg text-xs font-semibold ${
                        i < 6 ? 'bg-teal text-white' : i === 6 ? 'bg-amber text-ink' : 'bg-white/10 text-mint'
                      }`}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
                <div className="rounded-xl bg-ink/50 px-4 py-3 text-sm text-mint/90">
                  Question palette · Autosave · AI analysis — fully available on this platform.
                </div>
              </div>
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between rounded-xl bg-ink/80 px-4 py-3 backdrop-blur">
                <div>
                  <div className="text-xs text-mint/70">Live CBT session</div>
                  <div className="text-sm font-medium">Timer · Autosave · Instant analysis</div>
                </div>
                <Play size={18} className="text-amber" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Supported exams</div>
          <h2 className="mt-2 font-display text-3xl text-forest">One platform. Every major exam.</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {exams.map((e) => (
            <span key={e} className="rounded-lg bg-white px-3 py-2 text-sm text-forest shadow-sm shadow-forest/5">
              {e}
            </span>
          ))}
        </div>
      </section>

      <section className="border-y border-forest/10 bg-white/50 pattern-dots">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-16 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: BookOpen, title: 'Learn', text: 'Books, PDFs, videos, notes, mind maps & current affairs.' },
            { icon: Bot, title: 'AI Tutor', text: 'Ask doubts, get explanations, summaries and practice sets.' },
            { icon: Timer, title: 'CBT Exams', text: 'Timed mocks with autosave, evaluation and answer keys.' },
            { icon: LineChart, title: 'AI Analysis', text: 'Weak topics, study plan, suggested videos & drills.' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl bg-sand p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest text-amber-soft">
                <Icon size={18} />
              </div>
              <h3 className="mt-4 font-display text-xl text-forest">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="mb-8 max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Complete journey</div>
          <h2 className="mt-2 font-display text-3xl text-forest">From first login to exam-ready.</h2>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {journey.map((step, i) => (
            <li key={step} className="rounded-2xl border border-forest/10 bg-white p-4">
              <div className="text-xs font-semibold text-amber">0{i + 1}</div>
              <div className="mt-2 text-sm font-medium text-forest">{step}</div>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <Link to="/courses" className="inline-flex items-center gap-2 text-sm font-semibold text-teal hover:text-forest">
            Explore courses <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
