import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { aiApi } from '../api/client';
import { PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { Send, Sparkles } from 'lucide-react';
import { safeMarkdownToHtml } from '../utils/sanitize';

const SUGGESTIONS = [
  "Explain Ohm's Law.",
  'Teach me Blood Relations.',
  'Create 20 RRB Maths questions.',
  'Summarize Percentage for SSC CGL.',
  'Explain this PDF chapter on Profit and Loss.',
];

function renderMarkdown(text) {
  const lines = String(text || '').split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('## ')) return <h2 key={i}>{line.slice(3)}</h2>;
    if (line.startsWith('### ')) return <h3 key={i}>{line.slice(4)}</h3>;
    if (line.startsWith('- ')) return <li key={i}>{line.slice(2)}</li>;
    if (line.startsWith('```')) return null;
    if (!line.trim()) return <br key={i} />;
    // Escape first, then allow only safe <strong>/<code> from our markdown helper
    return <p key={i} dangerouslySetInnerHTML={{ __html: safeMarkdownToHtml(line) }} />;
  });
}

export default function AiTutor() {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

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

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <Sparkles className="mx-auto text-amber" />
        <h1 className="mt-4 font-display text-3xl text-forest">AI Tutor</h1>
        <p className="mt-2 text-slate">Login to ask doubts, get explanations and practice questions.</p>
        <Link to="/login" className="mt-6 inline-flex rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-sand">
          Login to continue
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-5xl flex-col px-4 py-8">
      <PageHeader
        eyebrow="AI Tutor"
        title="Ask anything for your exam"
        subtitle="Explanations, examples, summaries and practice — powered by OpenAI or Gemini."
      />

      {messages.length === 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
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
            {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
          </div>
        ))}
        {loading && (
          <div className="animate-pulse-soft rounded-2xl bg-mint/60 px-4 py-3 text-sm text-slate">
            Thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask EduGate AI Tutor..."
          className="flex-1 rounded-2xl border border-forest/15 bg-white px-4 py-3 outline-none focus:border-teal"
        />
        <button type="submit" className="rounded-2xl bg-forest px-4 text-sand">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
