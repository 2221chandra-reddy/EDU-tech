import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { cbtApi } from '../api/client';
import { AnalysisPanel, LoadingBlock } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function parseMaybeJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

export function CbtInstructions() {
  const { id } = useParams();
  const [mock, setMock] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    setError('');
    cbtApi
      .mock(id)
      .then(setMock)
      .catch((err) => setError(err.message || 'Failed to load mock test'));
  }, [id]);

  async function beginExam() {
    setStarting(true);
    setError('');
    try {
      // Warm-start so freemium / access errors show here, not as a blank exam loader
      await cbtApi.start(id);
      navigate(`/cbt/${id}/exam`);
    } catch (err) {
      setError(err.message || 'Could not start exam');
      toast.error(err.message || 'Could not start exam');
    } finally {
      setStarting(false);
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p>Login required for CBT.</p>
        <Link to="/login" className="mt-3 inline-block text-teal">
          Login
        </Link>
      </div>
    );
  }

  if (error && !mock) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-coral">{error}</p>
        <Link to="/mock-tests" className="mt-4 inline-block text-teal">
          Back to mock tests
        </Link>
      </div>
    );
  }

  if (!mock) return <LoadingBlock />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <h1 className="font-display text-3xl text-forest">{mock.title}</h1>
        <p className="mt-2 text-slate">
          {mock.exam_name} · {mock.duration_minutes} min · {mock.question_count || mock.total_questions} Qs
        </p>
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-teal">Instructions</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate">
          <li>The exam is timed. Timer starts when you click Start CBT.</li>
          <li>Answers autosave every few seconds and when you navigate.</li>
          <li>Use Mark for Review to revisit questions later.</li>
          <li>Negative marking: {mock.negative_marking} per wrong answer.</li>
          <li>Do not refresh or close the window during the exam.</li>
          <li>After submit you get score, AI analysis and answer key.</li>
        </ul>
        {error && <p className="mt-4 rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}
        <button
          type="button"
          disabled={starting}
          onClick={beginExam}
          className="mt-8 rounded-xl bg-forest px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {starting ? 'Starting…' : 'Start CBT'}
        </button>
      </div>
    </div>
  );
}

