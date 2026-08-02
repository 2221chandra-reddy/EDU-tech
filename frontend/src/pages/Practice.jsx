import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { practiceApi } from '../api/client';
import { PageHeader, LoadingBlock, Badge, AnalysisPanel } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function Practice({ embedded = false }) {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    practiceApi
      .sets()
      .then(setSets)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const body = (
    <>
      {!embedded && (
        <PageHeader
          eyebrow="Practice mode"
          title="Unlimited topic-wise practice"
          subtitle="Topic, chapter, subject, daily quiz, timed quiz and previous-year drills."
          action={
            <Link
              to={user ? '/dashboard/ai-generator' : '/login'}
              className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white"
            >
              AI Question Generator
            </Link>
          }
        />
      )}

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {['topic', 'daily', 'timed', 'previous_year'].map((mode) => (
          <div key={mode} className="rounded-xl bg-white px-4 py-3 text-sm capitalize text-forest shadow-sm">
            {mode.replace('_', ' ')} tests
          </div>
        ))}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sets.map((s) => (
            <div key={s.id} className="rounded-2xl bg-white p-5 shadow-sm shadow-forest/5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge>{s.mode}</Badge>
                  <h3 className="mt-2 font-display text-xl text-forest">{s.title}</h3>
                  <p className="mt-1 text-sm text-slate">
                    {s.exam_name || 'General'} · {s.subject || 'Mixed'} · {s.question_count} Qs
                    {s.time_limit_minutes ? ` · ${s.time_limit_minutes} min` : ''}
                  </p>
                </div>
                {user ? (
                  <Link
                    to={`/practice/${s.id}`}
                    className="shrink-0 rounded-lg bg-teal px-3 py-2 text-sm font-medium text-white"
                  >
                    Start
                  </Link>
                ) : (
                  <Link to="/login" className="shrink-0 text-sm font-medium text-teal">
                    Login
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (embedded) return <div>{body}</div>;
  return <div className="mx-auto max-w-7xl px-4 py-10">{body}</div>;
}

export function PracticeAttempt() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [startedAt] = useState(Date.now());
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    practiceApi.set(id).then(setData).catch(console.error);
  }, [id, user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-slate">Please login to attempt practice tests.</p>
        <Link to="/login" className="mt-4 inline-block text-teal">Login</Link>
      </div>
    );
  }

  if (!data) return <LoadingBlock />;

  async function submit() {
    const time_taken_seconds = Math.round((Date.now() - startedAt) / 1000);
    const res = await practiceApi.submit({ practice_set_id: id, answers, time_taken_seconds });
    setResult(res);
  }

  if (result) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <h1 className="font-display text-3xl text-forest">Practice result</h1>
        <p className="text-slate">
          Score: {result.attempt.score}/{result.attempt.total} ({result.attempt.accuracy}%)
        </p>
        <AnalysisPanel analysis={result.analysis} />
        <button onClick={() => navigate('/practice')} className="rounded-xl bg-forest px-4 py-2 text-sm text-sand">
          Back to practice
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl text-forest">{data.title}</h1>
      <p className="mt-2 text-sm text-slate">{data.questions?.length} questions</p>
      <div className="mt-8 space-y-6">
        {data.questions?.map((q, idx) => (
          <div key={q.id} className="rounded-2xl bg-white p-5">
            <div className="text-sm font-medium text-forest">
              Q{idx + 1}. {q.question_text}
            </div>
            <div className="mt-3 grid gap-2">
              {['A', 'B', 'C', 'D'].map((opt) => (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                    answers[q.id] === opt ? 'border-teal bg-mint' : 'border-forest/10'
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === opt}
                    onChange={() => setAnswers({ ...answers, [q.id]: opt })}
                  />
                  <span>
                    {opt}. {q[`option_${opt.toLowerCase()}`]}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={submit} className="mt-8 rounded-xl bg-forest px-6 py-3 text-sm font-semibold text-sand">
        Submit practice
      </button>
    </div>
  );
}
