import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { studentApi } from '../api/client';
import { LoadingBlock, PageHeader } from '../components/ui';
import { useToast } from '../context/ToastContext';

export function ReadinessDashboard() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    studentApi
      .readiness()
      .then(setData)
      .catch((err) => toast.error(err.message || 'Failed to load readiness'));
  }, []);

  async function startMission() {
    setBusy(true);
    try {
      const set = await studentApi.adaptivePractice();
      navigate(`/practice/${set.practice_set_id}`);
    } catch (err) {
      toast.error(err.message || 'Could not start mission');
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <LoadingBlock label="Computing exam readiness…" />;

  const b = data.behavioral || {};

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Exam Success Engine"
        title="EduGate Readiness Engine"
        subtitle={
          data.target_exam
            ? `${data.target_exam} · close the score gap with diagnosis, daily loops & AI coaching`
            : 'Close your score gap with diagnosis, daily loops & AI coaching'
        }
      />

      <section className="rounded-3xl bg-forest p-6 text-sand sm:p-8">
        <div className="text-xs uppercase tracking-wider text-mint/70">Overall exam readiness</div>
        <div className="mt-3 flex flex-wrap items-end gap-6">
          <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-amber-soft/80 bg-white/10">
            <div className="text-center">
              <div className="font-mono text-3xl font-bold text-amber-soft">{data.readiness_percent}%</div>
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-amber-soft">Status: {data.status}</div>
            <p className="mt-2 text-sm text-mint/90">
              Target Score: {data.target_score}/100 · Current Expected: {data.current_expected_score}/100
            </p>
            <div className="mt-3 inline-block rounded-lg bg-coral/90 px-3 py-1.5 text-sm font-semibold text-white">
              Gap to close: {data.gap_to_close} marks
              {data.days_left != null ? ` · ${data.days_left} days left` : ''}
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber bg-amber/15 px-5 py-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-forest">
            {data.critical_diagnosis ? 'Critical diagnosis available' : 'Diagnostic insight'}
          </div>
          <p className="mt-1 font-display text-xl text-forest">Why am I not improving?</p>
        </div>
        <Link
          to="/dashboard/diagnosis"
          className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white"
        >
          View diagnosis
        </Link>
      </section>

      <section className="rounded-2xl bg-white p-5">
        <h2 className="font-display text-xl text-forest">Sectional breakdown</h2>
        <div className="mt-4 space-y-3">
          {(data.sectional || []).map((s) => (
            <div key={s.subject}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium text-forest">{s.subject}</span>
                <span className="text-slate">
                  {s.mastery}% · +{s.pts_left} pts left
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-sand">
                <div
                  className={`h-full rounded-full ${
                    s.mastery >= 75 ? 'bg-teal' : s.mastery >= 55 ? 'bg-amber' : 'bg-coral'
                  }`}
                  style={{ width: `${Math.min(100, s.mastery)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5">
        <h2 className="font-display text-xl text-forest">Behavioral metrics</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="Accuracy rate" value={`${b.accuracy_rate ?? '—'}%`} />
          <Metric label="Speed rating" value={`${b.speed_rating ?? '—'}%`} />
          <Metric label="Strategy score" value={`${b.strategy_score ?? '—'}%`} />
          <Metric
            label="Guess risk"
            value={b.guess_risk || '—'}
            tone={b.guess_risk === 'HIGH' ? 'coral' : b.guess_risk === 'MEDIUM' ? 'amber' : 'teal'}
          />
          <Metric label="Time traps" value={`${b.time_traps ?? 0}/mock`} tone={b.time_traps >= 3 ? 'amber' : 'teal'} />
          <Metric label="Careless loss" value={`${b.careless_loss ?? 0} pts`} tone="coral" />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5">
        <h2 className="font-display text-xl text-forest">Today&apos;s adaptive mission</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-forest">
          {(data.mission_hint || []).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={startMission}
            className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Starting…' : "Start today's mission"}
          </button>
          <Link
            to="/dashboard/diagnosis"
            className="rounded-xl border border-forest/20 px-4 py-2.5 text-sm text-forest"
          >
            Open diagnosis
          </Link>
          <Link
            to="/dashboard/exam-guide"
            className="rounded-xl border border-forest/20 px-4 py-2.5 text-sm text-forest"
          >
            How to crack
          </Link>
          <Link
            to="/dashboard/ai-tutor"
            state={{ preset: 'What should I do this week to close my score gap?' }}
            className="rounded-xl border border-forest/20 px-4 py-2.5 text-sm text-forest"
          >
            Ask AI Coach
          </Link>
        </div>
      </section>
    </div>
  );
}

export function DiagnosisPage() {
  const [data, setData] = useState(null);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    studentApi
      .whyNotImproving()
      .then(setData)
      .catch((err) => toast.error(err.message || 'Failed to load diagnosis'));
  }, []);

  async function acceptMission() {
    setBusy(true);
    try {
      const recovery = await studentApi.recoveryPlan();
      setPlan(recovery);
      toast.success('3-day recovery mission accepted');
      const set = await studentApi.adaptivePractice();
      navigate(`/practice/${set.practice_set_id}`);
    } catch (err) {
      toast.error(err.message || 'Could not create recovery plan');
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <LoadingBlock label="Running root-cause diagnosis…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Diagnostic Insight Engine"
        title="Why am I not improving?"
        subtitle="Score leaks broken into guessing, time traps, and concept clusters."
      />

      <section className="rounded-2xl bg-white p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate">
          {data.plateau_detected ? 'Score plateau detected across recent mocks' : 'Recent mock trajectory'}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(data.mock_labels || []).map((m) => (
            <span key={m.label} className="rounded-lg bg-sand px-3 py-1.5 text-sm text-forest">
              {m.label}: {m.score ?? '—'}
            </span>
          ))}
          {!data.mock_labels?.length && (
            <span className="text-sm text-slate">No evaluated mocks yet — run a CBT to unlock deeper diagnosis.</span>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5">
        <h2 className="font-display text-xl text-forest">Root cause analysis</h2>
        <div className="mt-4 space-y-3">
          {(data.causes || []).map((c, i) => (
            <div key={c.id} className="rounded-xl border border-forest/10 p-4">
              <div className="font-semibold text-forest">
                {i + 1}. {c.title}{' '}
                <span className="text-coral">
                  ({c.marks_impact > 0 ? '+' : ''}
                  {c.marks_impact} marks)
                </span>
              </div>
              <p className="mt-2 text-sm text-slate">{c.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-forest p-5 text-sand">
        <h2 className="font-display text-xl text-amber-soft">Your 3-day targeted recovery plan</h2>
        <div className="mt-4 space-y-3">
          {(plan?.days || data.recovery_outline || []).map((d) => (
            <div key={d.day} className="rounded-xl bg-white/10 p-4 text-sm">
              <div className="font-semibold text-amber-soft">
                Day {d.day}: {d.theme}
              </div>
              <div className="mt-1 text-mint/90">Focus: {d.focus}</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-mint/90">
                {(d.tasks || []).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={acceptMission}
            className="rounded-xl bg-amber-soft px-4 py-2.5 text-sm font-semibold text-forest disabled:opacity-60"
          >
            {busy ? 'Starting…' : plan ? 'Restart Day 1 practice' : 'Accept mission & start Day 1'}
          </button>
          <Link to="/dashboard/readiness" className="rounded-xl border border-white/30 px-4 py-2.5 text-sm text-sand">
            Back to readiness
          </Link>
          <Link to="/dashboard/exam-guide" className="rounded-xl border border-white/30 px-4 py-2.5 text-sm text-sand">
            How to crack
          </Link>
          <Link
            to="/dashboard/ai-tutor"
            state={{ preset: 'Explain my mark leaks and give a 3-day plan to close the score gap.' }}
            className="rounded-xl border border-white/30 px-4 py-2.5 text-sm text-sand"
          >
            Ask AI Coach
          </Link>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone = 'forest' }) {
  const color =
    tone === 'coral' ? 'text-coral' : tone === 'amber' ? 'text-amber' : tone === 'teal' ? 'text-teal' : 'text-forest';
  return (
    <div className="rounded-xl bg-sand px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-slate">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
