import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { catalogApi } from '../api/client';
import { PageHeader, LoadingBlock, Badge } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [exams, setExams] = useState([]);
  const [exam, setExam] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    catalogApi.exams().then(setExams).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    catalogApi
      .courses({ exam, q })
      .then(setCourses)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [exam, q]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <PageHeader
        eyebrow="Courses"
        title="Structured paths for every exam"
        subtitle="Enroll in complete courses covering syllabus, practice and revision."
      />
      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={exam}
          onChange={(e) => setExam(e.target.value)}
          className="rounded-xl border border-forest/15 bg-white px-3 py-2 text-sm"
        >
          <option value="">All exams</option>
          {exams.map((e) => (
            <option key={e.id} value={e.code}>{e.name}</option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search courses..."
          className="min-w-[220px] flex-1 rounded-xl border border-forest/15 bg-white px-3 py-2 text-sm"
        />
      </div>
      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Link
              key={c.id}
              to={`/courses/${c.slug}`}
              className="group rounded-2xl bg-white p-5 shadow-sm shadow-forest/5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <Badge>{c.exam_name || 'Multi-exam'}</Badge>
              <h3 className="mt-3 font-display text-xl text-forest group-hover:text-teal">{c.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-slate">{c.description}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-slate">
                <span>{c.level}</span>
                <span>{c.duration_hours}h</span>
              </div>
              {!user && <div className="mt-3 text-xs font-medium text-teal">Login to enroll</div>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