export function CbtExam() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState([]);
  const [visited, setVisited] = useState([]);
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef(Date.now());
  const submitLock = useRef(false);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    setError('');
    cbtApi
      .start(id)
      .then((data) => {
        if (cancelled) return;
        const qs = data.questions || [];
        if (!qs.length) {
          setError('This mock has no questions linked. Ask admin to publish questions for this paper.');
          return;
        }
        setSession(data);
        setAnswers(parseMaybeJson(data.attempt?.answers, {}));
        setMarked(parseMaybeJson(data.attempt?.marked_for_review, []));
        setVisited(parseMaybeJson(data.attempt?.visited, []));
        setSecondsLeft((data.mock?.duration_minutes || 30) * 60);
        startedAt.current = Date.now();
        if (qs[0]) {
          setVisited((v) => (v.includes(qs[0].id) ? v : [...v, qs[0].id]));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to start CBT');
        toast.error(err.message || 'Failed to start CBT');
      });
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  useEffect(() => {
    if (secondsLeft === null || submitting) return undefined;
    if (secondsLeft <= 0) {
      handleSubmit(true);
      return undefined;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, submitting]);

  useEffect(() => {
    if (!session?.attempt?.id || submitting) return undefined;
    const t = setInterval(() => {
      autosave();
    }, 15000);
    return () => clearInterval(t);
  }, [session?.attempt?.id, submitting, answers, marked, visited]);

  async function autosave() {
    if (!session?.attempt?.id || submitting) return;
    setSaving(true);
    try {
      await cbtApi.autosave(session.attempt.id, {
        answers,
        marked_for_review: marked,
        visited,
      });
    } catch {
      // ignore transient autosave errors
    } finally {
      setSaving(false);
    }
  }

  const questions = session?.questions || [];
  const q = questions[current];

  const palette = useMemo(
    () =>
      questions.map((item) => {
        if (marked.includes(item.id)) return 'amber';
        if (answers[item.id]) return 'teal';
        if (visited.includes(item.id)) return 'visited';
        return 'idle';
      }),
    [questions, answers, marked, visited]
  );

  function selectOption(opt) {
    if (!q) return;
    setAnswers((a) => ({ ...a, [q.id]: opt }));
  }

  function goTo(index) {
    setCurrent(index);
    const next = questions[index];
    if (next) {
      setVisited((v) => (v.includes(next.id) ? v : [...v, next.id]));
    }
  }

  function toggleMark() {
    if (!q) return;
    setMarked((m) => (m.includes(q.id) ? m.filter((x) => x !== q.id) : [...m, q.id]));
  }

  async function handleSubmit(auto = false) {
    if (!session?.attempt?.id || submitLock.current) return;
    if (!auto && !window.confirm('Submit the exam now?')) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      const time_taken_seconds = Math.round((Date.now() - startedAt.current) / 1000);
      const res = await cbtApi.submit(session.attempt.id, {
        answers,
        marked_for_review: marked,
        visited,
        time_taken_seconds,
      });
      navigate(`/cbt/result/${session.attempt.id}`, { state: res });
    } catch (err) {
      submitLock.current = false;
      setSubmitting(false);
      alert(err.message);
    }
  }

  if (!user) {
    return (
      <div className="py-20 text-center">
        <Link to="/login" className="text-teal">
          Login required
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-display text-2xl text-forest">Could not open exam</h1>
        <p className="mt-3 text-sm text-coral">{error}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to={`/cbt/${id}/instructions`} className="rounded-xl border border-forest/20 px-4 py-2 text-sm text-forest">
            Back to instructions
          </Link>
          <Link to="/mock-tests" className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white">
            Mock tests
          </Link>
        </div>
      </div>
    );
  }

  if (!session || !q || secondsLeft === null) return <LoadingBlock label="Loading exam questions…" />;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="min-h-screen bg-[#e8e4da]">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-forest/10 bg-white px-4 py-3">
        <div>
          <div className="font-display text-lg text-forest">{session.mock.title}</div>
          <div className="text-xs text-slate">{saving ? 'Saving...' : 'Autosave on'}</div>
        </div>
        <div
          className={`rounded-xl px-4 py-2 font-mono text-lg font-semibold ${
            secondsLeft < 60 ? 'bg-coral/15 text-coral' : 'bg-forest text-white'
          }`}
        >
          {mm}:{ss}
        </div>
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={submitting}
          className="rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_280px]">
        <div className="rounded-2xl bg-white p-6">
          <div className="text-xs font-medium uppercase tracking-wider text-slate">
            Question {current + 1} of {questions.length} · {q.subject} · {q.topic}
          </div>
          <h2 className="mt-3 text-lg font-medium leading-relaxed text-forest">{q.question_text}</h2>
          <div className="mt-6 space-y-3">
            {['A', 'B', 'C', 'D'].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => selectOption(opt)}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                  answers[q.id] === opt ? 'border-teal bg-mint' : 'border-forest/10 hover:border-teal/40'
                }`}
              >
                <span className="font-semibold text-teal">{opt}</span>
                <span>{q[`option_${opt.toLowerCase()}`]}</span>
              </button>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => goTo(Math.max(0, current - 1))}
              disabled={current === 0}
              className="rounded-lg border border-forest/15 px-4 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={toggleMark}
              className="rounded-lg border border-amber px-4 py-2 text-sm text-forest"
            >
              {marked.includes(q.id) ? 'Unmark' : 'Mark for review'}
            </button>
            <button
              type="button"
              onClick={() => goTo(Math.min(questions.length - 1, current + 1))}
              disabled={current === questions.length - 1}
              className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        <aside className="rounded-2xl bg-white p-4">
          <div className="text-sm font-semibold text-forest">Question palette</div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {questions.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                className={`h-9 rounded-lg text-xs font-semibold ${
                  palette[i] === 'teal'
                    ? 'bg-teal text-white'
                    : palette[i] === 'amber'
                      ? 'bg-amber text-ink'
                      : palette[i] === 'visited'
                        ? 'bg-mint text-forest'
                        : 'bg-sand text-slate'
                } ${current === i ? 'ring-2 ring-forest' : ''}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-1 text-xs text-slate">
            <div>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-teal" /> Answered
            </div>
            <div>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber" /> Marked
            </div>
            <div>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-mint" /> Visited
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function CbtResult() {
  const { attemptId } = useParams();
  const location = useLocation();
  const [data, setData] = useState(location.state || null);
  const [key, setKey] = useState(location.state?.answer_key || null);

  useEffect(() => {
    if (data?.attempt) return;
    cbtApi
      .attempt(attemptId)
      .then((attempt) => setData({ attempt, analysis: attempt.analysis }))
      .catch(console.error);
    cbtApi
      .answerKey(attemptId)
      .then(setKey)
      .catch(console.error);
  }, [attemptId, data]);

  if (!data?.attempt) return <LoadingBlock />;
  const a = data.attempt;
  const analysis = data.analysis || a.analysis;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <div className="rounded-3xl bg-white p-8">
        <h1 className="font-display text-3xl text-forest">Result</h1>
        <p className="mt-2 text-slate">{a.test_title || 'Mock test'} submitted</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <Stat label="Score" value={a.score} />
          <Stat label="Correct" value={a.correct_count} />
          <Stat label="Wrong" value={a.wrong_count} />
          <Stat label="Unattempted" value={a.unattempted_count} />
        </div>
      </div>

      <AnalysisPanel analysis={typeof analysis === 'string' ? JSON.parse(analysis) : analysis} />

      {key && (
        <div className="rounded-3xl bg-white p-8">
          <h2 className="font-display text-2xl text-forest">Answer key</h2>
          <div className="mt-4 space-y-4">
            {(Array.isArray(key) ? key : key.answer_key || []).map((q, i) => (
              <div key={q.id} className="rounded-xl border border-forest/10 p-4 text-sm">
                <div className="font-medium text-forest">
                  Q{i + 1}. {q.question_text}
                </div>
                <div className="mt-2 text-slate">
                  Your answer: {q.your_answer || '—'} · Correct: {q.correct_option}
                  {q.is_correct ? ' ✓' : ' ✗'}
                </div>
                {q.explanation && <p className="mt-2 text-slate">{q.explanation}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link to="/mock-tests" className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white">
          More mocks
        </Link>
        <Link to="/dashboard/mistakes" className="rounded-xl border border-forest/20 px-4 py-2.5 text-sm text-forest">
          Mistake Book
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-sand px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-slate">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-forest">{value}</div>
    </div>
  );
}
