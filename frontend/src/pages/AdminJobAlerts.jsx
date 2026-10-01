import { useEffect, useState } from 'react';
import { Sparkles, Pencil, Trash2, EyeOff } from 'lucide-react';
import { adminApi } from '../api/client';
import { PageHeader, LoadingBlock } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { JOB_CATEGORY_TABS, JobAlertCard, formatJobDate } from '../components/JobAlerts';

const emptyForm = {
  title: '',
  organization: '',
  category: 'ssc',
  start_date: '',
  end_date: '',
  vacancies: '',
  notification_url: '',
  apply_url: '',
  logo_url: '',
  summary: '',
  is_published: true,
};

const inputClass =
  'w-full rounded-xl border border-forest/10 bg-sand/30 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-teal/50 focus:bg-white focus:ring-2 focus:ring-teal/15';

function toFormDate(value) {
  return value ? String(value).slice(0, 10) : '';
}

export default function AdminJobAlerts() {
  const toast = useToast();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);

  async function refresh() {
    setAlerts(await adminApi.jobAlerts());
  }

  useEffect(() => {
    refresh()
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  function reset() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function runAiExtract() {
    if (pasteText.trim().length < 20) {
      toast.error('Paste the notification text first');
      return;
    }
    setExtracting(true);
    try {
      const data = await adminApi.extractJobAlert(pasteText);
      setForm((f) => ({
        ...f,
        title: data.title || f.title,
        organization: data.organization || f.organization,
        category: data.category || f.category,
        start_date: toFormDate(data.start_date) || f.start_date,
        end_date: toFormDate(data.end_date) || f.end_date,
        vacancies: data.vacancies ?? f.vacancies,
        notification_url: data.notification_url || f.notification_url,
        apply_url: data.apply_url || f.apply_url,
        summary: data.summary || f.summary,
      }));
      toast.success(data.source === 'ai' ? 'AI filled the form — check and publish' : 'Filled what we could — please review');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExtracting(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editingId) {
        await adminApi.updateJobAlert(editingId, form);
        toast.success('Notification updated');
      } else {
        await adminApi.createJobAlert(form);
        toast.success('Notification published');
        setPasteText('');
      }
      reset();
      await refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(a) {
    setEditingId(a.id);
    setForm({
      title: a.title || '',
      organization: a.organization || '',
      category: a.category || 'others',
      start_date: toFormDate(a.start_date),
      end_date: toFormDate(a.end_date),
      vacancies: a.vacancies ?? '',
      notification_url: a.notification_url || '',
      apply_url: a.apply_url || '',
      logo_url: a.logo_url || '',
      summary: a.summary || '',
      is_published: a.is_published !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(a) {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    try {
      await adminApi.deleteJobAlert(a.id);
      if (editingId === a.id) reset();
      toast.success('Deleted');
      await refresh();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (loading) return <LoadingBlock label="Loading job alerts…" />;

  const today = new Date().toISOString().slice(0, 10);
  const preview = { ...form, id: 'preview', vacancies: Number(form.vacancies) || null };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Admin · Job alerts"
        title="Job notifications"
        subtitle="Paste an official notification and let AI fill the details, then publish. Students see these on the home page and dashboard."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-teal/15 bg-gradient-to-br from-mint/30 to-white p-5">
            <h3 className="flex items-center gap-2 font-display text-lg text-forest">
              <Sparkles size={18} className="text-teal" /> AI auto-fill
            </h3>
            <p className="mt-1 text-xs text-slate">
              Copy text from the official notice (title, dates, vacancies, links) and paste here.
            </p>
            <textarea
              rows={6}
              className={`${inputClass} mt-3 text-xs`}
              placeholder="e.g. Staff Selection Commission — Combined Higher Secondary Level Exam 2026. Online application 07-09-2026 to 07-10-2026. Total vacancies: 2536. Apply at https://ssc.gov.in ..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <button
              type="button"
              disabled={extracting}
              onClick={runAiExtract}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-sand disabled:opacity-60"
            >
              <Sparkles size={16} /> {extracting ? 'Reading notice…' : 'Fill form with AI'}
            </button>
          </section>

          <form onSubmit={save} className="space-y-3 rounded-2xl border border-forest/8 bg-white p-5 shadow-sm">
            <h3 className="font-display text-lg text-forest">{editingId ? 'Edit notification' : 'Notification details'}</h3>

            <input
              required
              className={inputClass}
              placeholder="Title (e.g. SSC CHSL 2026)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className={inputClass}
                placeholder="Organization"
                value={form.organization}
                onChange={(e) => setForm({ ...form, organization: e.target.value })}
              />
              <select
                className={inputClass}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {JOB_CATEGORY_TABS.filter((t) => t.id !== 'all').map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-slate">
                Start date
                <input
                  type="date"
                  className={`${inputClass} mt-1`}
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </label>
              <label className="text-xs text-slate">
                Last date
                <input
                  type="date"
                  className={`${inputClass} mt-1`}
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </label>
              <label className="text-xs text-slate">
                Vacancies
                <input
                  type="number"
                  min="0"
                  className={`${inputClass} mt-1`}
                  value={form.vacancies}
                  onChange={(e) => setForm({ ...form, vacancies: e.target.value })}
                />
              </label>
            </div>
            <input
              className={inputClass}
              placeholder="Notification PDF link (https://…)"
              value={form.notification_url}
              onChange={(e) => setForm({ ...form, notification_url: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Apply online link (https://…)"
              value={form.apply_url}
              onChange={(e) => setForm({ ...form, apply_url: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Logo image URL (optional)"
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            />
            <textarea
              rows={2}
              className={inputClass}
              placeholder="Short summary (eligibility, age, fee) — optional"
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm text-forest">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
              />
              Visible to students
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-sand disabled:opacity-60"
              >
                {busy ? 'Saving…' : editingId ? 'Save changes' : 'Publish notification'}
              </button>
              {editingId && (
                <button type="button" onClick={reset} className="rounded-xl border border-forest/15 px-4 py-2.5 text-sm text-forest">
                  Cancel
                </button>
              )}
            </div>
          </form>

          {form.title && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">Preview</div>
              <JobAlertCard alert={preview} />
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-3 font-display text-lg text-forest">All notifications ({alerts.length})</h3>
          <div className="space-y-2">
            {alerts.length === 0 && (
              <div className="rounded-2xl border border-dashed border-forest/15 bg-white/60 px-6 py-12 text-center text-sm text-slate">
                No notifications yet. Paste a notice on the left to add the first one.
              </div>
            )}
            {alerts.map((a) => {
              const expired = a.end_date && String(a.end_date).slice(0, 10) < today;
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl border border-forest/8 bg-white p-3 shadow-sm shadow-forest/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold uppercase text-forest">{a.title}</span>
                      {a.is_published === false && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase text-slate">
                          <EyeOff size={11} /> hidden
                        </span>
                      )}
                      {expired && <span className="text-[10px] uppercase text-coral">expired</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate">
                      {JOB_CATEGORY_TABS.find((t) => t.id === a.category)?.label || 'Others'} ·{' '}
                      {formatJobDate(a.start_date) || '—'} – {formatJobDate(a.end_date) || '—'}
                      {a.vacancies ? ` · ${Number(a.vacancies).toLocaleString('en-IN')} vacancies` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={() => startEdit(a)} className="rounded-lg p-2 text-forest hover:bg-sand" title="Edit">
                    <Pencil size={16} />
                  </button>
                  <button type="button" onClick={() => remove(a)} className="rounded-lg p-2 text-coral hover:bg-coral/10" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
