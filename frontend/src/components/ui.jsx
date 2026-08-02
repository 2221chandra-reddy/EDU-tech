import { Link } from 'react-router-dom';

export function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-teal">{eyebrow}</div>
        )}
        <h1 className="font-display text-3xl text-forest sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-slate">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, hint }) {
  return (
    <div className="rounded-2xl border border-dashed border-forest/20 bg-white/60 px-6 py-12 text-center">
      <div className="font-medium text-forest">{title}</div>
      {hint && <p className="mt-2 text-sm text-slate">{hint}</p>}
    </div>
  );
}

export function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm shadow-forest/5">
      <div className="text-xs font-medium uppercase tracking-wider text-slate">{label}</div>
      <div className="mt-2 font-display text-3xl text-forest">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate">{hint}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'mint' }) {
  const tones = {
    mint: 'bg-mint text-forest',
    amber: 'bg-amber-soft text-forest',
    coral: 'bg-coral/15 text-coral',
    teal: 'bg-teal/15 text-teal',
  };
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function LoadingBlock({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-pulse-soft text-sm text-slate">{label}</div>
    </div>
  );
}

export function AnalysisPanel({ analysis }) {
  if (!analysis) return null;
  return (
    <div className="space-y-4 rounded-2xl bg-forest p-6 text-sand">
      <h3 className="font-display text-2xl">AI Performance Analysis</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <div className="text-xs text-mint/70">Accuracy</div>
          <div className="mt-1 text-2xl font-semibold text-amber-soft">{analysis.accuracy}%</div>
        </div>
        <div>
          <div className="text-xs text-mint/70">Strong</div>
          <div className="mt-1 text-sm">{(analysis.strong_subjects || []).join(', ')}</div>
        </div>
        <div>
          <div className="text-xs text-mint/70">Weak</div>
          <div className="mt-1 text-sm">{(analysis.weak_subjects || []).join(', ')}</div>
        </div>
      </div>
      {(analysis.lost_marks_estimate != null || analysis.time_wasted_seconds != null) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {analysis.lost_marks_estimate != null && (
            <div className="rounded-xl bg-white/10 p-3 text-sm">
              <div className="text-xs text-mint/70">Lost marks (est.)</div>
              <div className="mt-1 text-lg font-semibold text-amber-soft">{analysis.lost_marks_estimate}</div>
            </div>
          )}
          {analysis.time_wasted_seconds != null && (
            <div className="rounded-xl bg-white/10 p-3 text-sm">
              <div className="text-xs text-mint/70">Time reclaimable</div>
              <div className="mt-1 text-lg font-semibold text-amber-soft">
                ~{Math.round((analysis.time_wasted_seconds || 0) / 60)} min
              </div>
            </div>
          )}
        </div>
      )}
      {analysis.coaching_summary && (
        <p className="rounded-xl bg-white/10 p-3 text-sm text-mint/90">{analysis.coaching_summary}</p>
      )}
      {analysis.difficulty_breakdown?.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {analysis.difficulty_breakdown.map((d) => (
            <span key={d.difficulty} className="rounded-md bg-white/10 px-2 py-1">
              {d.difficulty}: {d.correct}/{d.total} ({d.accuracy}%)
            </span>
          ))}
        </div>
      )}
      {analysis.time_management && (
        <div className="rounded-xl bg-white/10 p-4 text-sm">
          <div className="font-medium text-amber-soft">Time management</div>
          <p className="mt-1 text-mint/90">
            Avg {analysis.time_management.avg_seconds_per_question}s / question —{' '}
            {analysis.time_management.verdict}
          </p>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="text-sm font-medium text-amber-soft">Recommended study plan</div>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-mint/90">
            {(analysis.recommended_study_plan || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <div className="font-medium text-amber-soft">Suggested videos</div>
            <p className="mt-1 text-mint/90">{(analysis.suggested_videos || []).join(' · ')}</p>
          </div>
          <div>
            <div className="font-medium text-amber-soft">Suggested books</div>
            <p className="mt-1 text-mint/90">{(analysis.suggested_books || []).join(' · ')}</p>
          </div>
          <div>
            <div className="font-medium text-amber-soft">Suggested practice</div>
            <p className="mt-1 text-mint/90">{(analysis.suggested_practice || []).join(' · ')}</p>
          </div>
          <Link to="/dashboard/mistakes" className="inline-block font-medium text-amber-soft underline">
            Review Mistake Book →
          </Link>
        </div>
      </div>
    </div>
  );
}
