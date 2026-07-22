import { useEffect, useState } from 'react';
import { BookOpen, Video, Layers, Pencil, Trash2, Eye, Play } from 'lucide-react';
import { adminApi, catalogApi } from '../api/client';
import { PageHeader, Badge } from '../components/ui';
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

export default function AdminContent() {
  const toast = useToast();
  const [panel, setPanel] = useState('subjects'); // subjects | materials | videos
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [newSubject, setNewSubject] = useState('');

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
    refresh().catch(console.error);
  }, []);

  const filtered = selectedSubject
    ? materials.filter((m) => (m.subject || '').toLowerCase() === selectedSubject.toLowerCase())
    : materials;
  const videos = filtered.filter((m) => m.type === 'video');
  const docs = filtered.filter((m) => m.type !== 'video');

  async function addSubject(e) {
    e.preventDefault();
    if (!newSubject.trim()) return;
    await adminApi.createSubject({ name: newSubject.trim() });
    setNewSubject('');
    setMsg('Subject added.');
    toast.success('Subject added');
    await refresh();
  }

  async function removeSubject(sub) {
    if (!window.confirm(`Delete subject "${sub.name}"?`)) return;
    try {
      await adminApi.deleteSubject(sub.id);
      if (selectedSubject === sub.name) setSelectedSubject('');
      setMsg(`Subject "${sub.name}" deleted.`);
      toast.success(`Deleted ${sub.name}`);
      await refresh();
    } catch (err) {
      setMsg(err.message);
      toast.error(err.message);
    }
  }

  function resetVideoForm() {
    setEditingVideoId(null);
    setVideoFile(null);
    setVideoForm({
      ...emptyVideo,
      exam_id: exams[0]?.id || '',
      subject: subjects[0]?.name || '',
    });
  }

  function resetBookForm() {
    setEditingBookId(null);
    setBookFile(null);
    setBookForm({
      ...emptyBook,
      exam_id: exams[0]?.id || '',
      subject: subjects[0]?.name || '',
    });
  }

  function startEditVideo(m) {
    setEditingVideoId(m.id);
    setVideoFile(null);
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
          setMsg('Video updated with new uploaded file.');
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
          setMsg('Video updated.');
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
        setMsg(`Video uploaded: ${res.original_name}`);
        resetVideoForm();
      } else if (videoForm.video_url?.trim()) {
        await adminApi.createMaterial({ ...videoForm, type: 'video' });
        setMsg('Video added from URL.');
        resetVideoForm();
      } else {
        throw new Error('Upload a video file or paste a video URL');
      }
      await refresh();
    } catch (err) {
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
          setMsg('Material updated with new uploaded file.');
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
          setMsg('Material updated.');
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
        setMsg(`Material uploaded: ${res.original_name}`);
        resetBookForm();
      } else if (bookForm.content_text?.trim() || bookForm.file_url?.trim()) {
        await adminApi.createMaterial(bookForm);
        setMsg('Material saved with textbook matter.');
        resetBookForm();
      } else {
        throw new Error('Paste textbook matter, upload a file, or paste a file URL');
      }
      await refresh();
    } catch (err) {
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
      setMsg(`Deleted: ${m.title}`);
      await refresh();
    } catch (err) {
      setMsg(err.message);
    }
  }

  const navBtn = (id, label, Icon) => (
    <button
      type="button"
      onClick={() => setPanel(id)}
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
        panel === id ? 'bg-teal text-sand' : 'text-mint/80 hover:bg-white/10 hover:text-sand'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Content"
        title="AI Content Management"
        subtitle="Manage subjects, materials and videos — upload, watch videos, read PDFs/textbooks."
      />
      {msg && <p className="mb-4 text-sm text-teal">{msg}</p>}

      {viewerMaterial && (
        <MaterialViewer material={viewerMaterial} onClose={() => setViewerMaterial(null)} />
      )}

      <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-start">
        <aside className="sticky top-6 z-20 max-h-[calc(100vh-3rem)] self-start overflow-y-auto rounded-2xl bg-ink p-3 text-sand">
          <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-mint/60">
            Library
          </div>
          {navBtn('subjects', 'Subjects', Layers)}
          {navBtn('materials', 'Materials', BookOpen)}
          {navBtn('videos', 'Videos', Video)}
          <div className="mt-4 border-t border-white/10 px-2 pt-3 text-xs text-mint/50">
            Filter by subject below in each panel.
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          {/* Subject filter always visible */}
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate">Filter subject</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedSubject('')}
                className={`rounded-lg px-3 py-1.5 text-sm ${!selectedSubject ? 'bg-forest text-sand' : 'bg-sand text-forest'}`}
              >
                All
              </button>
              {subjects.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedSubject(sub.name)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    selectedSubject === sub.name ? 'bg-forest text-sand' : 'bg-sand text-forest'
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          </section>

          {panel === 'subjects' && (
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-2xl text-forest">Subjects</h2>
                <form onSubmit={addSubject} className="flex gap-2">
                  <input
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="New subject name"
                    className="rounded-xl border px-3 py-2 text-sm"
                  />
                  <button className="rounded-xl bg-forest px-3 py-2 text-sm text-sand">Add</button>
                </form>
              </div>
              <div className="space-y-2">
                {subjects.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between rounded-xl border border-forest/10 px-4 py-3"
                  >
                    <div>
                      <div className="font-medium text-forest">{sub.name}</div>
                      <div className="text-xs text-slate">{sub.description || sub.code}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSubject(sub)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-coral hover:bg-coral/10"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {panel === 'materials' && (
            <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
              <form onSubmit={saveBook} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="font-display text-xl text-forest">
                  {editingBookId ? 'Update material' : 'Add material / textbook'}
                </h3>
                <select className="w-full rounded-xl border px-3 py-2 text-sm" value={bookForm.exam_id} onChange={(e) => setBookForm({ ...bookForm, exam_id: e.target.value })}>
                  {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
                <select className="w-full rounded-xl border px-3 py-2 text-sm" value={bookForm.subject} onChange={(e) => setBookForm({ ...bookForm, subject: e.target.value })}>
                  {subjects.map((sub) => <option key={sub.id} value={sub.name}>{sub.name}</option>)}
                </select>
                <select className="w-full rounded-xl border px-3 py-2 text-sm" value={bookForm.type} onChange={(e) => setBookForm({ ...bookForm, type: e.target.value })}>
                  <option value="book">Textbook / eBook</option>
                  <option value="pdf">PDF notes</option>
                  <option value="notes">Notes</option>
                  <option value="previous_paper">Previous paper</option>
                  <option value="mindmap">Mind map</option>
                  <option value="revision">Revision</option>
                  <option value="current_affairs">Current affairs</option>
                </select>
                <input required placeholder="Title" className="w-full rounded-xl border px-3 py-2 text-sm" value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} />
                <input placeholder="Topic / chapter" className="w-full rounded-xl border px-3 py-2 text-sm" value={bookForm.topic} onChange={(e) => setBookForm({ ...bookForm, topic: e.target.value })} />
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-forest">
                    {editingBookId ? 'Replace file (optional)' : 'Upload file (PDF, DOC…)'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.epub,.txt,application/pdf"
                    className="w-full rounded-xl border border-dashed border-forest/30 bg-sand/50 px-3 py-3 text-sm"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setBookFile(file);
                      if (file) setBookForm((f) => ({ ...f, file_url: '' }));
                    }}
                  />
                  {bookFile && <span className="mt-1 block text-xs text-teal">Selected: {bookFile.name}</span>}
                </label>
                <input
                  placeholder="File URL (optional)"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={bookForm.file_url}
                  onChange={(e) => {
                    setBookForm({ ...bookForm, file_url: e.target.value });
                    if (e.target.value) setBookFile(null);
                  }}
                />
                <textarea
                  placeholder="Short description"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={bookForm.description}
                  onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                />
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-forest">Textbook matter (chapter text for Notebook LLM)</span>
                  <textarea
                    rows={5}
                    placeholder="Paste chapter / notes text here so Notebook can generate Q&A..."
                    className="w-full rounded-xl border px-3 py-2 font-mono text-xs"
                    value={bookForm.content_text}
                    onChange={(e) => setBookForm({ ...bookForm, content_text: e.target.value })}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy} className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-sand disabled:opacity-60">
                    {busy ? 'Saving...' : editingBookId ? 'Update material' : 'Add material'}
                  </button>
                  {editingBookId && (
                    <button type="button" onClick={resetBookForm} className="rounded-xl border px-4 py-2 text-sm text-forest">
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="font-display text-xl text-forest">
                  Materials list {selectedSubject ? `· ${selectedSubject}` : ''}
                </h3>
                <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto">
                  {docs.length === 0 && <p className="text-sm text-slate">No materials yet.</p>}
                  {docs.map((m) => (
                    <div key={m.id} className="rounded-xl border border-forest/10 px-3 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Badge tone="amber">{m.type}</Badge>
                          </div>
                          <div className="mt-1 font-medium text-forest">{m.title}</div>
                          <div className="text-xs text-slate">
                            {m.exam_name || '—'} · {m.subject || '—'} · {m.topic || '—'}
                          </div>
                          {m.file_url && (
                            <button
                              type="button"
                              onClick={() => setViewerMaterial(m)}
                              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-mint/30 px-2 py-1 text-xs font-medium text-forest hover:bg-mint/50"
                            >
                              <Eye size={12} /> Read / view PDF
                            </button>
                          )}
                          {m.content_text && !m.file_url && (
                            <button
                              type="button"
                              onClick={() => setViewerMaterial(m)}
                              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-mint/30 px-2 py-1 text-xs font-medium text-forest hover:bg-mint/50"
                            >
                              <Eye size={12} /> Read textbook
                            </button>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {(m.file_url || m.content_text) && (
                            <button
                              type="button"
                              onClick={() => setViewerMaterial(m)}
                              className="rounded-lg p-2 text-forest hover:bg-sand"
                              title="Read / view"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                          <button type="button" onClick={() => startEditBook(m)} className="rounded-lg p-2 text-teal hover:bg-mint" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button type="button" onClick={() => removeMaterial(m)} className="rounded-lg p-2 text-coral hover:bg-coral/10" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {panel === 'videos' && (
            <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
              <form onSubmit={saveVideo} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="font-display text-xl text-forest">
                  {editingVideoId ? 'Update video' : 'Add video lecture'}
                </h3>
                <select className="w-full rounded-xl border px-3 py-2 text-sm" value={videoForm.exam_id} onChange={(e) => setVideoForm({ ...videoForm, exam_id: e.target.value })}>
                  {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
                <select className="w-full rounded-xl border px-3 py-2 text-sm" value={videoForm.subject} onChange={(e) => setVideoForm({ ...videoForm, subject: e.target.value })}>
                  {subjects.map((sub) => <option key={sub.id} value={sub.name}>{sub.name}</option>)}
                </select>
                <input required placeholder="Video title" className="w-full rounded-xl border px-3 py-2 text-sm" value={videoForm.title} onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })} />
                <input placeholder="Topic" className="w-full rounded-xl border px-3 py-2 text-sm" value={videoForm.topic} onChange={(e) => setVideoForm({ ...videoForm, topic: e.target.value })} />
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-forest">
                    {editingVideoId ? 'Replace video file (optional)' : 'Upload video file (mp4, webm, mov…)'}
                  </span>
                  <input
                    type="file"
                    accept="video/*"
                    className="w-full rounded-xl border border-dashed border-forest/30 bg-sand/50 px-3 py-3 text-sm"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setVideoFile(file);
                      if (file) setVideoForm((f) => ({ ...f, video_url: '' }));
                    }}
                  />
                  {videoFile && (
                    <span className="mt-1 block text-xs text-teal">
                      Selected: {videoFile.name} ({Math.round((videoFile.size / 1024 / 1024) * 10) / 10} MB)
                    </span>
                  )}
                </label>
                <input
                  placeholder="Video URL / embed (optional)"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={videoForm.video_url}
                  onChange={(e) => {
                    setVideoForm({ ...videoForm, video_url: e.target.value });
                    if (e.target.value) setVideoFile(null);
                  }}
                />
                <textarea placeholder="Description" className="w-full rounded-xl border px-3 py-2 text-sm" value={videoForm.description} onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })} />
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy} className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-sand disabled:opacity-60">
                    {busy ? 'Saving...' : editingVideoId ? 'Update video' : 'Add video'}
                  </button>
                  {editingVideoId && (
                    <button type="button" onClick={resetVideoForm} className="rounded-xl border px-4 py-2 text-sm text-forest">
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="font-display text-xl text-forest">
                  Videos list {selectedSubject ? `· ${selectedSubject}` : ''}
                </h3>
                <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto">
                  {videos.length === 0 && <p className="text-sm text-slate">No videos yet.</p>}
                  {videos.map((m) => (
                    <div key={m.id} className="rounded-xl border border-forest/10 px-3 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-forest">{m.title}</div>
                          <div className="text-xs text-slate">
                            {m.exam_name || '—'} · {m.subject || '—'} · {m.topic || '—'}
                          </div>
                          {m.video_url?.startsWith('/uploads/') && (
                            <div className="mt-1 text-xs text-teal">Stored on server</div>
                          )}
                          {m.video_url && (
                            <button
                              type="button"
                              onClick={() => setViewerMaterial(m)}
                              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-teal/15 px-2 py-1 text-xs font-medium text-teal hover:bg-teal/25"
                            >
                              <Play size={12} /> Watch video
                            </button>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {m.video_url && (
                            <button
                              type="button"
                              onClick={() => setViewerMaterial(m)}
                              className="rounded-lg p-2 text-teal hover:bg-mint"
                              title="Watch"
                            >
                              <Play size={14} />
                            </button>
                          )}
                          <button type="button" onClick={() => startEditVideo(m)} className="rounded-lg p-2 text-teal hover:bg-mint" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button type="button" onClick={() => removeMaterial(m)} className="rounded-lg p-2 text-coral hover:bg-coral/10" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
