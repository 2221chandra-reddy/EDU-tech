import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { aiApi } from '../api/client';
import { PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { Send, Sparkles } from 'lucide-react';
import { safeMarkdownToHtml } from '../utils/sanitize';

const SUGGESTIONS = [
  'How do I crack my exam? Give a 7-day score-gap plan.',
  'Why am I not improving even after mocks?',
  'Teach me the Negative Marking skip strategy.',
  'Explain Percentage for SSC/RRB with fastest tricks + 5 MCQs.',
  'What should I revise today to close my score gap?',
];

function renderMarkdown(text) {
  const lines = String(text || '').split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('## ')) return <h2 key={i}>{line.slice(3)}</h2>;
    if (line.startsWith('### ')) return <h3 key={i}>{line.slice(4)}</h3>;
    if (line.startsWith('- ')) return <li key={i}>{line.slice(2)}</li>;
    if (line.startsWith('```')) return null;
    if (!line.trim()) return <br key={i} />;
    return <p key={i} dangerouslySetInnerHTML={{ __html: safeMarkdownToHtml(line) }} />;
  });
}

export default function AiTutor() {
  const { user } = useAuth();
  const location = useLocation();
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const presetSent = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text = input) {
    if (!user) return;
    const message = text.trim();
    if (!message || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setLoading(true);
    try {
      const res = await aiApi.chat({ session_id: sessionId, message });
      setSessionId(res.session_id);
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const preset = location.state?.preset;
    if (!user || !preset || presetSent.current) return undefined;
    presetSent.current = true;
    const t = setTimeout(() => send(preset), 0);
    return () => clearTimeout(t);
  }, [user, location.state]);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <Sparkles className="mx-auto text-amber" />
        <h1 className="mt-4 font-display text-3xl text-forest">AI Performance Coach</h1>
        <p className="mt-2 text-slate">Login to get score-gap coaching, exam strategies and concept explanations.</p>
        <Link to="/login" className="mt-6 inline-flex rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-sand">
          Login to continue
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-5xl flex-col px-4 py-8">
      <PageHeader
        eyebrow="AI Performance Coach"
        title="Close the gap — don’t collect more content"
        subtitle="Ask how to crack your exam, why marks leak, or how to fix one weak topic. Coach uses your readiness data."
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link to="/dashboard/exam-guide" className="rounded-lg border border-forest/15 bg-white px-3 py-1.5 text-forest">
          Crack Exam guide
        </Link>
        <Link to="/dashboard/readiness" className="rounded-lg border border-forest/15 bg-white px-3 py-1.5 text-forest">
          Readiness
        </Link>
        <Link to="/dashboard/diagnosis" className="rounded-lg border border-forest/15 bg-white px-3 py-1.5 text-forest">
          Diagnosis
        </Link>
      </div>

      {messages.length === 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="rounded-full border border-forest/15 bg-white px-3 py-1.5 text-left text-sm text-forest hover:border-teal"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto rounded-3xl bg-white p-4 shadow-sm sm:p-6">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm ${
              m.role === 'user' ? 'ml-auto bg-forest text-sand' : 'bg-mint/60 text-ink prose-ai'
            }`}
          >
            {m.role === 'assistant' ? <div className="space-y-1">{renderMarkdown(m.content)}</div> : m.content}
          </div>
        ))}
        {loading && <div className="text-sm text-slate">Coach is thinking…</div>}
        <div ref={bottomRef} />
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          className="flex-1 rounded-xl border border-forest/15 bg-white px-4 py-3 text-sm"
          placeholder="Ask: how to crack, why stuck, explain a concept…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-sand disabled:opacity-60"
        >
          <Send size={16} /> Send
        </button>
      </form>
    </div>
  );
}
