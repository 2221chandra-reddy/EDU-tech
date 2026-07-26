import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { aiApi, catalogApi } from '../api/client';
import { PageHeader, Badge, LoadingBlock } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function AiGenerator() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [form, setForm] = useState({
    exam: 'RRB NTPC',
    subject: 'Mathematics',
    topic: 'Percentage',
    difficulty: 'medium',
    count: 10,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    catalogApi.exams().then(setExams).catch(() => {});
  }, []);

  async function generate(e) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await aiApi.generateQuestions(form);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-display text-3xl text-forest">AI Question Generator</h1>
        <p className="mt-2 text-slate">Login to generate MCQs with answers and explanations.</p>
        <Link to="/login" className="mt-6 inline-block text-teal">Login</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        eyebrow="AI Question Generator"
        title="Generate practice tests instantly"
        subtitle="Choose exam, subject, topic, difficulty and count — AI creates MCQs with explanations."
      />

      <form onSubmit={generate} className="grid gap-4 rounded-3xl bg-white p-6 shadow-sm sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-forest">Exam</span>
          <select
            className="w-full rounded-xl border border-forest/15 px-3 py-2.5"
            value={form.exam}
            onChange={(e) => setForm({ ...form, exam: e.target.value })}
          >
            {exams.map((ex) => (
              <option key={ex.id} value={ex.name}>{ex.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-forest">Subject</span>
          <input
            className="w-full rounded-xl border border-forest/15 px-3 py-2.5"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-forest">Topic</span>
          <input
            className="w-full rounded-xl border border-forest/15 px-3 py-2.5"
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-forest">Difficulty</span>
          <select
            className="w-full rounded-xl border border-forest/15 px-3 py-2.5"
            value={form.difficulty}
            onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-forest">Number of questions</span>
          <input
            type="number"
            min={1}
            max={50}
            className="w-full rounded-xl border border-forest/15 px-3 py-2.5"
            value={form.count}
            onChange={(e) => setForm({ ...form, count: Number(e.target.value) })}
          />
        </label>
        {error && <div className="sm:col-span-2 text-sm text-coral">{error}</div>}
        <button
          disabled={loading}
          className="sm:col-span-2 rounded-xl bg-forest py-3 text-sm font-semibold text-sand disabled:opacity-60"
        >
          {loading ? 'Generating...' : 'Generate Practice Test'}
        </button>
      </form>

      {loading && <LoadingBlock />}

      {result && (
        <div className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-forest">Generated questions</h2>
            {result.practice_set && (
              <button
                onClick={() => navigate(`/practice/${result.practice_set.id}`)}
                className="rounded-lg bg-teal px-3 py-2 text-sm font-medium text-sand"
              >
                Take practice test
              </button>
            )}
          </div>
          {result.note && (
            <p className="rounded-xl bg-amber/15 px-4 py-3 text-sm text-forest">{result.note}</p>
          )}
          {(result.questions || []).map((q, i) => (
            <div key={q.id || i} className="rounded-2xl bg-white p-5">
              <div className="flex gap-2">
                <Badge>{q.difficulty}</Badge>
                <Badge tone="amber">{q.topic}</Badge>
              </div>
              <p className="mt-2 text-sm font-medium text-forest">
                Q{i + 1}. {q.question_text}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate">
                <li>A. {q.option_a}</li>
                <li>B. {q.option_b}</li>
                <li>C. {q.option_c}</li>
                <li>D. {q.option_d}</li>
              </ul>
              <p className="mt-2 text-xs text-teal">Answer: {q.correct_option}</p>
              <p className="mt-1 text-sm text-slate">{q.explanation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
