import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const PLAYBOOKS = [
  {
    id: 'rrb-ntpc',
    exam: 'RRB NTPC',
    goal: 'Close the score gap with speed + accuracy, not more PDFs.',
    sections: [
      {
        title: 'Paper DNA',
        points: [
          'Maths + Reasoning decide rank; GA is the mark-leak zone for most aspirants.',
          'Negative marking punishes wild guesses — skip beats panic attempts.',
          'Target: steady 30–40s/question average with hard skip after ~45s.',
        ],
      },
      {
        title: 'Daily Loop (15–45 min)',
        points: [
          '5-min revision of ONE weak concept from Readiness / Mistake Book.',
          '10–15 accuracy questions on that concept only.',
          'Re-test yesterday’s mistakes (Mistake-to-Mastery).',
          'Ask AI Coach: “Explain [topic] with RRB exam tricks + 5 MCQs”.',
        ],
      },
      {
        title: 'Weekly mock ritual',
        points: [
          '1 full CBT mock under timer.',
          'Open Time Leak + Guessing analysis on result.',
          'Open Why Am I Not Improving? → accept 3-day recovery mission.',
          'Track readiness % — goal is lifting expected score toward your target.',
        ],
      },
    ],
  },
  {
    id: 'ssc-cgl',
    exam: 'SSC CGL Tier 1',
    goal: 'Quant + English accuracy first; GA breadth with skip discipline.',
    sections: [
      {
        title: 'Paper DNA',
        points: [
          'Quant & English create the ceiling; GA creates the variance.',
          'Careless arithmetic and option-trap MCQs leak more marks than “hard” concepts.',
          'Build a Sure / Educated Guess habit before every attempt.',
        ],
      },
      {
        title: 'Daily Loop',
        points: [
          'Revision: formulas + previous wrong concepts (not new chapters every day).',
          'Adaptive practice focused on your lowest sectional mastery bar.',
          'AI Coach for “why this option is a trap” explanations.',
          'Log every wrong Q into Mistake Book until resolved.',
        ],
      },
      {
        title: 'Score-gap play',
        points: [
          'Set target score in Profile → watch Gap to Close on Readiness.',
          'If plateaued for 3+ mocks, run Diagnosis — don’t add more random mocks.',
          'Fix top 2 concept clusters before chasing full syllabus completion.',
        ],
      },
    ],
  },
  {
    id: 'banking',
    exam: 'Banking (IBPS / SBI)',
    goal: 'Speed in Quant/Reasoning + precision in English; no emotional guessing.',
    sections: [
      {
        title: 'Paper DNA',
        points: [
          'Sectional timing pressure creates rushed & careless zones.',
          'Puzzle/DI time traps ruin later easy marks — skip early.',
          'Readiness behavioral metrics (speed + guess risk) matter as much as accuracy.',
        ],
      },
      {
        title: 'Daily Loop',
        points: [
          'One speed drill (timed 10 Qs) + one accuracy drill (untimed weak concept).',
          'AI Coach: ask for “30-second method” for DI / puzzle patterns.',
          'Weekly mock → diagnosis → recovery plan Day 1 concept drill.',
        ],
      },
      {
        title: 'Exam-day calm',
        points: [
          'Treat every mock like the real CBT interface.',
          'Never chase a stuck set beyond your skip rule.',
          'After mock, study mark leaks — not just rank.',
        ],
      },
    ],
  },
];

const ENGINE_STEPS = [
  { title: 'Score Gap Engine', text: 'Target vs expected score — know exactly how many marks to close.' },
  { title: 'Why Am I Not Improving?', text: 'Find leaks: guessing, time traps, concept clusters.' },
  { title: 'Daily Adaptive Loop', text: 'Revision → accuracy Qs → mistake re-test — 15 minutes is enough.' },
  { title: 'AI Performance Coach', text: 'Ask how to crack, why a mock stalled, or how to fix one weak topic.' },
  { title: 'CBT Analysis', text: 'Time Leak heatmap + Negative Marking Shield after every mock.' },
  { title: '3-Day Recovery', text: 'Accept mission from Diagnosis — concept drill → skip strategy → timed mini-CBT.' },
];

