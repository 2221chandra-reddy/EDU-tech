import { useEffect, useState } from 'react';
import {
  BookOpen,
  Video,
  Layers,
  Pencil,
  Trash2,
  Eye,
  Play,
  Upload,
  ChevronDown,
  ChevronUp,
  Link2,
  Sparkles,
} from 'lucide-react';
import { adminApi, catalogApi } from '../api/client';
import { PageHeader, Badge, LoadingBlock } from '../components/ui';
import { useToast } from '../context/ToastContext';
import MaterialViewer from '../components/MaterialViewer';

const emptyVideo = {
  exam_id: '',
  subject: '',
  title: '',
  topic: '',
  description: '',
  video_url: '',
  duration_minutes: 30,
};

const emptyBook = {
  exam_id: '',
  subject: '',
  title: '',
  topic: '',
  description: '',
  content_text: '',
  file_url: '',
  type: 'book',
};

const inputClass =
  'w-full rounded-xl border border-forest/10 bg-sand/30 px-3 py-2.5 text-sm text-forest outline-none transition placeholder:text-slate/60 focus:border-teal/50 focus:bg-white focus:ring-2 focus:ring-teal/15';

function Field({ label, hint, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-forest">{label}</span>
      {hint && <span className="mb-1.5 block text-xs text-slate">{hint}</span>}
      {children}
    </label>
  );
}

function UploadZone({ accept, file, onPick, label, sublabel }) {
  return (
    <div className="rounded-xl border border-dashed border-teal/25 bg-gradient-to-br from-mint/20 to-sand/40 p-4 text-center transition hover:border-teal/40">
      <Upload className="mx-auto text-teal" size={22} strokeWidth={1.75} />
      <p className="mt-2 text-sm font-medium text-forest">{label}</p>
      {sublabel && <p className="mt-0.5 text-xs text-slate">{sublabel}</p>}
      <input
        type="file"
        accept={accept}
        className="mt-3 w-full cursor-pointer text-xs text-slate file:mr-3 file:rounded-lg file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-sand"
        onChange={(e) => onPick(e.target.files?.[0] || null)}
      />
      {file && (
        <p className="mt-2 truncate text-xs font-medium text-teal" title={file.name}>
          {file.name}
        </p>
      )}
    </div>
  );
}

