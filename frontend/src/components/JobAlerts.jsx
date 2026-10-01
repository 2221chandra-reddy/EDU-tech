import { useEffect, useState } from 'react';
import { FileText, BellRing } from 'lucide-react';
import { catalogApi } from '../api/client';

export const JOB_CATEGORY_TABS = [
  { id: 'all', label: 'All' },
  { id: 'banking', label: 'Banking' },
  { id: 'railways', label: 'Railways' },
  { id: 'ssc', label: 'SSC' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'police', label: 'Police' },
  { id: 'state_gov', label: 'State Gov' },
  { id: 'central_gov', label: 'Central Gov' },
  { id: 'defence', label: 'Defence' },
  { id: 'others', label: 'Others' },
];

const CATEGORY_TONE = {
  banking: 'bg-sky-50 text-sky-700',
  railways: 'bg-rose-50 text-rose-700',
  ssc: 'bg-amber-50 text-amber-700',
  insurance: 'bg-indigo-50 text-indigo-700',
  police: 'bg-slate-100 text-slate-700',
  state_gov: 'bg-emerald-50 text-emerald-700',
  central_gov: 'bg-teal-50 text-teal-700',
  defence: 'bg-lime-50 text-lime-800',
  others: 'bg-sand text-forest',
};

export function formatJobDate(value) {
  if (!value) return '';
  const d = new Date(String(value).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOpenNow(alert) {
  const today = new Date().toISOString().slice(0, 10);
  const start = alert.start_date ? String(alert.start_date).slice(0, 10) : null;
  const end = alert.end_date ? String(alert.end_date).slice(0, 10) : null;
  return (!start || start <= today) && (!end || end >= today);
}

function initials(alert) {
  const source = alert.organization || alert.title || '?';
  return source
    .split(/\s+/)
    .filter((w) => /[A-Za-z]/.test(w))
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function JobAlertCard({ alert }) {
  const open = isOpenNow(alert);
  const start = formatJobDate(alert.start_date);
  const end = formatJobDate(alert.end_date);

  return (
    <article className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm shadow-forest/5 transition hover:shadow-md">
      <div
        className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-forest/5 ${
          alert.logo_url ? 'bg-white' : CATEGORY_TONE[alert.category] || CATEGORY_TONE.others
        }`}
      >
        {alert.logo_url ? (
          <img src={alert.logo_url} alt="" className="h-full w-full object-contain p-1.5" loading="lazy" />
        ) : (
          <span className="text-sm font-bold tracking-wide">{initials(alert)}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold uppercase leading-snug text-forest">{alert.title}</h3>
        {(start || end) && (
          <p className="mt-1 text-xs text-slate">
            {start}
            {start && end ? ' – ' : ''}
            {end}
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap gap-2">
          {alert.notification_url && (
            <a
              href={alert.notification_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50/60 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
            >
              <FileText size={12} /> Notification
            </a>
          )}
          {alert.apply_url && open && (
            <a
              href={alert.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg bg-coral px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
            >
              Apply Now
            </a>
          )}
          {!open && alert.start_date && String(alert.start_date).slice(0, 10) > new Date().toISOString().slice(0, 10) && (
            <span className="inline-flex items-center rounded-lg bg-amber-soft/60 px-2.5 py-1 text-xs font-medium text-forest">
              Opens soon
            </span>
          )}
        </div>
      </div>

      {alert.vacancies ? (
        <div className="flex w-20 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-b from-forest to-ink px-2 py-2.5 text-center shadow-sm sm:w-24">
          <span className="font-display text-xl font-bold leading-none text-amber-soft sm:text-2xl">
            {Number(alert.vacancies).toLocaleString('en-IN')}
          </span>
          <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-mint/80">Vacancies</span>
        </div>
      ) : null}
    </article>
  );
}

/** Live government job notifications with category filters. */
export default function JobAlerts({ limit, title = 'Latest job notifications', subtitle }) {
  const [category, setCategory] = useState('all');
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    catalogApi
      .jobAlerts(category)
      .then(setAlerts)
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [category]);

  const shown = limit ? alerts.slice(0, limit) : alerts;

  return (
    <section>
      <div className="mb-5 text-center">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-teal">
          <BellRing size={14} /> Job alerts
        </div>
        <h2 className="mt-2 font-display text-3xl text-forest">{title}</h2>
        {subtitle && <p className="mx-auto mt-2 max-w-xl text-sm text-slate">{subtitle}</p>}
      </div>

      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {JOB_CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCategory(tab.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              category === tab.id
                ? 'bg-coral text-white shadow-sm shadow-coral/30'
                : 'border border-forest/10 bg-white text-slate hover:border-forest/25 hover:text-forest'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/70" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-forest/15 bg-white/60 px-6 py-10 text-center text-sm text-slate">
          No open notifications in this category right now. Check back soon.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((a) => (
            <JobAlertCard key={a.id} alert={a} />
          ))}
        </div>
      )}
    </section>
  );
}
