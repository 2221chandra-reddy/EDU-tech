import { useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Badge } from './ui';

function isPdfUrl(url = '') {
  return /\.pdf(\?|$)/i.test(url);
}

function isImageUrl(url = '') {
  return /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url);
}

function isTxtUrl(url = '') {
  return /\.txt(\?|$)/i.test(url);
}

function isDirectVideoUrl(url = '') {
  return url.startsWith('/uploads/') || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

function TxtFileReader({ url }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('Could not load text file');
        return r.text();
      })
      .then((t) => {
        if (!cancelled) setText(t.slice(0, 100000));
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (err) return <p className="text-sm text-coral">{err}</p>;
  if (!text) return <p className="text-sm text-slate">Loading text...</p>;

  return (
    <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-forest/10 bg-sand/40 p-4 font-mono text-sm leading-relaxed text-forest whitespace-pre-wrap">
      {text}
    </div>
  );
}

/**
 * Admin / student viewer: watch videos, read PDFs, textbook text.
 */
export default function MaterialViewer({ material, onClose }) {
  if (!material) return null;

  const isVideo = material.type === 'video' && material.video_url;
  const fileUrl = material.file_url || '';
  const hasPdf = fileUrl && isPdfUrl(fileUrl);
  const hasImage = fileUrl && isImageUrl(fileUrl);
  const hasTxt = fileUrl && isTxtUrl(fileUrl);
  const chapterText = material.content_text?.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-forest/10 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <Badge tone="amber">{material.type}</Badge>
              {isVideo && <Badge>Video</Badge>}
              {hasPdf && <Badge tone="teal">PDF</Badge>}
            </div>
            <h2 className="mt-1 font-display text-xl text-forest">{material.title}</h2>
            <p className="text-sm text-slate">
              {material.exam_name || '—'} · {material.subject || '—'} · {material.topic || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate hover:bg-sand"
            aria-label="Close viewer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {material.description && (
            <p className="mb-4 text-sm text-slate">{material.description}</p>
          )}

          {isVideo && (
            <div className="overflow-hidden rounded-xl bg-black">
              {isDirectVideoUrl(material.video_url) ? (
                <video
                  controls
                  autoPlay
                  className="aspect-video w-full"
                  src={material.video_url}
                >
                  Your browser does not support video playback.
                </video>
              ) : (
                <iframe
                  title={material.title}
                  src={material.video_url}
                  className="aspect-video w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          )}

          {!isVideo && hasPdf && (
            <iframe
              title={material.title}
              src={fileUrl}
              className="h-[min(70vh,720px)] w-full rounded-xl border border-forest/10 bg-sand"
            />
          )}

          {!isVideo && !hasPdf && hasImage && (
            <img
              src={fileUrl}
              alt={material.title}
              className="mx-auto max-h-[70vh] rounded-xl border border-forest/10 object-contain"
            />
          )}

          {!isVideo && !hasPdf && !hasImage && hasTxt && (
            <TxtFileReader url={fileUrl} />
          )}

          {chapterText && (
            <div className={isVideo || hasPdf ? 'mt-6' : ''}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-forest">
                Textbook / chapter text
              </h3>
              <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-forest/10 bg-sand/40 p-4 font-mono text-sm leading-relaxed text-forest whitespace-pre-wrap">
                {chapterText}
              </div>
            </div>
          )}

          {!isVideo && !hasPdf && !hasImage && !hasTxt && !chapterText && fileUrl && (
            <div className="rounded-xl border border-dashed border-forest/20 bg-sand/50 p-8 text-center">
              <p className="text-sm text-slate">Preview not available for this file type.</p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-teal"
              >
                Open file <ExternalLink size={14} />
              </a>
            </div>
          )}

          {!isVideo && !fileUrl && !chapterText && (
            <p className="text-sm text-slate">No file or chapter text uploaded yet.</p>
          )}
        </div>

        <div className="flex flex-wrap gap-3 border-t border-forest/10 px-5 py-3">
          {fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-forest/20 px-3 py-1.5 text-sm text-forest hover:bg-sand"
            >
              Open in new tab <ExternalLink size={14} />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-forest px-4 py-1.5 text-sm font-medium text-sand"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
