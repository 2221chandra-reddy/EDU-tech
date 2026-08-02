import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { adminApi, catalogApi } from '../api/client';
import { PageHeader, StatCard, LoadingBlock, Badge } from '../components/ui';
import { useToast } from '../context/ToastContext';

export function AdminHome() {
  const [data, setData] = useState(null);
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    exam_id: '',
    title: '',
    question_type: 'mcq',
    duration_minutes: 90,
    total_questions: 100,
    negative_marking: 0.25,
    publish_at: '',
    notebook_direction: 'Create a balanced mock paper from uploaded textbooks and videos. Include explanations for every MCQ.',
    pattern_sections: [
      { subject: 'Mathematics', question_type: 'mcq', percentage: 40, topic: '' },
      { subject: 'Reasoning', question_type: 'mcq', percentage: 30, topic: '' },
      { subject: 'General Awareness', question_type: 'mcq', percentage: 30, topic: '' },
    ],
  });

  async function refresh() {
    const [dash, ex, sub, sch] = await Promise.all([
      adminApi.dashboard(),
      catalogApi.exams(),
      adminApi.subjects(),
      adminApi.schedules(),
    ]);
    setData(dash);
    setExams(ex);
    setSubjects(sub);
    setSchedules(sch);
    setForm((f) => ({
      ...f,
      exam_id: f.exam_id || ex[0]?.id || '',
      pattern_sections: f.pattern_sections.map((row) => ({
        ...row,
        subject: row.subject || sub[0]?.name || 'Mathematics',
      })),
    }));
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, []);

  const pctTotal = form.pattern_sections.reduce((s, p) => s + Number(p.percentage || 0), 0);

  function updateSection(i, patch) {
    setForm((f) => ({
      ...f,
      pattern_sections: f.pattern_sections.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    }));
  }

  function addSection() {
    setForm((f) => ({
      ...f,
      pattern_sections: [
        ...f.pattern_sections,
        { subject: subjects[0]?.name || 'Mathematics', question_type: 'mcq', percentage: 0, topic: '' },
      ],
    }));
  }

  function removeSection(i) {
    setForm((f) => ({
      ...f,
      pattern_sections: f.pattern_sections.filter((_, idx) => idx !== i),
    }));
  }

  async function submitSchedule(e) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      if (!form.exam_id) throw new Error('Please select an exam');
      if (!form.title.trim()) throw new Error('Please enter an exam title');
      if (!form.publish_at) throw new Error('Please pick publish date and time');
      if (Math.abs(pctTotal - 100) > 0.5) {
        throw new Error(`Pattern percentages must total 100% (currently ${pctTotal}%)`);
      }
      const publishDate = new Date(form.publish_at);
      if (Number.isNaN(publishDate.getTime())) {
        throw new Error('Invalid publish date/time');
      }
      await adminApi.createSchedule({
        exam_id: form.exam_id,
        title: form.title.trim(),
        question_type: form.question_type,
        duration_minutes: Number(form.duration_minutes) || 90,
        total_questions: Number(form.total_questions) || 100,
        negative_marking: Number(form.negative_marking) || 0.25,
        publish_at: publishDate.toISOString(),
        notebook_direction: form.notebook_direction,
        pattern_sections: form.pattern_sections,
        material_ids: [],
      });
      setMsg('Exam scheduled. Notebook LLM will generate the paper and auto-publish at the scheduled time.');
      setForm((f) => ({ ...f, title: '', publish_at: '' }));
      await refresh();
    } catch (err) {
      setMsg(err.message || 'Failed to schedule exam');
    } finally {
      setSaving(false);
    }
  }

  async function runDueNow() {
    try {
      const res = await adminApi.processDueSchedules();
      setMsg(`Processed ${res.processed} due schedule(s).`);
      await refresh();
    } catch (err) {
      setMsg(err.message || 'Failed to process due schedules');
    }
  }

  if (!data) return <LoadingBlock />;
  const s = data.stats;

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function schedulesOnDay(day) {
    if (!day) return [];
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return schedules.filter((sch) => (sch.publish_at || '').startsWith(key));
  }

  const statusTone = {
    scheduled: 'amber',
    generating: 'mint',
    published: 'mint',
    failed: 'coral',
  };

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Dashboard"
        subtitle="Overview, exam calendar, and stats. Create or schedule AI exams under AI Exam LLM."
        action={
          <button onClick={runDueNow} className="rounded-xl border border-forest/20 px-4 py-2 text-sm text-forest">
            Process due now
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Students" value={s.students} />
        <StatCard label="Courses" value={s.courses} />
        <StatCard label="Questions" value={s.questions} />
        <StatCard label="Mock tests" value={s.mocks} />
        <StatCard label="Evaluated attempts" value={s.attempts} />
        <StatCard label="Materials" value={s.materials} />
      </div>

      <div className="mt-10 grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl text-forest">Exam calendar</h2>
            <div className="flex gap-2">
              <button
                className="rounded-lg border px-2 py-1 text-sm"
                onClick={() => setCalMonth(new Date(year, month - 1, 1))}
              >
                ←
              </button>
              <div className="min-w-[140px] text-center text-sm font-medium text-forest">
                {calMonth.toLocaleString('en', { month: 'long', year: 'numeric' })}
              </div>
              <button
                className="rounded-lg border px-2 py-1 text-sm"
                onClick={() => setCalMonth(new Date(year, month + 1, 1))}
              >
                →
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-slate">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              const items = schedulesOnDay(day);
              return (
                <div
                  key={i}
                  className={`min-h-[72px] rounded-lg border p-1 text-left ${
                    day ? 'border-forest/10 bg-sand/40' : 'border-transparent'
                  }`}
                >
                  {day && <div className="text-xs font-semibold text-forest">{day}</div>}
                  {items.slice(0, 2).map((sch) => (
                    <div key={sch.id} className="mt-0.5 truncate rounded bg-teal/15 px-1 text-[10px] text-forest">
                      {sch.title}
                    </div>
                  ))}
                  {items.length > 2 && <div className="text-[10px] text-slate">+{items.length - 2}</div>}
                </div>
              );
            })}
          </div>

          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wider text-teal">Upcoming / recent</h3>
          <div className="mt-3 space-y-2">
            {schedules.length === 0 && <p className="text-sm text-slate">No scheduled exams yet.</p>}
            {schedules.map((sch) => (
              <div key={sch.id} className="flex items-start justify-between gap-3 rounded-xl border border-forest/10 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium text-forest">{sch.title}</div>
                  <div className="text-xs text-slate">
                    {sch.exam_name} · {new Date(sch.publish_at).toLocaleString()} · {sch.total_questions} Q · {sch.question_type}
                  </div>
                </div>
                <Badge tone={statusTone[sch.status] || 'mint'}>{sch.status}</Badge>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-display text-2xl text-forest">Schedule exam + paper pattern</h2>
          <p className="mt-1 text-sm text-slate">
            Set exam name, subject % pattern, and time. AI Exam LLM generates the paper and publishes at the scheduled time.
            Prefer <Link className="font-medium text-teal" to="/admin/ai-exam">AI Exam LLM</Link> for a simpler one-subject flow.
          </p>
          <form onSubmit={submitSchedule} className="mt-4 space-y-3">
            <select
              required
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={form.exam_id}
              onChange={(e) => setForm({ ...form, exam_id: e.target.value })}
            >
              <option value="">Select exam</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
            <input
              required
              placeholder="Exam / mock paper title"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className="rounded-xl border px-3 py-2 text-sm"
                value={form.question_type}
                onChange={(e) => setForm({ ...form, question_type: e.target.value })}
              >
                <option value="mcq">MCQ</option>
                <option value="mixed">Mixed</option>
                <option value="reasoning">Reasoning heavy</option>
                <option value="quant">Quant heavy</option>
              </select>
              <input
                type="datetime-local"
                required
                className="rounded-xl border px-3 py-2 text-sm"
                value={form.publish_at}
                onChange={(e) => setForm({ ...form, publish_at: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min={10}
                className="rounded-xl border px-3 py-2 text-sm"
                value={form.total_questions}
                onChange={(e) => setForm({ ...form, total_questions: Number(e.target.value) })}
                placeholder="Total Q"
              />
              <input
                type="number"
                min={15}
                className="rounded-xl border px-3 py-2 text-sm"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                placeholder="Minutes"
              />
              <input
                type="number"
                step="0.25"
                className="rounded-xl border px-3 py-2 text-sm"
                value={form.negative_marking}
                onChange={(e) => setForm({ ...form, negative_marking: Number(e.target.value) })}
                placeholder="Neg mark"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium text-forest">
                  Paper pattern (% per subject) — total {pctTotal}%
                </div>
                <button type="button" onClick={addSection} className="text-xs font-medium text-teal">
                  + Add section
                </button>
              </div>
              <div className="space-y-2">
                {form.pattern_sections.map((row, i) => (
                  <div key={i} className="grid grid-cols-[1.2fr_0.8fr_0.5fr_auto] gap-2">
                    <select
                      className="rounded-lg border px-2 py-1.5 text-sm"
                      value={row.subject}
                      onChange={(e) => updateSection(i, { subject: e.target.value })}
                    >
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.name}>{sub.name}</option>
                      ))}
                      {!subjects.find((s) => s.name === row.subject) && (
                        <option value={row.subject}>{row.subject}</option>
                      )}
                    </select>
                    <select
                      className="rounded-lg border px-2 py-1.5 text-sm"
                      value={row.question_type}
                      onChange={(e) => updateSection(i, { question_type: e.target.value })}
                    >
                      <option value="mcq">MCQ</option>
                      <option value="assertion">Assertion</option>
                      <option value="comprehension">Comprehension</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="rounded-lg border px-2 py-1.5 text-sm"
                      value={row.percentage}
                      onChange={(e) => updateSection(i, { percentage: Number(e.target.value) })}
                    />
                    <button type="button" onClick={() => removeSection(i)} className="text-xs text-coral">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              {Math.abs(pctTotal - 100) > 0.5 && (
                <p className="mt-1 text-xs text-coral">Percentages must add up to 100%.</p>
              )}
            </div>

            <textarea
              rows={4}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="Notebook LLM direction for this paper..."
              value={form.notebook_direction}
              onChange={(e) => setForm({ ...form, notebook_direction: e.target.value })}
            />

            <button
              disabled={saving || Math.abs(pctTotal - 100) > 0.5}
              className="w-full rounded-xl bg-forest py-2.5 text-sm font-semibold text-sand disabled:opacity-50"
            >
              {saving ? 'Scheduling...' : 'Schedule exam for students'}
            </button>
            {msg && (
              <p className={`text-sm ${/fail|error|required|must|invalid|select|enter|pick/i.test(msg) ? 'text-coral' : 'text-teal'}`}>
                {msg}
              </p>
            )}
          </form>
        </section>
      </div>

      <h2 className="mt-10 font-display text-2xl text-forest">Recent results</h2>
      <div className="mt-4 space-y-2">
        {data.recent_attempts.map((a) => (
          <div key={a.id} className="flex justify-between rounded-xl bg-white px-4 py-3 text-sm">
            <span>{a.student_name} · {a.test_title}</span>
            <span className="font-semibold text-teal">{a.score}/{a.total_marks}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminStudents() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [busyId, setBusyId] = useState('');

  async function load() {
    setRows(await adminApi.students());
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function togglePlan(row) {
    const next = row.plan === 'premium' ? 'free' : 'premium';
    setBusyId(row.id);
    try {
      const updated = await adminApi.setStudentPlan(row.id, next);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)));
      toast.success(`${row.name} → ${next}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId('');
    }
  }

  if (!rows) return <LoadingBlock />;
  return (
    <div>
      <PageHeader title="Students" subtitle="Registered learners. Toggle freemium plan without a payment gateway." />
      <div className="overflow-x-auto rounded-2xl bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-forest/10 text-xs uppercase text-slate">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Target exam</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-forest/5">
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3">{r.email}</td>
                <td className="px-4 py-3">{r.target_exam || '—'}</td>
                <td className="px-4 py-3 capitalize">{r.plan || 'free'}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => togglePlan(r)}
                    className="rounded-lg border border-forest/20 px-2 py-1 text-xs font-medium text-forest disabled:opacity-40"
                  >
                    Set {r.plan === 'premium' ? 'free' : 'premium'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminCourses() {
  const [exams, setExams] = useState([]);
  const [courses, setCourses] = useState(null);
  const [form, setForm] = useState({
    exam_id: '',
    title: '',
    slug: '',
    description: '',
    level: 'Beginner',
    duration_hours: 40,
  });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');

  async function load() {
    const [e, c] = await Promise.all([catalogApi.exams(), catalogApi.courses()]);
    setExams(e);
    setCourses(c);
    setForm((f) => ({ ...f, exam_id: f.exam_id || e[0]?.id || '' }));
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await adminApi.createCourse(form);
      setMsg('Course created');
      setForm((f) => ({ ...f, title: '', slug: '', description: '' }));
      const c = await catalogApi.courses();
      setCourses(c);
    } catch (err) {
      setMsg(err.message || 'Failed to create course');
    } finally {
      setSaving(false);
    }
  }

  async function removeCourse(course) {
    if (!window.confirm(`Delete course "${course.title}"? This cannot be undone.`)) return;
    setBusyId(course.id);
    setMsg('');
    try {
      await adminApi.deleteCourse(course.id);
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
      setMsg('Course deleted');
    } catch (err) {
      setMsg(err.message || 'Failed to delete course');
    } finally {
      setBusyId('');
    }
  }

  if (!courses) return <LoadingBlock />;

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader title="Courses" subtitle="View existing courses, then create new ones by exam." />

      <section>
        <h2 className="font-display text-2xl text-forest">All courses</h2>
        <p className="mt-1 text-sm text-slate">{courses.length} course{courses.length === 1 ? '' : 's'}</p>
        {courses.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-forest/20 bg-white/60 px-6 py-10 text-center text-sm text-slate">
            No courses yet. Create the first one below.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-forest/10 text-xs uppercase text-slate">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Exam</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id} className="border-b border-forest/5">
                    <td className="px-4 py-3">
                      <div className="font-medium text-forest">{c.title}</div>
                      {c.description && (
                        <div className="mt-0.5 line-clamp-1 text-xs text-slate">{c.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="teal">{c.exam_name || c.exam_code || '—'}</Badge>
                    </td>
                    <td className="px-4 py-3">{c.level || '—'}</td>
                    <td className="px-4 py-3">{c.duration_hours ? `${c.duration_hours}h` : '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate">{c.slug}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => removeCourse(c)}
                        className="rounded-lg border border-coral/30 px-3 py-1.5 text-xs font-semibold text-coral hover:bg-coral/10 disabled:opacity-50"
                      >
                        {busyId === c.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {msg && <p className="mt-3 text-sm text-teal">{msg}</p>}
      </section>

      <section className="max-w-xl">
        <h2 className="font-display text-2xl text-forest">Create course</h2>
        <p className="mt-1 text-sm text-slate">Add a new course for an exam.</p>
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-2xl bg-white p-6">
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={form.exam_id}
            onChange={(e) => setForm({ ...form, exam_id: e.target.value })}
          >
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Title"
            className="w-full rounded-xl border px-3 py-2"
            value={form.title}
            onChange={(e) =>
              setForm({
                ...form,
                title: e.target.value,
                slug: e.target.value.toLowerCase().replace(/\s+/g, '-'),
              })
            }
          />
          <input
            required
            placeholder="Slug"
            className="w-full rounded-xl border px-3 py-2"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
          <textarea
            placeholder="Description"
            className="w-full rounded-xl border px-3 py-2"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <button
            disabled={saving}
            className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Creating...' : 'Create course'}
          </button>
        </form>
      </section>
    </div>
  );
}

export { default as AdminMaterials } from './AdminContent';

export function AdminQuestions() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');

  async function load() {
    const data = await adminApi.questions();
    setRows(data);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function removeOne(id) {
    if (!window.confirm('Delete this question from the bank?')) return;
    setBusy(true);
    try {
      await adminApi.deleteQuestion(id);
      setRows((prev) => prev.filter((q) => q.id !== id));
      toast.success('Question deleted');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id, status) {
    setBusy(true);
    try {
      const updated = await adminApi.updateQuestion(id, { status });
      setRows((prev) => prev.map((q) => (q.id === id ? { ...q, ...updated } : q)));
      toast.success(`Marked ${status}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function clearSamples() {
    if (!window.confirm('Delete all sample (demo) questions? AI and manual questions stay.')) return;
    setBusy(true);
    try {
      const res = await adminApi.deleteSampleQuestions();
      await load();
      toast.success(`Deleted ${res.deleted || 0} sample question(s)`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!rows) return <LoadingBlock />;
  const sampleCount = rows.filter((q) => q.source === 'sample').length;
  const pendingCount = rows.filter((q) => q.status === 'pending').length;
  const visible =
    filter === 'all' ? rows : rows.filter((q) => (q.status || 'approved') === filter);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Question Bank"
          subtitle="QC workflow: create/AI generate → pending → approve for students."
        />
        <button
          type="button"
          disabled={busy || sampleCount === 0}
          onClick={clearSamples}
          className="rounded-xl border border-coral/40 bg-white px-4 py-2 text-sm font-medium text-coral disabled:opacity-40"
        >
          Delete all samples ({sampleCount})
        </button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {['all', 'pending', 'approved', 'rejected'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
              filter === f ? 'bg-forest text-sand' : 'bg-white text-forest'
            }`}
          >
            {f}
            {f === 'pending' ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>
      {!visible.length && <p className="text-sm text-slate">No questions in this filter.</p>}
      <div className="space-y-3">
        {visible.map((q) => (
          <div key={q.id} className="flex items-start justify-between gap-3 rounded-xl bg-white p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <Badge>{q.source}</Badge>
                <Badge tone="amber">{q.difficulty}</Badge>
                <Badge tone={q.status === 'approved' ? 'teal' : q.status === 'rejected' ? 'coral' : 'mint'}>
                  {q.status || 'approved'}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-forest">{q.question_text}</p>
              <p className="mt-1 text-xs text-slate">
                {q.subject} · {q.topic}
                {q.chapter ? ` · ch ${q.chapter}` : ''}
                {q.concept ? ` · ${q.concept}` : ''} · Ans {q.correct_option}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              {q.status !== 'approved' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStatus(q.id, 'approved')}
                  className="rounded-lg border border-teal/40 px-3 py-1.5 text-xs font-medium text-teal disabled:opacity-40"
                >
                  Approve
                </button>
              )}
              {q.status !== 'rejected' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStatus(q.id, 'rejected')}
                  className="rounded-lg border border-amber/40 px-3 py-1.5 text-xs font-medium text-amber disabled:opacity-40"
                >
                  Reject
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => removeOne(q.id)}
                className="rounded-lg border border-coral/30 px-3 py-1.5 text-xs font-medium text-coral hover:bg-coral/5 disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** @deprecated Redirect — use /admin/ai-exam */
export function AdminAiGenerator() {
  return <Navigate to="/admin/ai-exam" replace />;
}

export function AdminExams() {
  const [exams, setExams] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [form, setForm] = useState({
    exam_id: '',
    title: '',
    description: '',
    duration_minutes: 90,
    negative_marking: 0.25,
    is_live: false,
    question_ids: [],
  });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([catalogApi.exams(), adminApi.questions()]).then(([e, q]) => {
      setExams(e);
      setQuestions(q);
      if (e[0]) setForm((f) => ({ ...f, exam_id: e[0].id }));
    });
  }, []);

  function toggleQuestion(id) {
    setForm((f) => ({
      ...f,
      question_ids: f.question_ids.includes(id)
        ? f.question_ids.filter((x) => x !== id)
        : [...f.question_ids, id],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    await adminApi.createMock({
      ...form,
      total_questions: form.question_ids.length,
    });
    setMsg('Mock test created');
  }

  return (
    <div>
      <PageHeader title="Exams & Mock Tests" subtitle="Create CBT mocks and mark them live." />
      <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-6">
        <select className="w-full rounded-xl border px-3 py-2" value={form.exam_id} onChange={(e) => setForm({ ...form, exam_id: e.target.value })}>
          {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
        </select>
        <input required placeholder="Mock title" className="w-full rounded-xl border px-3 py-2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea placeholder="Description" className="w-full rounded-xl border px-3 py-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_live} onChange={(e) => setForm({ ...form, is_live: e.target.checked })} />
          Mark as live exam
        </label>
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border p-3">
          <div className="text-xs font-semibold uppercase text-slate">Select questions ({form.question_ids.length})</div>
          {questions.slice(0, 40).map((q) => (
            <label key={q.id} className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={form.question_ids.includes(q.id)} onChange={() => toggleQuestion(q.id)} />
              <span>{q.question_text}</span>
            </label>
          ))}
        </div>
        <button className="rounded-xl bg-forest px-4 py-2 text-sm text-sand">Create mock</button>
        {msg && <p className="text-sm text-teal">{msg}</p>}
      </form>
    </div>
  );
}

export function AdminResults() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    adminApi.results().then(setRows).catch(console.error);
  }, []);
  if (!rows) return <LoadingBlock />;
  return (
    <div>
      <PageHeader title="Results" subtitle="All evaluated CBT attempts." />
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex justify-between rounded-xl bg-white px-4 py-3 text-sm">
            <span>{r.student_name} · {r.test_title}</span>
            <span className="font-semibold text-teal">{r.score}/{r.total_marks}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminAnalytics() {
  const [data, setData] = useState(null);
  useEffect(() => {
    adminApi.analytics().then(setData).catch(console.error);
  }, []);
  if (!data) return <LoadingBlock />;
  return (
    <div>
      <PageHeader title="Analytics & Reports" subtitle="Attempts by exam and question sources." />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-5">
          <h3 className="font-display text-xl text-forest">By exam</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {data.by_exam.map((r) => (
              <li key={r.name} className="flex justify-between">
                <span>{r.name}</span>
                <span>{r.attempts} attempts · avg {r.avg_score}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-white p-5">
          <h3 className="font-display text-xl text-forest">Question sources</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {data.by_question_source.map((r) => (
              <li key={r.source} className="flex justify-between">
                <span className="capitalize">{r.source}</span>
                <span>{r.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function AdminSettings() {
  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure AI provider keys in backend/.env" />
      <div className="rounded-2xl bg-white p-6 text-sm text-slate leading-relaxed space-y-2">
        <p>
          Set <code>AI_PROVIDER</code> to <strong>openai</strong>, <strong>gemini</strong>, or{' '}
          <strong>mock</strong>.
        </p>
        <p>
          Add <code>OPENAI_API_KEY</code> or <code>GEMINI_API_KEY</code> for live AI Tutor and question
          generation.
        </p>
        <p>
          Demo database: set <code>DB_MODE=file</code> (default for local) to persist data in{' '}
          <code>backend/data/demo-db.json</code>. Reset with <code>npm run db:demo:reset</code> then
          restart the API.
        </p>
        <p>
          Admin exams: use <strong>AI Exam LLM</strong> to generate and publish (or schedule) papers by
          subject with one AI provider (<code>AI_PROVIDER</code>).
        </p>
        <p>
          Production should use <code>DB_MODE=postgres</code> with a real <code>DATABASE_URL</code>. JWT
          secret is <code>JWT_SECRET</code>.
        </p>
      </div>
    </div>
  );
}
