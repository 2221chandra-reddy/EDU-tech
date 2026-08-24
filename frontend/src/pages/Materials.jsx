import { useEffect, useState } from 'react';
import { catalogApi } from '../api/client';
import { PageHeader, LoadingBlock, Badge, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { studentApi } from '../api/client';

const TYPE_META = {
  book: { title: 'Books & eBooks', subtitle: 'PDF and digital books organized by exam.' },
  video: { title: 'Video Lectures', subtitle: 'Watch topic-wise lectures and continue where you left off.' },
  notes: { title: 'Notes', subtitle: 'Concise classroom-style notes for quick study.' },
  pdf: { title: 'PDF Materials', subtitle: 'Downloadable chapter PDFs and handouts.' },
  mindmap: { title: 'Mind Maps', subtitle: 'Visual maps for revision and recall.' },
  revision: { title: 'Quick Revision Notes', subtitle: 'Last-minute formula and concept sheets.' },
  current_affairs: { title: 'Current Affairs', subtitle: 'Weekly digests for GA sections.' },
  previous_paper: { title: 'Previous Year Papers', subtitle: 'Past papers with exam-style practice.' },
};

export default function MaterialsPage({ type }) {
  const meta = TYPE_META[type] || { title: 'Study Materials', subtitle: 'All learning resources in one place.' };
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    setLoading(true);
    const params = type ? { type } : {};
    catalogApi
      .materials(params)
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [type]);

  async function bookmark(id) {
    if (!user) return alert('Please login to bookmark');
    await studentApi.bookmark(id);
    alert('Bookmarked');
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <PageHeader eyebrow="Learning module" title={meta.title} subtitle={meta.subtitle} />
      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState title="No materials yet" hint="Admin can upload books, videos and notes from the panel." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => (
            <article key={m.id} className="rounded-2xl bg-white p-5 shadow-sm shadow-forest/5">
              <Badge tone="amber">{m.type}</Badge>
              <h3 className="mt-3 font-display text-xl text-forest">{m.title}</h3>
              <p className="mt-2 text-sm text-slate">{m.description}</p>
              <div className="mt-3 text-xs text-slate">
                {m.exam_name || 'General'} · {m.subject || '—'} · {m.topic || '—'}
              </div>
              {m.type === 'video' && m.video_url && (
                <div className="mt-4 overflow-hidden rounded-xl bg-ink/5">
                  {m.video_url.startsWith('/uploads/') ||
                  /amazonaws\.com/i.test(m.video_url) ||
                  /\.(mp4|webm|ogg|mov)(\?|$)/i.test(m.video_url) ? (
                    <video
                      controls
                      className="aspect-video w-full bg-black"
                      src={m.video_url}
                    >
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <iframe
                      title={m.title}
                      src={m.video_url}
                      className="aspect-video w-full"
                      allowFullScreen
                    />
                  )}
                </div>
              )}
              {m.file_url && (
                <a
                  href={m.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-sm font-medium text-teal hover:text-forest"
                >
                  Open / download file
                </a>
              )}
              <button
                onClick={() => bookmark(m.id)}
                className="mt-4 text-sm font-medium text-teal hover:text-forest"
              >
                Bookmark
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
