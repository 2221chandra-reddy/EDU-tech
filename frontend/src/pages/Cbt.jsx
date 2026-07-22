import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { cbtApi } from '../api/client';
import { AnalysisPanel, LoadingBlock } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export function CbtInstructions() {
  const { id } = useParams();
  const [mock, setMock] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    cbtApi.mock(id).then(setMock).catch(console.error);
  }, [id]);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p>Login required for CBT.</p>
        <Link to="/login" className="mt-3 inline-block text-teal">Login</Link>
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
        <button
          onClick={() => navigate(`/cbt/${id}/exam`)}
          className="mt-8 rounded-xl bg-forest px-6 py-3 text-sm font-semibold text-sand"
        >
          Start CBT
        </button>
      </div>
    </div>
  );
}

export function CbtExam() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
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
    if (!user) return;
    cbtApi.start(id).then((data) => {
      setSession(data);
      setAnswers(data.attempt.answers || {});
      setMarked(data.attempt.marked_for_review || []);
      setVisited(data.attempt.visited || []);
      setSecondsLeft((data.mock.duration_minutes || 30) * 60);
      startedAt.current = Date.now();
      if (data.questions?.[0]) {
        setVisited((v) => (v.includes(data.questions[0].id) ? v : [...v, data.questions[0].id]));
      }
    });
  }, [id, user]);

  useEffect(() => {
    if (secondsLeft === null || submitting) return;
    if (secondsLeft <= 0) {
      handleSubmit(true);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, submitting]);

  useEffect(() => {
    if (!session?.attempt?.id) return undefined;
    const t = setInterval(() => {
      autosave();
    }, 15000);
    return () => clearInterval(t);
  });

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
        <Link to="/login" className="text-teal">Login required</Link>
      </div>
    );
  }
  if (!session || !q) return <LoadingBlock />;

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
            secondsLeft < 60 ? 'bg-coral/15 text-coral' : 'bg-forest text-sand'
          }`}
        >
          {mm}:{ss}
        </div>
        <button
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
              onClick={() => goTo(Math.max(0, current - 1))}
              disabled={current === 0}
              className="rounded-lg border border-forest/15 px-4 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button onClick={toggleMark} className="rounded-lg border border-amber px-4 py-2 text-sm text-forest">
              {marked.includes(q.id) ? 'Unmark' : 'Mark for review'}
            </button>
            <button
              onClick={() => goTo(Math.min(questions.length - 1, current + 1))}
              disabled={current === questions.length - 1}
              className="rounded-lg bg-forest px-4 py-2 text-sm text-sand disabled:opacity-40"
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
            <div><span className="mr-2 inline-block h-2.5 w-2.5 rounded bg-teal" />Answered</div>
            <div><span className="mr-2 inline-block h-2.5 w-2.5 rounded bg-amber" />Marked</div>
            <div><span className="mr-2 inline-block h-2.5 w-2.5 rounded bg-mint" />Visited</div>
            <div><span className="mr-2 inline-block h-2.5 w-2.5 rounded bg-sand" />Not visited</div>
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
  const { user } = useAuth();

  useEffect(() => {
    if (data || !user) return;
    cbtApi.answerKey(attemptId).then(setData).catch(console.error);
  }, [attemptId, user, data]);

  if (!data) return <LoadingBlock />;
  const attempt = data.attempt;
  let analysis = data.analysis || attempt.analysis;
  if (typeof analysis === 'string') {
    try {
      analysis = JSON.parse(analysis);
    } catch {
      analysis = null;
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <div>
        <h1 className="font-display text-4xl text-forest">Exam result</h1>
        <p className="mt-2 text-slate">Evaluation complete with AI performance analysis and answer key.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Score label="Score" value={attempt.score} />
        <Score label="Correct" value={attempt.correct_count} />
        <Score label="Wrong" value={attempt.wrong_count} />
        <Score label="Unattempted" value={attempt.unattempted_count} />
      </div>

      <AnalysisPanel analysis={analysis} />

      <div>
        <h2 className="font-display text-2xl text-forest">Answer key</h2>
        <div className="mt-4 space-y-4">
          {(data.answer_key || []).map((q, i) => (
            <div key={q.id} className="rounded-2xl bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-medium text-forest">
                  Q{i + 1}. {q.question_text}
                </div>
                <span className={`text-xs font-semibold ${q.is_correct ? 'text-teal' : 'text-coral'}`}>
                  {q.is_correct ? 'Correct' : q.your_answer ? 'Wrong' : 'Skipped'}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate">
                Your answer: {q.your_answer || '—'} · Correct: {q.correct_option}
              </div>
              {q.explanation && <p className="mt-2 text-sm text-slate">{q.explanation}</p>}
            </div>
          ))}
        </div>
      </div>

      <Link to="/dashboard" className="inline-flex rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-sand">
        Back to dashboard
      </Link>
    </div>
  );
}

function Score({ label, value }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <div className="text-xs uppercase tracking-wider text-slate">{label}</div>
      <div className="mt-1 font-display text-3xl text-forest">{value}</div>
    </div>
  );
}