export default function ExamGuide() {
  const { user } = useAuth();
  const target = user?.target_exam || '';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Exam Success Engine"
        title="How to crack the exam"
        subtitle="Stop collecting content. Close your score gap with daily loops, diagnosis, and AI coaching."
      />

      <section className="rounded-3xl bg-forest p-6 text-sand">
        <h2 className="font-display text-2xl text-amber-soft">Traditional EdTech → EduGate</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <div className="rounded-xl bg-white/10 p-4">
            <div className="text-xs uppercase tracking-wider text-mint/70">Old way</div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-mint/90">
              <li>Distribute more PDFs & 500 questions</li>
              <li>Show only “You scored 62/100”</li>
              <li>Overwhelmed, passive student</li>
            </ul>
          </div>
          <div className="rounded-xl bg-amber-soft/20 p-4">
            <div className="text-xs uppercase tracking-wider text-amber-soft">EduGate way</div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sand">
              <li>Fix 2 specific concepts holding the gap</li>
              <li>Explain “why you lost 38 marks”</li>
              <li>Targeted, coached, daily mission</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5">
        <h2 className="font-display text-xl text-forest">Your operating system (use this order)</h2>
        <ol className="mt-4 space-y-3">
          {ENGINE_STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3 rounded-xl border border-forest/10 p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest text-sm font-semibold text-sand">
                {i + 1}
              </span>
              <div>
                <div className="font-semibold text-forest">{s.title}</div>
                <p className="text-sm text-slate">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/dashboard/readiness" className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white">
            Open Readiness
          </Link>
          <Link to="/dashboard/diagnosis" className="rounded-xl border border-forest/20 px-4 py-2.5 text-sm text-forest">
            Why am I not improving?
          </Link>
          <Link to="/dashboard/ai-tutor" className="rounded-xl border border-forest/20 px-4 py-2.5 text-sm text-forest">
            Ask AI Coach
          </Link>
        </div>
      </section>

      {PLAYBOOKS.map((book) => {
        const highlight =
          target &&
          (book.exam.toLowerCase().includes(String(target).toLowerCase()) ||
            String(target).toLowerCase().includes(book.exam.split(' ')[0].toLowerCase()));
        return (
          <section
            key={book.id}
            className={`rounded-2xl p-5 ${highlight ? 'border-2 border-teal bg-mint/30' : 'bg-white'}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl text-forest">{book.exam}</h2>
              {highlight && (
                <span className="rounded-lg bg-teal px-2 py-1 text-xs font-semibold text-white">Your target</span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate">{book.goal}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {book.sections.map((sec) => (
                <div key={sec.title} className="rounded-xl bg-sand/80 p-4">
                  <div className="text-sm font-semibold text-forest">{sec.title}</div>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate">
                    {sec.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <Link
              to="/dashboard/ai-tutor"
              className="mt-4 inline-block text-sm font-medium text-teal"
              state={{ preset: `How do I crack ${book.exam}? Give me a 7-day score-gap plan.` }}
            >
              Ask AI: How do I crack {book.exam}? →
            </Link>
          </section>
        );
      })}

      <section className="rounded-2xl border border-amber bg-amber/10 p-5">
        <h2 className="font-display text-xl text-forest">Ask the AI Coach anything like this</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-forest">
          <li>“Why am I stuck at 64 marks?”</li>
          <li>“Explain Pipe & Cisterns for SSC with the fastest method.”</li>
          <li>“Build my skip strategy for negative marking.”</li>
          <li>“What should I do in the next 3 days to close a 15-mark gap?”</li>
        </ul>
      </section>
    </div>
  );
}
