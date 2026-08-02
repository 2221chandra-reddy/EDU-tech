import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { studentApi } from '../api/client';
import { PageHeader, LoadingBlock, Badge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function Onboarding() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    exam_date: '',
    daily_study_minutes: user?.daily_study_minutes || 60,
    preferred_language: user?.preferred_language || 'English',
    target_score: user?.target_score || 80,
    qualification: user?.qualification || '',
    previous_attempt: !!user?.previous_attempt,
  });
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await studentApi.completeOnboarding({
        ...form,
        daily_study_minutes: Number(form.daily_study_minutes) || 60,
        target_score: Number(form.target_score) || null,
        exam_date: form.exam_date || null,
      });
      setUser(updated);
      toast.success('Onboarding complete');
      navigate(updated.diagnostic_done ? '/dashboard' : '/dashboard/diagnostic');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        eyebrow="Get started"
        title="Set up your study plan"
        subtitle={`Target exam: ${user?.target_exam || 'Not set'}. Tell us how you study so we can adapt.`}
      />
      <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Exam date</span>
          <input
            type="date"
            className="w-full rounded-xl border border-forest/15 px-3 py-2.5"
            value={form.exam_date}
            onChange={(e) => setForm({ ...form, exam_date: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Daily study minutes</span>
          <input
            type="number"
            min={15}
            max={480}
            className="w-full rounded-xl border border-forest/15 px-3 py-2.5"
            value={form.daily_study_minutes}
            onChange={(e) => setForm({ ...form, daily_study_minutes: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Preferred language</span>
          <select
            className="w-full rounded-xl border border-forest/15 px-3 py-2.5"
            value={form.preferred_language}
            onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}
          >
            {['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada'].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Target score (%)</span>
          <input
            type="number"
            min={40}
            max={100}
            className="w-full rounded-xl border border-forest/15 px-3 py-2.5"
            value={form.target_score}
            onChange={(e) => setForm({ ...form, target_score: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Qualification</span>
          <input
            className="w-full rounded-xl border border-forest/15 px-3 py-2.5"
            value={form.qualification}
            onChange={(e) => setForm({ ...form, qualification: e.target.value })}
            placeholder="e.g. Graduate"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.previous_attempt}
            onChange={(e) => setForm({ ...form, previous_attempt: e.target.checked })}
          />
          I have attempted this exam before
        </label>
        <button
          disabled={busy}
          className="w-full rounded-xl bg-forest py-3 text-sm font-semibold text-sand disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Continue to diagnostic'}
        </button>
      </form>
    </div>
  );
}

export function Diagnostic() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [phase, setPhase] = useState('intro');
  const [pack, setPack] = useState(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const startedAt = useState(() => Date.now())[0];

  async function start() {
    setBusy(true);
    try {
      const data = await studentApi.startDiagnostic();
      setPack(data);
      setPhase('quiz');
      setIdx(0);
      setAnswers({});
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!pack) return;
    setBusy(true);
    try {
      const ids = pack.questions.map((q) => q.id);
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      const per = Math.max(15, Math.round(elapsed / Math.max(ids.length, 1)));
      const timings = Object.fromEntries(ids.map((id) => [id, per]));
      const data = await studentApi.submitDiagnostic({
        question_ids: ids,
        answers,
        timings,
      });
      setResult(data);
      setPhase('done');
      setUser({ ...user, diagnostic_done: true });
      toast.success('Diagnostic complete — skill map updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'intro') {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          title="Diagnostic test"
          subtitle="25–30 mixed questions from your target exam bank. Results seed your skill map."
        />
        <div className="rounded-2xl bg-white p-6">
          <p className="text-sm text-slate">
            Answer at a natural pace. Wrong answers are classified into your Mistake Book automatically.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={start}
            className="mt-6 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-sand disabled:opacity-60"
          >
            {busy ? 'Loading…' : 'Start diagnostic'}
          </button>
          {user?.diagnostic_done && (
            <Link to="/dashboard" className="ml-3 text-sm text-teal">
              Skip to dashboard
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'done' && result) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Diagnostic results"
          subtitle={`Score ${result.score}/${result.total} · ${result.analysis?.accuracy || 0}% accuracy`}
        />
        <div className="flex flex-wrap gap-2">
          {(result.analysis?.skills || []).map((s) => (
            <Badge key={`${s.subject}-${s.topic}`} tone={s.status === 'weak' || s.status === 'concept' ? 'coral' : 'teal'}>
              {s.subject}: {s.topic} ({s.status})
            </Badge>
          ))}
        </div>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-sand"
        >
          Go to daily plan
        </button>
      </div>
    );
  }

  if (!pack) return <LoadingBlock />;
  const q = pack.questions[idx];
  const opts = [
    ['A', q.option_a],
    ['B', q.option_b],
    ['C', q.option_c],
    ['D', q.option_d],
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 text-sm text-slate">
        Question {idx + 1} / {pack.questions.length} · {q.subject} · {q.topic}
      </div>
      <div className="rounded-2xl bg-white p-6">
        <p className="text-forest">{q.question_text}</p>
        <div className="mt-4 space-y-2">
          {opts.map(([key, text]) => (
            <button
              key={key}
              type="button"
              onClick={() => setAnswers({ ...answers, [q.id]: key })}
              className={`block w-full rounded-xl border px-4 py-3 text-left text-sm ${
                answers[q.id] === key ? 'border-teal bg-mint/40 text-forest' : 'border-forest/10 hover:bg-sand'
              }`}
            >
              <span className="font-semibold">{key}.</span> {text}
            </button>
          ))}
        </div>
        <div className="mt-6 flex justify-between">
          <button
            type="button"
            disabled={idx === 0}
            onClick={() => setIdx((i) => i - 1)}
            className="rounded-xl border border-forest/20 px-4 py-2 text-sm disabled:opacity-40"
          >
            Back
          </button>
          {idx < pack.questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setIdx((i) => i + 1)}
              className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-sand"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={finish}
              className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-sand disabled:opacity-60"
            >
              {busy ? 'Submitting…' : 'Submit diagnostic'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Mistakes() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [onlyOpen, setOnlyOpen] = useState(true);

  async function load(unresolved = onlyOpen) {
    const data = await studentApi.mistakes(unresolved ? { unresolved: '1' } : {});
    setRows(data);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [onlyOpen]);

  async function resolve(id) {
    try {
      await studentApi.resolveMistake(id);
      toast.success('Marked resolved');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (!rows) return <LoadingBlock />;

  return (
    <div>
      <PageHeader title="Mistake Book" subtitle="Wrong answers classified by type for focused revision." />
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setOnlyOpen(true)}
          className={`rounded-lg px-3 py-1.5 text-sm ${onlyOpen ? 'bg-forest text-sand' : 'bg-white text-forest'}`}
        >
          Unresolved
        </button>
        <button
          type="button"
          onClick={() => setOnlyOpen(false)}
          className={`rounded-lg px-3 py-1.5 text-sm ${!onlyOpen ? 'bg-forest text-sand' : 'bg-white text-forest'}`}
        >
          All
        </button>
      </div>
      {!rows.length ? (
        <p className="text-sm text-slate">No mistakes recorded yet. Complete practice or a diagnostic.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3 rounded-2xl bg-white p-4">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="coral">{m.mistake_type}</Badge>
                  <Badge>{m.subject}</Badge>
                  <Badge tone="amber">{m.topic}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate">
                  Your answer: {m.student_answer || '—'} · Correct: {m.correct_option}
                </p>
                {m.question_text && <p className="mt-1 text-sm text-forest">{m.question_text}</p>}
              </div>
              {!m.resolved && (
                <button
                  type="button"
                  onClick={() => resolve(m.id)}
                  className="shrink-0 rounded-lg border border-teal/40 px-3 py-1.5 text-xs font-medium text-teal"
                >
                  Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