function MaterialRow({ m, onView, onEdit, onDelete, kind }) {
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-forest/8 bg-white p-3 shadow-sm shadow-forest/5 transition hover:border-teal/20 hover:shadow-md">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sand/80 text-teal">
        {kind === 'video' ? <Video size={18} /> : <BookOpen size={18} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-forest">{m.title}</span>
          {m.type !== 'video' && <Badge tone="amber">{m.type}</Badge>}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate">
          {m.exam_name || '—'} · {m.subject || '—'}
          {m.topic ? ` · ${m.topic}` : ''}
        </p>
        {kind === 'video' && /amazonaws\.com/i.test(m.video_url || '') && (
          <span className="mt-1 inline-block text-[10px] uppercase tracking-wide text-teal">S3</span>
        )}
      </div>
      <div className="flex shrink-0 gap-0.5 opacity-90 sm:opacity-70 sm:group-hover:opacity-100">
        {(m.file_url || m.content_text || m.video_url) && (
          <button
            type="button"
            onClick={onView}
            className="rounded-lg p-2 text-teal hover:bg-mint/40"
            title="Preview"
          >
            {kind === 'video' ? <Play size={16} /> : <Eye size={16} />}
          </button>
        )}
        <button type="button" onClick={onEdit} className="rounded-lg p-2 text-forest hover:bg-sand" title="Edit">
          <Pencil size={16} />
        </button>
        <button type="button" onClick={onDelete} className="rounded-lg p-2 text-coral hover:bg-coral/10" title="Delete">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default function AdminContent() {
  const toast = useToast();
  const [panel, setPanel] = useState('materials');
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [showBookExtra, setShowBookExtra] = useState(false);
  const [showVideoUrl, setShowVideoUrl] = useState(false);

  const [videoForm, setVideoForm] = useState(emptyVideo);
  const [videoFile, setVideoFile] = useState(null);
  const [editingVideoId, setEditingVideoId] = useState(null);

  const [bookForm, setBookForm] = useState(emptyBook);
  const [bookFile, setBookFile] = useState(null);
  const [editingBookId, setEditingBookId] = useState(null);
  const [viewerMaterial, setViewerMaterial] = useState(null);

  async function refresh() {
    const [ex, sub, mats] = await Promise.all([
      catalogApi.exams(),
      adminApi.subjects(),
      adminApi.materials(),
    ]);
    setExams(ex);
    setSubjects(sub);
    setMaterials(mats);
    setVideoForm((f) => ({
      ...f,
      exam_id: f.exam_id || ex[0]?.id || '',
      subject: f.subject || sub[0]?.name || '',
    }));
    setBookForm((f) => ({
      ...f,
      exam_id: f.exam_id || ex[0]?.id || '',
      subject: f.subject || sub[0]?.name || '',
    }));
  }

  useEffect(() => {
    refresh()
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = selectedSubject
    ? materials.filter((m) => (m.subject || '').toLowerCase() === selectedSubject.toLowerCase())
    : materials;
  const videos = filtered.filter((m) => m.type === 'video');
  const docs = filtered.filter((m) => m.type !== 'video');

  async function addSubject(e) {
    e.preventDefault();
    if (!newSubject.trim()) return;
    try {
      await adminApi.createSubject({ name: newSubject.trim() });
      setNewSubject('');
      setMsg('Subject added.');
      toast.success('Subject added');
      await refresh();
    } catch (err) {
      setMsg(err.message);
      toast.error(err.message);
    }
  }

  async function removeSubject(sub) {
    if (!window.confirm(`Delete subject "${sub.name}"?`)) return;
    try {
      await adminApi.deleteSubject(sub.id);
      if (selectedSubject === sub.name) setSelectedSubject('');
      toast.success(`Deleted ${sub.name}`);
      await refresh();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function removeUnusedSubjects() {
    const unusedCount = subjects.filter((sub) => {
      const key = String(sub.name || '').trim().toLowerCase();
      return !materials.some((m) => String(m.subject || '').trim().toLowerCase() === key);
    }).length;
    if (!unusedCount) {
      toast.success('No unused subjects');
      return;
    }
    if (!window.confirm(`Delete ${unusedCount} unused subject(s)?`)) return;
    try {
      const res = await adminApi.deleteUnusedSubjects();
      if (selectedSubject && (res.subjects || []).some((s) => s.name === selectedSubject)) {
        setSelectedSubject('');
      }
      toast.success(res.message || `Deleted ${res.deleted || 0}`);
      await refresh();
    } catch (err) {
      toast.error(err.message);
    }
  }

  function resetVideoForm() {
    setEditingVideoId(null);
    setVideoFile(null);
    setShowVideoUrl(false);
    setVideoForm({
      ...emptyVideo,
      exam_id: exams[0]?.id || '',
      subject: subjects[0]?.name || '',
    });
  }

  function resetBookForm() {
    setEditingBookId(null);
    setBookFile(null);
    setShowBookExtra(false);
    setBookForm({
      ...emptyBook,
      exam_id: exams[0]?.id || '',
      subject: subjects[0]?.name || '',
    });
  }

  function startEditVideo(m) {
    setEditingVideoId(m.id);
    setVideoFile(null);
    setShowVideoUrl(Boolean(m.video_url && !m.video_url.startsWith('/uploads')));
    setVideoForm({
      exam_id: m.exam_id || '',
      subject: m.subject || '',
      title: m.title || '',
      topic: m.topic || '',
      description: m.description || '',
      video_url: m.video_url || '',
      duration_minutes: m.duration_minutes || 30,
    });
    setPanel('videos');
  }

  function startEditBook(m) {
    setEditingBookId(m.id);
    setBookFile(null);
    setShowBookExtra(Boolean(m.file_url || m.content_text));
    setBookForm({
      exam_id: m.exam_id || '',
      subject: m.subject || '',
      title: m.title || '',
      topic: m.topic || '',
      description: m.description || '',
      content_text: m.content_text || '',
      file_url: m.file_url || '',
      type: m.type || 'book',
    });
    setPanel('materials');
  }

  async function saveVideo(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      if (editingVideoId) {
        if (videoFile) {
          const fd = new FormData();
          fd.append('video', videoFile);
          fd.append('exam_id', videoForm.exam_id);
          fd.append('subject', videoForm.subject);
          fd.append('title', videoForm.title);
          fd.append('topic', videoForm.topic || '');
          fd.append('description', videoForm.description || '');
          fd.append('duration_minutes', String(videoForm.duration_minutes || 30));
          await adminApi.deleteMaterial(editingVideoId);
          await adminApi.uploadVideo(fd);
          toast.success('Video updated');
        } else {
          await adminApi.updateMaterial(editingVideoId, {
            exam_id: videoForm.exam_id,
            subject: videoForm.subject,
            title: videoForm.title,
            topic: videoForm.topic,
            description: videoForm.description,
            video_url: videoForm.video_url,
            duration_minutes: videoForm.duration_minutes,
            type: 'video',
          });
          toast.success('Video updated');
        }
        resetVideoForm();
      } else if (videoFile) {
        const fd = new FormData();
        fd.append('video', videoFile);
        fd.append('exam_id', videoForm.exam_id);
        fd.append('subject', videoForm.subject);
        fd.append('title', videoForm.title);
        fd.append('topic', videoForm.topic || '');
        fd.append('description', videoForm.description || '');
        fd.append('duration_minutes', String(videoForm.duration_minutes || 30));
        const res = await adminApi.uploadVideo(fd);
        toast.success(`Uploaded ${res.original_name}`);
        resetVideoForm();
      } else if (videoForm.video_url?.trim()) {
        await adminApi.createMaterial({ ...videoForm, type: 'video' });
        toast.success('Video link saved');
        resetVideoForm();
      } else {
        throw new Error('Upload a video file or paste a link');
      }
      await refresh();
    } catch (err) {
      toast.error(err.message);
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveBook(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      if (editingBookId) {
        if (bookFile) {
          const fd = new FormData();
          fd.append('file', bookFile);
          fd.append('exam_id', bookForm.exam_id);
          fd.append('subject', bookForm.subject);
          fd.append('title', bookForm.title);
          fd.append('topic', bookForm.topic || '');
          fd.append('description', bookForm.description || '');
          fd.append('type', bookForm.type);
          await adminApi.deleteMaterial(editingBookId);
          await adminApi.uploadDoc(fd);
          toast.success('File replaced');
        } else {
          await adminApi.updateMaterial(editingBookId, {
            exam_id: bookForm.exam_id,
            subject: bookForm.subject,
            title: bookForm.title,
            topic: bookForm.topic,
            description: bookForm.description,
            content_text: bookForm.content_text,
            file_url: bookForm.file_url,
            type: bookForm.type,
          });
          toast.success('Material updated');
        }
        resetBookForm();
      } else if (bookFile) {
        const fd = new FormData();
        fd.append('file', bookFile);
        fd.append('exam_id', bookForm.exam_id);
        fd.append('subject', bookForm.subject);
        fd.append('title', bookForm.title);
        fd.append('topic', bookForm.topic || '');
        fd.append('description', bookForm.description || '');
        fd.append('type', bookForm.type);
        const res = await adminApi.uploadDoc(fd);
        if (bookForm.content_text?.trim() && res.material?.id) {
          await adminApi.updateMaterial(res.material.id, { content_text: bookForm.content_text.trim() });
        }
        toast.success(`Uploaded ${res.original_name}`);
        resetBookForm();
      } else if (bookForm.content_text?.trim() || bookForm.file_url?.trim()) {
        await adminApi.createMaterial(bookForm);
        toast.success('Material saved');
        resetBookForm();
      } else {
        throw new Error('Upload a file, paste a link, or add textbook text');
      }
      await refresh();
    } catch (err) {
      toast.error(err.message);
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMaterial(m) {
    if (!window.confirm(`Delete "${m.title}"?`)) return;
    try {
      await adminApi.deleteMaterial(m.id);
      if (editingVideoId === m.id) resetVideoForm();
      if (editingBookId === m.id) resetBookForm();
      toast.success('Deleted');
      await refresh();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const tabs = [
    { id: 'materials', label: 'Notes & PDFs', icon: BookOpen, count: docs.length },
    { id: 'videos', label: 'Videos', icon: Video, count: videos.length },
    { id: 'subjects', label: 'Subjects', icon: Layers, count: subjects.length },
  ];

  if (loading) return <LoadingBlock label="Loading content library…" />;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Admin · Content"
        title="Upload library"
        subtitle="Add PDFs, notes, and videos for students. Files go to secure storage; AI exams can use your textbook text."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPanel(id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              panel === id
                ? 'bg-forest text-sand shadow-md shadow-forest/20'
                : 'bg-white text-forest hover:bg-sand/80'
            }`}
          >
            <Icon size={16} strokeWidth={1.75} />
            {label}
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                panel === id ? 'bg-white/20' : 'bg-sand text-slate'
              }`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {panel !== 'subjects' && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-forest/8 bg-white/80 px-4 py-3 backdrop-blur-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-slate">Subject</span>
          <select
            className="min-w-[140px] rounded-lg border border-forest/10 bg-sand/40 px-3 py-1.5 text-sm text-forest"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
          >
            <option value="">All subjects</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.name}>{sub.name}</option>
            ))}
          </select>
          <span className="hidden text-xs text-slate sm:inline">
            Filter the list on the right — uploads still use the subject you pick in the form.
          </span>
        </div>
      )}

      {msg && (
        <p className="mb-4 rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral">{msg}</p>
      )}

      {viewerMaterial && (
        <MaterialViewer material={viewerMaterial} onClose={() => setViewerMaterial(null)} />
      )}

      {panel === 'subjects' && (
        <section className="rounded-2xl border border-forest/8 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-display text-xl text-forest">Subjects</h2>
              <p className="mt-1 text-sm text-slate">Organize materials by subject. Remove unused ones anytime.</p>
            </div>
            <form onSubmit={addSubject} className="flex w-full max-w-md gap-2 sm:w-auto">
              <input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="New subject name"
                className={inputClass}
              />
              <button type="submit" className="shrink-0 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-sand">
                Add
              </button>
            </form>
          </div>
          <button
            type="button"
            onClick={removeUnusedSubjects}
            className="mt-4 text-sm font-medium text-coral hover:underline"
          >
            Delete unused subjects
          </button>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {subjects.map((sub) => {
              const inUse = materials.some(
                (m) => String(m.subject || '').trim().toLowerCase() === String(sub.name || '').trim().toLowerCase()
              );
              return (
                <div
                  key={sub.id}
                  className="flex items-center justify-between rounded-xl bg-sand/50 px-4 py-3"
                >
                  <div>
                    <span className="font-medium text-forest">{sub.name}</span>
                    {!inUse && (
                      <span className="ml-2 text-xs text-slate">· unused</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSubject(sub)}
                    className="rounded-lg p-2 text-coral hover:bg-coral/10"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
            {!subjects.length && (
              <p className="text-sm text-slate sm:col-span-2">No subjects yet — add one above.</p>
            )}
          </div>
        </section>
      )}

      {panel === 'materials' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
          <form
            onSubmit={saveBook}
            className="space-y-4 rounded-2xl border border-forest/8 bg-white p-5 shadow-sm lg:sticky lg:top-4 lg:self-start"
          >
            <div>
              <h3 className="font-display text-lg text-forest">
                {editingBookId ? 'Edit material' : 'New upload'}
              </h3>
              <p className="mt-1 text-xs text-slate">PDF, notes, or paste text for AI papers.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Exam">
                <select
                  className={inputClass}
                  value={bookForm.exam_id}
                  onChange={(e) => setBookForm({ ...bookForm, exam_id: e.target.value })}
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Subject">
                <select
                  className={inputClass}
                  value={bookForm.subject}
                  onChange={(e) => setBookForm({ ...bookForm, subject: e.target.value })}
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.name}>{sub.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Type">
              <select
                className={inputClass}
                value={bookForm.type}
                onChange={(e) => setBookForm({ ...bookForm, type: e.target.value })}
              >
                <option value="book">Textbook</option>
                <option value="pdf">PDF notes</option>
                <option value="notes">Notes</option>
                <option value="previous_paper">Previous paper</option>
                <option value="mindmap">Mind map</option>
                <option value="revision">Revision</option>
                <option value="current_affairs">Current affairs</option>
              </select>
            </Field>

            <Field label="Title">
              <input
                required
                className={inputClass}
                placeholder="e.g. Commercial Manual Ch. 3"
                value={bookForm.title}
                onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
              />
            </Field>

            <Field label="Topic" hint="Optional chapter or unit">
              <input
                className={inputClass}
                value={bookForm.topic}
                onChange={(e) => setBookForm({ ...bookForm, topic: e.target.value })}
              />
            </Field>

            <UploadZone
              accept=".pdf,.doc,.docx,.ppt,.pptx,.epub,.txt,application/pdf"
              file={bookFile}
              label={editingBookId ? 'Replace file' : 'Drop or choose file'}
              sublabel="PDF, DOC, PPT, TXT — stored on S3"
              onPick={(file) => {
                setBookFile(file);
                if (file) setBookForm((f) => ({ ...f, file_url: '' }));
              }}
            />

            <button
              type="button"
              onClick={() => setShowBookExtra((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl bg-sand/60 px-3 py-2 text-sm font-medium text-forest"
            >
              <span className="inline-flex items-center gap-2">
                <Link2 size={16} />
                Link, description & AI text
              </span>
              {showBookExtra ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {showBookExtra && (
              <div className="space-y-3 rounded-xl bg-sand/40 p-3">
                <Field label="External file URL" hint="Only if not uploading above">
                  <input
                    className={inputClass}
                    value={bookForm.file_url}
                    onChange={(e) => {
                      setBookForm({ ...bookForm, file_url: e.target.value });
                      if (e.target.value) setBookFile(null);
                    }}
                  />
                </Field>
                <Field label="Short description">
                  <textarea
                    rows={2}
                    className={inputClass}
                    value={bookForm.description}
                    onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                  />
                </Field>
                <Field
                  label="Textbook matter for AI"
                  hint="Paste chapter text — used when generating exam papers"
                >
                  <textarea
                    rows={4}
                    className={`${inputClass} font-mono text-xs leading-relaxed`}
                    placeholder="Paste notes or chapter content…"
                    value={bookForm.content_text}
                    onChange={(e) => setBookForm({ ...bookForm, content_text: e.target.value })}
                  />
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-teal">
                    <Sparkles size={12} /> Also select this material in AI Exam LLM
                  </p>
                </Field>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-xl bg-forest py-2.5 text-sm font-semibold text-sand disabled:opacity-60 sm:flex-none sm:px-6"
              >
                {busy ? 'Saving…' : editingBookId ? 'Save changes' : 'Publish material'}
              </button>
              {editingBookId && (
                <button type="button" onClick={resetBookForm} className="rounded-xl border border-forest/15 px-4 py-2.5 text-sm text-forest">
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div>
            <h3 className="mb-3 font-display text-lg text-forest">
              Library
              {selectedSubject ? <span className="text-slate"> · {selectedSubject}</span> : null}
            </h3>
            <div className="space-y-2">
              {docs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-forest/15 bg-white/60 px-6 py-12 text-center text-sm text-slate">
                  No materials yet. Use the form to upload your first PDF or notes.
                </div>
              )}
              {docs.map((m) => (
                <MaterialRow
                  key={m.id}
                  m={m}
                  kind="doc"
                  onView={() => setViewerMaterial(m)}
                  onEdit={() => startEditBook(m)}
                  onDelete={() => removeMaterial(m)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {panel === 'videos' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
          <form
            onSubmit={saveVideo}
            className="space-y-4 rounded-2xl border border-forest/8 bg-white p-5 shadow-sm lg:sticky lg:top-4 lg:self-start"
          >
            <div>
              <h3 className="font-display text-lg text-forest">
                {editingVideoId ? 'Edit video' : 'New video'}
              </h3>
              <p className="mt-1 text-xs text-slate">Upload a file or paste YouTube / embed URL.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Exam">
                <select
                  className={inputClass}
                  value={videoForm.exam_id}
                  onChange={(e) => setVideoForm({ ...videoForm, exam_id: e.target.value })}
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Subject">
                <select
                  className={inputClass}
                  value={videoForm.subject}
                  onChange={(e) => setVideoForm({ ...videoForm, subject: e.target.value })}
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.name}>{sub.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Title">
              <input
                required
                className={inputClass}
                value={videoForm.title}
                onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
              />
            </Field>

            <Field label="Topic">
              <input
                className={inputClass}
                value={videoForm.topic}
                onChange={(e) => setVideoForm({ ...videoForm, topic: e.target.value })}
              />
            </Field>

            <UploadZone
              accept="video/*"
              file={videoFile}
              label="Video file"
              sublabel="MP4, WebM — large files may take a minute"
              onPick={(file) => {
                setVideoFile(file);
                if (file) setVideoForm((f) => ({ ...f, video_url: '' }));
              }}
            />

            <button
              type="button"
              onClick={() => setShowVideoUrl((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl bg-sand/60 px-3 py-2 text-sm font-medium text-forest"
            >
              <span className="inline-flex items-center gap-2">
                <Link2 size={16} />
                Video link instead
              </span>
              {showVideoUrl ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {showVideoUrl && (
              <Field label="URL or embed">
                <input
                  className={inputClass}
                  value={videoForm.video_url}
                  onChange={(e) => {
                    setVideoForm({ ...videoForm, video_url: e.target.value });
                    if (e.target.value) setVideoFile(null);
                  }}
                />
                <textarea
                  rows={2}
                  placeholder="Description (optional)"
                  className={`${inputClass} mt-2`}
                  value={videoForm.description}
                  onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })}
                />
              </Field>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-xl bg-teal py-2.5 text-sm font-semibold text-sand disabled:opacity-60 sm:flex-none sm:px-6"
              >
                {busy ? 'Saving…' : editingVideoId ? 'Save changes' : 'Add video'}
              </button>
              {editingVideoId && (
                <button type="button" onClick={resetVideoForm} className="rounded-xl border border-forest/15 px-4 py-2.5 text-sm text-forest">
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div>
            <h3 className="mb-3 font-display text-lg text-forest">Videos</h3>
            <div className="space-y-2">
              {videos.length === 0 && (
                <div className="rounded-2xl border border-dashed border-forest/15 bg-white/60 px-6 py-12 text-center text-sm text-slate">
                  No videos yet.
                </div>
              )}
              {videos.map((m) => (
                <MaterialRow
                  key={m.id}
                  m={m}
                  kind="video"
                  onView={() => setViewerMaterial(m)}
                  onEdit={() => startEditVideo(m)}
                  onDelete={() => removeMaterial(m)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
