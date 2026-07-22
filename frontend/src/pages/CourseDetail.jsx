import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { catalogApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Badge, LoadingBlock } from '../components/ui';

export default function CourseDetail() {
  const { slug } = useParams();
  const [course, setCourse] = useState(null);
  const [msg, setMsg] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    catalogApi.course(slug).then(setCourse).catch(console.error);
  }, [slug]);

  async function enroll() {
    if (!user) return;
    try {
      await catalogApi.enroll(course.id);
      setMsg('Enrolled successfully! Open Dashboard → My Courses.');
    } catch (err) {
      setMsg(err.message);
    }
  }

  if (!course) return <LoadingBlock />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Badge>{course.exam_name}</Badge>
      <h1 className="mt-3 font-display text-4xl text-forest">{course.title}</h1>
      <p className="mt-3 max-w-2xl text-slate">{course.description}</p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate">
        <span>{course.level}</span>
        <span>·</span>
        <span>{course.duration_hours} hours</span>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        {user ? (
          <button onClick={enroll} className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-sand">
            Enroll now
          </button>
        ) : (
          <Link to="/login" className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-sand">
            Login to enroll
          </Link>
        )}
        <Link
          to={user ? '/dashboard/ai-tutor' : '/login'}
          className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-medium text-forest"
        >
          Ask AI Tutor
        </Link>
      </div>
      {msg && <p className="mt-3 text-sm text-teal">{msg}</p>}

      <h2 className="mt-12 font-display text-2xl text-forest">Course materials</h2>
      <div className="mt-4 space-y-3">
        {(course.materials || []).map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
            <div>
              <div className="font-medium text-forest">{m.title}</div>
              <div className="text-xs text-slate">{m.type} · {m.subject}</div>
            </div>
            <Badge tone="amber">{m.type}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
