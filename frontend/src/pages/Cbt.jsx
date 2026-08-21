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
          {mock.is_live && (
            <li>
              Live paper: this exam stays open only for {mock.duration_minutes} minutes from when admin started it.
              After that it disappears and cannot be opened again.
            </li>
          )}
          <li>You get one attempt. If you already started or submitted, you cannot open this paper again after time is over.</li>
          <li>Answers autosave every few seconds and when you navigate.</li>
          <li>Use Mark for Review to revisit questions later.</li>
          <li>Negative marking: {mock.negative_marking} per wrong answer.</li>
          <li>Mark each answer as Sure / Educated Guess / Wild Guess (Negative Marking Shield).</li>
          <li>Do not refresh or close the window during the exam.</li>
          <li>After submit you get score, time-leak heatmap, shield analysis and answer key.</li>
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
  const [timings, setTimings] = useState({});
  const [confidence, setConfidence] = useState({});
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef(Date.now());
  const questionStartedAt = useRef(Date.now());
  const currentRef = useRef(0);
  const questionsRef = useRef([]);
  const timingsRef = useRef({});
  const confidenceRef = useRef({});
  const answersRef = useRef({});
  const markedRef = useRef([]);
  const visitedRef = useRef([]);
  const submitLock = useRef(false);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(() => {
    timingsRef.current = timings;
  }, [timings]);
  useEffect(() => {
    confidenceRef.current = confidence;
  }, [confidence]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    markedRef.current = marked;
  }, [marked]);
  useEffect(() => {
    visitedRef.current = visited;
  }, [visited]);

  function flushQuestionTime(index = currentRef.current) {
    const qs = questionsRef.current;
    const qItem = qs[index];
    if (!qItem) return timingsRef.current;
    const elapsed = Math.max(0, Math.round((Date.now() - questionStartedAt.current) / 1000));
    const next = {
      ...timingsRef.current,
      [qItem.id]: (Number(timingsRef.current[qItem.id]) || 0) + elapsed,
    };
    timingsRef.current = next;
    setTimings(next);
    questionStartedAt.current = Date.now();
    return next;
  }

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
        questionsRef.current = qs;
        setSession(data);
        setAnswers(parseMaybeJson(data.attempt?.answers, {}));
        setMarked(parseMaybeJson(data.attempt?.marked_for_review, []));
        setVisited(parseMaybeJson(data.attempt?.visited, []));
        setTimings(parseMaybeJson(data.attempt?.timings, {}));
        setConfidence(parseMaybeJson(data.attempt?.confidence, {}));
        setSecondsLeft(
          Number(data.remaining_seconds) > 0
            ? Number(data.remaining_seconds)
            : (data.mock?.duration_minutes || 30) * 60
        );
        startedAt.current = Date.now();
        questionStartedAt.current = Date.now();
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
  }, [session?.attempt?.id, submitting, answers, marked, visited, timings, confidence]);

  async function autosave() {
    if (!session?.attempt?.id || submitting) return;
    const latestTimings = flushQuestionTime();
    setSaving(true);
    try {
      await cbtApi.autosave(session.attempt.id, {
        answers: answersRef.current,
        marked_for_review: markedRef.current,
        visited: visitedRef.current,
        timings: latestTimings,
        confidence: confidenceRef.current,
      });
    } catch {
      // ignore transient autosave errors
    } finally {
      setSaving(false);
    }
  }

  const questions = session?.questions || [];
  questionsRef.current = questions;
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
    if (!confidence[q.id]) {
      setConfidence((c) => ({ ...c, [q.id]: 'sure' }));
    }
  }

  function setConfidenceLevel(level) {
    if (!q) return;
    setConfidence((c) => ({ ...c, [q.id]: level }));
  }

  function goTo(index) {
    flushQuestionTime(current);
    setCurrent(index);
    questionStartedAt.current = Date.now();
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
      const latestTimings = flushQuestionTime(current);
      const time_taken_seconds = Math.round((Date.now() - startedAt.current) / 1000);
      const res = await cbtApi.submit(session.attempt.id, {
        answers: answersRef.current,
        marked_for_review: markedRef.current,
        visited: visitedRef.current,
        time_taken_seconds,
        timings: latestTimings,
        confidence: confidenceRef.current,
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
  const conf = confidence[q.id] || (answers[q.id] ? 'sure' : null);

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

          <div className="mt-6 rounded-xl border border-forest/10 bg-sand/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate">
              Negative Marking Shield — confidence
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { id: 'sure', label: '100% Sure' },
                { id: 'guess', label: 'Educated Guess' },
                { id: 'wild', label: 'Wild Guess' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={!answers[q.id]}
                  onClick={() => setConfidenceLevel(opt.id)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40 ${
                    conf === opt.id
                      ? opt.id === 'wild'
                        ? 'bg-coral text-white'
                        : opt.id === 'guess'
                          ? 'bg-amber text-ink'
                          : 'bg-forest text-white'
                      : 'border border-forest/15 bg-white text-forest'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate">
              Mark confidence before moving on. Wild guesses drive negative marking loss.
            </p>
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
  const [tab, setTab] = useState('time');

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
  const analysisRaw = data.analysis || a.analysis;
  const analysis = typeof analysisRaw === 'string' ? JSON.parse(analysisRaw) : analysisRaw;
  const leak = analysis?.time_leak;
  const shield = analysis?.negative_marking_shield;

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
        {shield?.negative_penalty != null && (
          <p className="mt-4 text-sm text-coral">
            Negative penalty: −{shield.negative_penalty} marks
          </p>
        )}
      </div>

      {(leak || shield) && (
        <div className="rounded-3xl bg-white p-6">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab('time')}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                tab === 'time' ? 'bg-forest text-white' : 'border border-forest/15 text-forest'
              }`}
            >
              Time Leak Heatmap
            </button>
            <button
              type="button"
              onClick={() => setTab('shield')}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                tab === 'shield' ? 'bg-forest text-white' : 'border border-forest/15 text-forest'
              }`}
            >
              Guessing Shield
            </button>
          </div>

          {tab === 'time' && leak && (
            <div className="mt-5 space-y-4">
              <p className="text-sm text-slate">
                Target ~{leak.target_seconds || 30}s per question
              </p>
              {(leak.buckets || []).map((b) => (
                <div key={b.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-forest">
                      {b.label} · {b.avg_seconds}s avg
                    </span>
                    <span
                      className={
                        String(b.verdict).includes('TRAP')
                          ? 'text-coral'
                          : String(b.verdict).includes('RUSHED')
                            ? 'text-amber'
                            : 'text-teal'
                      }
                    >
                      {b.verdict}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-sand">
                    <div
                      className={`h-full rounded-full ${
                        String(b.verdict).includes('TRAP')
                          ? 'bg-coral'
                          : String(b.verdict).includes('RUSHED')
                            ? 'bg-amber'
                            : 'bg-teal'
                      }`}
                      style={{ width: `${b.bar || 40}%` }}
                    />
                  </div>
                </div>
              ))}
              {(leak.time_sinks || []).length > 0 && (
                <div className="rounded-xl bg-sand p-4 text-sm">
                  <div className="font-semibold text-forest">Time-sink questions</div>
                  <ul className="mt-2 space-y-1 text-slate">
                    {leak.time_sinks.map((t) => (
                      <li key={t.question_id || t.index}>
                        Q{t.index} ({t.topic || t.subject}): {t.seconds}s → {t.result} · cost −{t.cost}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {leak.advice && (
                <p className="rounded-xl border border-teal/30 bg-mint/40 p-3 text-sm text-forest">
                  {leak.advice}
                </p>
              )}
            </div>
          )}

          {tab === 'shield' && shield && (
            <div className="mt-5 space-y-4">
              {[
                ['sure', '100% Sure'],
                ['guess', 'Educated Guesses'],
                ['wild', 'Wild Guesses'],
              ].map(([keyName, label]) => {
                const row = shield[keyName] || {};
                return (
                  <div key={keyName} className="rounded-xl border border-forest/10 p-4 text-sm">
                    <div className="font-semibold text-forest">{label}</div>
                    <div className="mt-1 text-slate">
                      {row.attempted || 0} Qs · {row.correct || 0} correct · {row.wrong || 0} wrong · net{' '}
                      {row.net >= 0 ? '+' : ''}
                      {row.net ?? 0} pts
                    </div>
                  </div>
                );
              })}
              {shield.recommendation && (
                <p className="rounded-xl border border-coral/20 bg-coral/5 p-3 text-sm text-forest">
                  {shield.recommendation}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <AnalysisPanel analysis={analysis} />

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
        <Link to="/dashboard/readiness" className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white">
          View readiness
        </Link>
        <Link to="/dashboard/diagnosis" className="rounded-xl border border-forest/20 px-4 py-2.5 text-sm text-forest">
          Why am I not improving?
        </Link>
        <Link to="/dashboard/exam-guide" className="rounded-xl border border-forest/20 px-4 py-2.5 text-sm text-forest">
          How to crack
        </Link>
        <Link to="/dashboard/mistakes" className="rounded-xl border border-forest/20 px-4 py-2.5 text-sm text-forest">
          Mistake Book
        </Link>
        <Link to="/mock-tests" className="rounded-xl border border-forest/20 px-4 py-2.5 text-sm text-forest">
          More mocks
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
