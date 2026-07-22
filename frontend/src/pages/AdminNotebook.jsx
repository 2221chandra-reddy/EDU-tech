import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, catalogApi } from '../api/client';
import { PageHeader, Badge, LoadingBlock } from '../components/ui';
import { useToast } from '../context/ToastContext';

/**
 * Notebook LLM: take textbook matter → generate Q&A → publish to bank + live mock.
 */
export default function AdminNotebook() {
  const toast = useToast();
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({
    exam_id: '',
    subject: '',
    topic: '',
    material_ids: [],
    content_text: '',
    direction:
      'Read the textbook matter. Generate MCQ questions with correct answers and short explanations only from that content. Then publish for students.',
    total_questions: 15,
    duration_minutes: 45,
    publish: true,
    is_live: true,
    title: '',
  });

  async function refresh() {
    const [ex, sub, mats, jobList] = await Promise.all([
      catalogApi.exams(),
      adminApi.subjects(),
      adminApi.materials(),
      adminApi.notebookJobs().catch(() => []),
    ]);
    setExams(ex);
    setSubjects(sub);
    setMaterials(mats.filter((m) => m.type !== 'video'));
    setJobs(jobList);
    setForm((f) => ({
      ...f,
      exam_id: f.exam_id || ex[0]?.id || '',
      subject: f.subject || sub[0]?.name || '',
    }));
  }

  useEffect(() => {
    refresh().catch(console.error);
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
    if (!form.content_text.trim() && form.material_ids.length === 0) {
      toast.error('Paste textbook matter or select materials with chapter text');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await adminApi.notebookLlm({
        ...form,
        title:
          form.title.trim() ||
          `Notebook — ${form.subject || 'Mixed'}${form.topic ? ` / ${form.topic}` : ''}`,
      });
      setResult(res);
      toast.success(
        form.publish
          ? `Published ${res.question_ids?.length || 0} questions + live mock`
          : `Generated ${res.question_ids?.length || 0} questions (draft)`
      );
      await refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!exams.length) return <LoadingBlock />;

  const booksWithText = materials.filter((m) => m.content_text || m.description);

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Notebook LLM"
        subtitle="Take textbook matter → generate questions & answers → publish to Question Bank and live CBT mock."
      />

      <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-forest">Exam</span>
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
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-forest">Subject</span>
            <select
              className="w-full rounded-xl border px-3 py-2"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-forest">Topic / chapter</span>
            <input
              className="w-full rounded-xl border px-3 py-2"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              placeholder="e.g. Ohm's Law"
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
            <span className="mb-1 block font-medium text-forest">Number of questions</span>
            <input
              type="number"
              min={5}
              max={100}
              className="w-full rounded-xl border px-3 py-2"
              value={form.total_questions}
              onChange={(e) => setForm({ ...form, total_questions: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-forest">Mock duration (minutes)</span>
            <input
              type="number"
              min={10}
              max={300}
              className="w-full rounded-xl border px-3 py-2"
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
            />
          </label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-forest">Select textbooks / notes</span>
            <Link to="/admin/materials" className="text-xs font-medium text-teal">
              Manage content →
            </Link>
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-forest/10 p-3">
            {materials.length === 0 && (
              <p className="text-sm text-slate">No materials yet. Add textbooks under Content.</p>
            )}
            {materials.map((m) => (
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
                    {m.subject} · {m.topic} · {m.content_text || m.description ? 'has text' : 'no chapter text'}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {booksWithText.length > 0 && (
            <p className="mt-1 text-xs text-slate">{booksWithText.length} material(s) already have chapter text.</p>
          )}
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-forest">Textbook matter (paste chapter text)</span>
          <textarea
            rows={8}
            className="w-full rounded-xl border px-3 py-2 font-mono text-xs leading-relaxed"
            placeholder="Paste the textbook / notes chapter here. Notebook LLM will generate questions and answers from this matter..."
            value={form.content_text}
            onChange={(e) => setForm({ ...form, content_text: e.target.value })}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-forest">Direction to Notebook LLM</span>
          <textarea
            rows={3}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={form.direction}
            onChange={(e) => setForm({ ...form, direction: e.target.value })}
          />
        </label>

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

        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-sand disabled:opacity-60"
        >
          {busy ? 'Generating from textbook...' : 'Generate Q&A and publish'}
        </button>
      </form>

      {result && (
        <div className="mt-6 space-y-3 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl text-forest">Generated & saved</h2>
            <Badge>{result.questions?.length || result.question_ids?.length || 0} questions</Badge>
            {result.mock?.is_published && <Badge tone="teal">Published</Badge>}
            {result.mock?.is_live && <Badge tone="coral">Live</Badge>}
          </div>
          <p className="text-sm text-slate">{result.job?.result_summary}</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/admin/questions" className="font-medium text-teal">
              Open Question Bank →
            </Link>
            <Link to="/mock-tests" className="font-medium text-teal">
              View mocks →
            </Link>
            {result.mock_test_id && (
              <Link to={`/cbt/${result.mock_test_id}/instructions`} className="font-medium text-teal">
                Open CBT instructions →
              </Link>
            )}
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {(result.questions || []).map((q, i) => (
              <div key={q.id || i} className="rounded-xl border border-forest/10 p-3 text-sm">
                <p className="font-medium text-forest">
                  Q{i + 1}. {q.question_text}
                </p>
                <p className="mt-1 text-xs text-slate">
                  A) {q.option_a} · B) {q.option_b} · C) {q.option_c} · D) {q.option_d}
                </p>
                <p className="mt-1 text-teal">
                  Ans: {q.correct_option} — {q.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-display text-xl text-forest">Recent notebook jobs</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {jobs.slice(0, 8).map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-forest/10 px-3 py-2">
                <Badge tone={j.status === 'completed' ? 'teal' : j.status === 'failed' ? 'coral' : 'amber'}>
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
