import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { studentApi } from '../api/client';
import { PageHeader, StatCard, LoadingBlock, EmptyState, Badge } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export function DashboardHome() {
  const [data, setData] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    studentApi.overview().then(setData).catch(console.error);
  }, []);

  if (!data) return <LoadingBlock />;

  return (
    <div>
      <PageHeader
        eyebrow="My Learning"
        title={`Hi, ${user.name.split(' ')[0]}`}
        subtitle="Continue courses, practice questions, and take live CBT exams."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Courses" value={data.courses.length} />
        <StatCard label="Bookmarks" value={data.bookmarks.length} />
        <StatCard label="Practice attempts" value={data.practice_attempts.length} />
        <StatCard label="Exam attempts" value={data.exam_attempts.length} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-forest">Continue watching</h2>
            <Link to="/dashboard/continue" className="text-sm text-teal">View all</Link>
          </div>
          {data.continue_watching.length === 0 ? (
            <p className="mt-4 text-sm text-slate">No video progress yet. Explore video lectures.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.continue_watching.slice(0, 4).map((v) => (
                <li key={v.id} className="flex justify-between text-sm">
                  <span className="text-forest">{v.title}</span>
                  <span className="text-slate">{v.progress_percent}%</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-forest">Live exams</h2>
            <Link to="/dashboard/live" className="text-sm text-teal">Open</Link>
          </div>
          {data.live_exams.length === 0 ? (
            <p className="mt-4 text-sm text-slate">No live exams right now.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.live_exams.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-forest">{e.title}</span>
                  <Link to={`/cbt/${e.id}/instructions`} className="font-medium text-teal">Start</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/dashboard/ai-tutor" className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-sand">Ask AI Tutor</Link>
        <Link to="/dashboard/ai-generator" className="rounded-xl border border-forest/20 px-4 py-2.5 text-sm font-medium text-forest">Generate questions</Link>
        <Link to="/dashboard/mocks" className="rounded-xl border border-forest/20 px-4 py-2.5 text-sm font-medium text-forest">Mock tests</Link>
      </div>
    </div>
  );
}

export function DashboardCourses() {
  const [data, setData] = useState(null);
  useEffect(() => {
    studentApi.overview().then(setData).catch(console.error);
  }, []);
  if (!data) return <LoadingBlock />;
  return (
    <div>
      <PageHeader title="My Courses" subtitle="Courses you are enrolled in." />
      {data.courses.length === 0 ? (
        <EmptyState title="No enrollments yet" hint="Browse courses and enroll to track progress." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.courses.map((c) => (
            <Link key={c.id} to={`/courses/${c.slug}`} className="rounded-2xl bg-white p-5">
              <Badge>{c.exam_name}</Badge>
              <h3 className="mt-2 font-display text-xl text-forest">{c.title}</h3>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-sand">
                <div className="h-full bg-teal" style={{ width: `${c.progress_percent}%` }} />
              </div>
              <div className="mt-2 text-xs text-slate">{c.progress_percent}% complete</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardBookmarks() {
  const [data, setData] = useState(null);
  useEffect(() => {
    studentApi.overview().then(setData).catch(console.error);
  }, []);
  if (!data) return <LoadingBlock />;
  return (
    <div>
      <PageHeader title="Bookmarks" subtitle="Saved study materials." />
      {data.bookmarks.length === 0 ? (
        <EmptyState title="No bookmarks" hint="Bookmark books, videos or notes while studying." />
      ) : (
        <div className="space-y-3">
          {data.bookmarks.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
              <div>
                <div className="font-medium text-forest">{b.title}</div>
                <div className="text-xs text-slate">{b.type} · {b.subject}</div>
              </div>
              <Badge tone="amber">{b.type}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardContinue() {
  const [data, setData] = useState(null);
  useEffect(() => {
    studentApi.overview().then(setData).catch(console.error);
  }, []);
  if (!data) return <LoadingBlock />;
  return (
    <div>
      <PageHeader title="Continue Watching" subtitle="Pick up video lectures where you left off." />
      {data.continue_watching.length === 0 ? (
        <EmptyState title="Nothing in progress" hint="Start a video lecture from the Videos page." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.continue_watching.map((v) => (
            <div key={v.id} className="rounded-2xl bg-white p-5">
              <h3 className="font-display text-xl text-forest">{v.title}</h3>
              <p className="mt-2 text-sm text-slate">{v.progress_percent}% watched</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardPractice() {
  const [data, setData] = useState(null);
  useEffect(() => {
    studentApi.overview().then(setData).catch(console.error);
  }, []);
  if (!data) return <LoadingBlock />;
  return (
    <div>
      <PageHeader
        title="Practice Questions"
        subtitle="Your recent practice attempts."
        action={<Link to="/practice" className="rounded-xl bg-forest px-4 py-2 text-sm text-sand">New practice</Link>}
      />
      {data.practice_attempts.length === 0 ? (
        <EmptyState title="No practice yet" hint="Start a topic drill or generate AI questions." />
      ) : (
        <div className="space-y-3">
          {data.practice_attempts.map((p) => (
            <div key={p.id} className="rounded-xl bg-white px-4 py-3">
              <div className="font-medium text-forest">{p.set_title}</div>
              <div className="text-sm text-slate">
                {p.score}/{p.total} · {p.accuracy}% accuracy
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardMocks() {
  return (
    <div>
      <PageHeader title="Mock Tests" subtitle="Full-length CBT mocks for your target exam." />
      <Link to="/mock-tests" className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-sand">
        Browse mock tests
      </Link>
    </div>
  );
}

export function DashboardLive() {
  const [data, setData] = useState(null);
  useEffect(() => {
    studentApi.overview().then(setData).catch(console.error);
  }, []);
  if (!data) return <LoadingBlock />;
  return (
    <div>
      <PageHeader title="Live Exams" subtitle="Currently open CBT examinations." />
      {data.live_exams.length === 0 ? (
        <EmptyState title="No live exams" />
      ) : (
        <div className="space-y-3">
          {data.live_exams.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-4">
              <div>
                <div className="font-medium text-forest">{e.title}</div>
                <div className="text-xs text-slate">{e.exam_name} · {e.duration_minutes} min</div>
              </div>
              <Link to={`/cbt/${e.id}/instructions`} className="rounded-lg bg-coral px-3 py-2 text-sm font-semibold text-white">
                Enter
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardResults() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    studentApi.results().then(setRows).catch(console.error);
  }, []);
  if (!rows) return <LoadingBlock />;
  return (
    <div>
      <PageHeader title="Results & Answer Keys" subtitle="Past CBT evaluations." />
      {rows.length === 0 ? (
        <EmptyState title="No results yet" />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Link
              key={r.id}
              to={`/cbt/result/${r.id}`}
              className="flex items-center justify-between rounded-xl bg-white px-4 py-4"
            >
              <div>
                <div className="font-medium text-forest">{r.test_title}</div>
                <div className="text-xs text-slate">{r.exam_name}</div>
              </div>
              <div className="text-sm font-semibold text-teal">
                {r.score}/{r.total_marks}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardCertificates() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    studentApi.certificates().then(setRows).catch(console.error);
  }, []);
  if (!rows) return <LoadingBlock />;
  return (
    <div>
      <PageHeader title="Certificates" subtitle="Awards for strong mock performance." />
      {rows.length === 0 ? (
        <EmptyState title="No certificates yet" hint="Score 60%+ on a mock to earn a certificate." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((c) => (
            <div key={c.id} className="rounded-2xl border border-amber/40 bg-white p-5">
              <div className="text-xs uppercase tracking-wider text-amber">Certificate</div>
              <h3 className="mt-2 font-display text-xl text-forest">{c.title}</h3>
              <p className="mt-2 text-sm text-slate">Score: {c.score} · Code: {c.certificate_code}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardProfile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    target_exam: user?.target_exam || '',
  });
  const [msg, setMsg] = useState('');

  async function save(e) {
    e.preventDefault();
    const updated = await studentApi.updateProfile(form);
    setUser(updated);
    setMsg('Profile updated');
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="Profile" subtitle="Update your learning preferences." />
      <form onSubmit={save} className="space-y-4 rounded-2xl bg-white p-6">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Name</span>
          <input className="w-full rounded-xl border border-forest/15 px-3 py-2.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Phone</span>
          <input className="w-full rounded-xl border border-forest/15 px-3 py-2.5" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Target exam</span>
          <input className="w-full rounded-xl border border-forest/15 px-3 py-2.5" value={form.target_exam} onChange={(e) => setForm({ ...form, target_exam: e.target.value })} />
        </label>
        <div className="text-sm text-slate">Email: {user.email}</div>
        <button className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-sand">Save</button>
        {msg && <p className="text-sm text-teal">{msg}</p>}
      </form>
    </div>
  );
}
