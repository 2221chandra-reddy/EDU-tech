import { useState } from 'react';
import { catalogApi } from '../api/client';
import { PageHeader } from '../components/ui';

export function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader
        eyebrow="About"
        title="An AI-powered learning ecosystem"
        subtitle="EduGate is more than an exam portal — it is where aspirants learn, practice and take CBT exams until they are ready."
      />
      <div className="space-y-4 text-slate leading-relaxed">
        <p>
          Students can learn from books, PDFs and videos; get instant help from an AI tutor; practice unlimited
          AI-generated questions; take realistic CBT mock tests; and receive personalized feedback with study recommendations.
        </p>
        <p>
          Supported exams include RRB NTPC, ALP, Group D, SSC CGL/CHSL/MTS, Banking (IBPS, SBI), UPSC, APPSC, TSPSC,
          Police Recruitment, DRDO, ISRO and other State Government exams.
        </p>
        <p>
          Future AI features on the roadmap: Study Planner, Doubt Solver, Mock Interview, Voice Tutor, Revision Generator,
          Flashcards, Quiz Generator, Progress Tracker and Personalized Learning Paths.
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
