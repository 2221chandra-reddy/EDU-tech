import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cbtApi } from '../api/client';
import { PageHeader, LoadingBlock, Badge } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function MockTests({ liveOnly = false }) {
  const [mocks, setMocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    cbtApi
      .mocks(liveOnly ? { live: 'true' } : {})
      .then(setMocks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [liveOnly]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <PageHeader
        eyebrow={liveOnly ? 'Live exams' : 'CBT module'}
        title={liveOnly ? 'Live examinations' : 'Full-length mock tests'}
        subtitle="Realistic CBT flow: instructions → timer → autosave → submit → evaluation → answer key."
      />
      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {mocks.map((m) => (
            <div key={m.id} className="rounded-2xl bg-white p-6 shadow-sm shadow-forest/5">
              <div className="flex flex-wrap gap-2">
                <Badge>{m.exam_name}</Badge>
                {m.is_live && <Badge tone="coral">Live</Badge>}
              </div>
              <h3 className="mt-3 font-display text-2xl text-forest">{m.title}</h3>
              <p className="mt-2 text-sm text-slate">{m.description}</p>
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate">
                <span>{m.duration_minutes} minutes</span>
                <span>{m.total_questions} questions</span>
                <span>Neg: {m.negative_marking}</span>
              </div>
              <div className="mt-5">
                {user ? (
                  <Link
                    to={`/cbt/${m.id}/instructions`}
                    className="inline-flex rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-sand"
                  >
                    Start CBT
                  </Link>
                ) : (
                  <Link to="/login" className="text-sm font-medium text-teal">
                    Login to attempt
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
