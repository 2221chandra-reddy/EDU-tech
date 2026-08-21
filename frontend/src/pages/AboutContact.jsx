import { useState } from 'react';
import { catalogApi } from '../api/client';
import { PageHeader } from '../components/ui';

export function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader
        eyebrow="About"
        title="From content delivery to performance coaching"
        subtitle="EduGate closes score gaps for competitive exam aspirants — it does not just distribute more questions."
      />
      <div className="space-y-4 text-slate leading-relaxed">
        <p>
          Traditional platforms show “You scored 62/100” and dump 500 more questions. EduGate shows{' '}
          <strong className="text-forest">why you lost the remaining marks</strong> and tells you the 2 concepts to
          fix next.
        </p>
        <p>
          The live engine includes: Exam Readiness %, Why Am I Not Improving diagnosis, Daily Adaptive Loop,
          Mistake Book, CBT Time Leak & Negative Marking Shield, 3-day Recovery Missions, and an AI Performance Coach
          that uses your readiness data.
        </p>
        <p>
          Built for RRB NTPC/ALP/Group D, SSC CGL/CHSL/MTS, Banking (IBPS/SBI), UPSC, APPSC, TSPSC, Police and other
          State exams — especially Tier-2/3 aspirants who need coaching, not clutter.
        </p>
        <p>
          How to use EduGate: set target score → diagnostic → daily loop → weekly mock → diagnosis → recovery plan →
          ask AI Coach “how do I crack my exam?”
        </p>
      </div>
    </div>
  );
}

export function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState('');

  async function submit(e) {
    e.preventDefault();
    try {
      const res = await catalogApi.contact(form);
      setStatus(res.message);
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <PageHeader eyebrow="Contact" title="Talk to the EduGate team" subtitle="Questions about courses, CBT or partnerships." />
      <form onSubmit={submit} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
        {['name', 'email', 'subject'].map((field) => (
          <label key={field} className="block text-sm capitalize">
            <span className="mb-1 block font-medium text-forest">{field}</span>
            <input
              required={field !== 'subject'}
              type={field === 'email' ? 'email' : 'text'}
              className="w-full rounded-xl border border-forest/15 px-3 py-2.5"
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            />
          </label>
        ))}
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-forest">Message</span>
          <textarea
            required
            rows={5}
            className="w-full rounded-xl border border-forest/15 px-3 py-2.5"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </label>
        <button className="w-full rounded-xl bg-forest py-3 text-sm font-semibold text-sand">Send message</button>
        {status && <p className="text-sm text-teal">{status}</p>}
      </form>
    </div>
  );
}
