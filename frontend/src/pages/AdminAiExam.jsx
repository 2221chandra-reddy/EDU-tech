import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, catalogApi } from '../api/client';
import { PageHeader, Badge, LoadingBlock } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { applyPaperPattern } from '../lib/exam';

function localDatetimeMin() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Single admin AI LLM: create exam papers by subject, publish now or schedule.
 */
export default function AdminAiExam() {
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [mode, setMode] = useState('now'); // now | schedule
  const [form, setForm] = useState({
    exam_id: '',
    subject: '',
    topic: '',
    material_ids: [],
    content_text: '',
    direction:
      'Generate exam-style MCQs for the selected subject/topic. Include correct answers and short explanations. Use textbook matter when provided.',
    total_questions: 20,
    duration_minutes: 60,
    negative_marking: 0.25,
    publish: true,
    is_live: true,
    title: '',
    publish_at: '',
    full_paper: false,
  });

  async function refresh() {
    const [ex, sub, mats, jobList, sch] = await Promise.all([
      catalogApi.exams(),
      adminApi.subjects(),
      adminApi.materials().catch(() => []),
      adminApi.notebookJobs().catch(() => []),
      adminApi.schedules().catch(() => []),
    ]);
    setExams(ex);
    setSubjects(sub);
    setMaterials((mats || []).filter((m) => m.type !== 'video'));
    setJobs(jobList || []);
    setSchedules((sch || []).filter((s) => s.status === 'scheduled' || s.status === 'generating'));
    setForm((f) => ({
      ...f,
      exam_id: f.exam_id || ex[0]?.id || '',
      subject: f.subject || sub[0]?.name || '',
    }));
    setReady(true);
  }

  useEffect(() => {
    refresh().catch((err) => {
      console.error(err);
      toast.error(err.message || 'Failed to load AI Exam LLM');
      setReady(true);
    });
  }, []);

  function toggleMaterial(id) {
    setForm((f) => ({
      ...f,
      material_ids: f.material_ids.includes(id)
        ? f.material_ids.filter((x) => x !== id)
        : [...f.material_ids, id],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.exam_id) {
      toast.error('Select an exam');
      return;
    }
    const selected = exams.find((ex) => ex.id === form.exam_id);
    const fullPaper = form.full_paper && selected?.paper_pattern;
    if (!fullPaper && !form.subject) {
      toast.error('Select a subject');
      return;
    }

    const title =
      form.title.trim() ||
      (fullPaper
        ? `${selected.name} — full paper`
        : `AI Exam — ${form.subject}${form.topic ? ` / ${form.topic}` : ''}`);

    setBusy(true);
    setResult(null);
    try {
      if (mode === 'schedule') {
        if (!form.publish_at) {
          toast.error('Pick schedule date and time');
          setBusy(false);
          return;
        }
        const publishDate = new Date(form.publish_at);
        if (Number.isNaN(publishDate.getTime())) {
          toast.error('Invalid schedule date/time');
          setBusy(false);
          return;
        }
        if (publishDate.getTime() <= Date.now()) {
          toast.error('Cannot schedule an exam in the past. Pick a future date and time.');
          setBusy(false);
          return;
        }
        const sch = await adminApi.createSchedule({
          exam_id: form.exam_id,
          title,
          question_type: 'mcq',
          duration_minutes: Number(form.duration_minutes) || (fullPaper ? selected.paper_pattern.duration_minutes : 60),
          total_questions: Number(form.total_questions) || (fullPaper ? selected.paper_pattern.total_questions : 20),
          negative_marking: Number(form.negative_marking) || (fullPaper ? selected.paper_pattern.negative_marking : 0.25),
          publish_at: publishDate.toISOString(),
          notebook_direction: fullPaper ? selected.paper_pattern.ai_direction : form.direction,
          pattern_sections: fullPaper
            ? selected.paper_pattern.sections
            : [
                {
                  subject: form.subject,
                  question_type: 'mcq',
                  percentage: 100,
                  topic: form.topic || '',
                },
              ],
          material_ids: form.material_ids,
        });
        setResult({ type: 'scheduled', schedule: sch });
        toast.success('Exam scheduled — AI will generate and publish at that time');
        setForm((f) => ({ ...f, title: '', publish_at: '' }));
      } else {
        const res = await adminApi.notebookLlm({
          exam_id: form.exam_id,
          subject: fullPaper ? selected.paper_pattern.sections[0].subject : form.subject,
          topic: fullPaper ? '' : form.topic,
          material_ids: form.material_ids,
          content_text: form.content_text,
          direction: fullPaper ? selected.paper_pattern.ai_direction : form.direction,
          total_questions: fullPaper ? selected.paper_pattern.total_questions : form.total_questions,
          duration_minutes: fullPaper ? selected.paper_pattern.duration_minutes : form.duration_minutes,
          negative_marking: fullPaper ? selected.paper_pattern.negative_marking : form.negative_marking,
          pattern_sections: fullPaper ? selected.paper_pattern.sections : undefined,
          publish: form.publish,
          is_live: form.is_live,
          title,
        });
        setResult({ type: 'published', ...res });
        toast.success(
          form.publish
            ? `Published ${res.question_ids?.length || 0} questions + mock exam`
            : `Generated ${res.question_ids?.length || 0} questions (draft)`
        );
      }
      await refresh();
    } catch (err) {
      toast.error(err.message || 'AI exam failed');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <LoadingBlock />;

  const selectedExam = exams.find((ex) => ex.id === form.exam_id);
  const hasLdcePattern = Boolean(selectedExam?.paper_pattern);

  const filteredMaterials = form.subject
    ? materials.filter(
        (m) =>
          !form.subject ||
          String(m.subject || '').toLowerCase() === String(form.subject).toLowerCase()
      )
    : materials;

  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader
        eyebrow="AI Exam LLM"
        title="Create & publish exams with AI"
        subtitle="Pick Railway Group C to B (Commercial) for the 180-question / 3-hour LDCE paper, or generate one subject. Admin only sets the date and time."
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('now')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            mode === 'now' ? 'bg-forest text-white' : 'bg-white text-forest border border-forest/15'
          }`}
        >
          Publish now
        </button>
        <button
          type="button"
          onClick={() => setMode('schedule')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            mode === 'schedule' ? 'bg-forest text-white' : 'bg-white text-forest border border-forest/15'
          }`}
        >
          Schedule time
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-forest">Exam</span>
            <select
              className="w-full rounded-xl border px-3 py-2"
              value={form.exam_id}
              onChange={(e) => {
                const exam = exams.find((x) => x.id === e.target.value);
                const next = applyPaperPattern(exam, { ...form, exam_id: e.target.value });
                setForm({
                  ...next,
                  full_paper: Boolean(exam?.paper_pattern),
                  direction: exam?.paper_pattern?.ai_direction || form.direction,
                });
              }}
              required
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-forest">Subject</span>
            <select
              className="w-full rounded-xl border px-3 py-2"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value, material_ids: [] })}
              required={!form.full_paper}
            >
              {subjects.length === 0 && <option value="">No subjects — add under Content</option>}
              {subjects.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {hasLdcePattern && (
          <label className="flex items-start gap-2 rounded-xl bg-mint/40 px-3 py-3 text-sm text-forest">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.full_paper}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  full_paper: e.target.checked,
                  total_questions: e.target.checked ? selectedExam.paper_pattern.total_questions : f.total_questions,
                  duration_minutes: e.target.checked ? selectedExam.paper_pattern.duration_minutes : f.duration_minutes,
                  negative_marking: e.target.checked ? selectedExam.paper_pattern.negative_marking : f.negative_marking,
                }))
              }
            />
            <span>
              Full LDCE paper — Commercial 90 + Rajbhasha/GK 55 combined + HR 35 (180 MCQs, 3 hours, 1/3 negative). Prefer{' '}
              <strong>Schedule time</strong> so AI can generate all sections. You choose the exam clock.
            </span>
          </label>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-forest">Topic (optional)</span>
            <input
              className="w-full rounded-xl border px-3 py-2"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              placeholder="e.g. Percentage, Ohm's Law"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-forest">Paper title (optional)</span>
            <input
              className="w-full rounded-xl border px-3 py-2"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Auto if empty"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-forest">Questions</span>
            <input
              type="number"
              min={5}
              max={250}
              className="w-full rounded-xl border px-3 py-2"
              value={form.total_questions}
              onChange={(e) => setForm({ ...form, total_questions: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-forest">Duration (minutes)</span>
            <input
              type="number"
              min={10}
              max={300}
              readOnly={Boolean(selectedExam?.paper_pattern?.duration_locked)}
              className="w-full rounded-xl border px-3 py-2"
              value={form.duration_minutes}
              onChange={(e) => {
                if (selectedExam?.paper_pattern?.duration_locked) return;
                setForm({ ...form, duration_minutes: Number(e.target.value) });
              }}
            />
            {selectedExam?.paper_pattern?.duration_locked && (
              <p className="mt-1 text-xs text-slate">This exam is fixed at 3 hours (180 minutes).</p>
            )}
          </label>
          {mode === 'schedule' && (
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-forest">Publish date & time</span>
              <input
                type="datetime-local"
                required
                min={localDatetimeMin()}
                className="w-full rounded-xl border px-3 py-2"
                value={form.publish_at}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value && new Date(value).getTime() <= Date.now()) {
                    toast.error('Past dates are blocked. Pick a future date and time.');
                    return;
                  }
                  setForm({ ...form, publish_at: value });
                }}
              />
              <p className="mt-1 text-xs text-slate">Previous dates are blocked. Schedule only a future time.</p>
            </label>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-forest">
              Subject materials (optional — improves accuracy)
            </span>
            <Link to="/admin/materials" className="text-xs font-medium text-teal">
              Manage content →
            </Link>
          </div>
          <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-forest/10 p-3">
            {filteredMaterials.length === 0 ? (
              <p className="text-sm text-slate">
                No materials for this subject. AI will still generate from the subject syllabus.
              </p>
            ) : (
              filteredMaterials.map((m) => (
                <label key={m.id} className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.material_ids.includes(m.id)}
                    onChange={() => toggleMaterial(m.id)}
                  />
                  <span>
                    <span className="font-medium text-forest">{m.title}</span>
                    <span className="block text-xs text-slate">
                      {m.subject} · {m.topic || '—'}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-forest">
            Textbook matter (optional paste)
          </span>
          <textarea
            rows={5}
            className="w-full rounded-xl border px-3 py-2 font-mono text-xs leading-relaxed"
            placeholder="Optional: paste chapter text so AI builds questions only from this content..."
            value={form.content_text}
            onChange={(e) => setForm({ ...form, content_text: e.target.value })}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-forest">Direction to AI LLM</span>
          <textarea
            rows={3}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={form.direction}
            onChange={(e) => setForm({ ...form, direction: e.target.value })}
          />
        </label>

        {mode === 'now' && (
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.publish}
                onChange={(e) => setForm({ ...form, publish: e.target.checked })}
              />
              Publish to students (question bank + mock)
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_live}
                onChange={(e) => setForm({ ...form, is_live: e.target.checked })}
                disabled={!form.publish}
              />
              Mark mock as Live CBT
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy
            ? mode === 'schedule'
              ? 'Scheduling...'
              : 'Generating exam...'
            : mode === 'schedule'
              ? 'Schedule AI exam'
              : 'Generate & publish exam'}
        </button>
      </form>

      {result?.type === 'scheduled' && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-display text-xl text-forest">Scheduled</h2>
          <p className="mt-2 text-sm text-slate">
            <strong>{result.schedule?.title}</strong> will be generated and published at{' '}
            {result.schedule?.publish_at
              ? new Date(result.schedule.publish_at).toLocaleString()
              : '—'}
            .
          </p>
          <Link to="/admin" className="mt-3 inline-block text-sm font-medium text-teal">
            View exam calendar on Dashboard →
          </Link>
        </div>
      )}

      {result?.type === 'published' && (
        <div className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl text-forest">Generated & saved</h2>
            <Badge>{result.questions?.length || result.question_ids?.length || 0} questions</Badge>
            {result.mock?.is_published && <Badge tone="teal">Published</Badge>}
            {result.mock?.is_live && <Badge tone="coral">Live</Badge>}
          </div>
          <p className="text-sm text-slate">{result.job?.result_summary}</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/admin/questions" className="font-medium text-teal">
              Question Bank →
            </Link>
            <Link to="/admin/exams" className="font-medium text-teal">
              Exams & Mocks →
            </Link>
            <Link to="/mock-tests" className="font-medium text-teal">
              Student mocks →
            </Link>
            {result.mock_test_id && (
              <Link to={`/cbt/${result.mock_test_id}/instructions`} className="font-medium text-teal">
                Open CBT →
              </Link>
            )}
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {(result.questions || []).map((q, i) => (
              <div key={q.id || i} className="rounded-xl border border-forest/10 p-3 text-sm">
                <p className="font-medium text-forest">
                  Q{i + 1}. {q.question_text}
                </p>
                <p className="mt-1 text-teal">
                  Ans: {q.correct_option} — {q.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {schedules.length > 0 && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-display text-xl text-forest">Upcoming AI schedules</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {schedules.slice(0, 8).map((sch) => (
              <li
                key={sch.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-forest/10 px-3 py-2"
              >
                <Badge tone="amber">{sch.status}</Badge>
                <span className="font-medium text-forest">{sch.title}</span>
                <span className="text-slate">
                  {sch.publish_at ? new Date(sch.publish_at).toLocaleString() : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-display text-xl text-forest">Recent AI jobs</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {jobs.slice(0, 8).map((j) => (
              <li
                key={j.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-forest/10 px-3 py-2"
              >
                <Badge
                  tone={j.status === 'completed' ? 'teal' : j.status === 'failed' ? 'coral' : 'amber'}
                >
                  {j.status}
                </Badge>
                <span className="text-forest">{j.result_summary || j.direction?.slice(0, 80)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
