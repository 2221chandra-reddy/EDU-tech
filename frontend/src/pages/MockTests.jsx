import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cbtApi } from '../api/client';
import { PageHeader, LoadingBlock, Badge, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function MockTests({ liveOnly = false, embedded = false }) {
  const [mocks, setMocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    cbtApi
      .mocks(liveOnly ? { live: 'true' } : {})
      .then(setMocks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [liveOnly, user?.id, user?.target_exam]);

  const body = (
    <>
      {!embedded && (
        <PageHeader
          eyebrow={liveOnly ? 'Live exams' : 'CBT module'}
          title={liveOnly ? 'Live examinations' : 'Full-length mock tests'}
          subtitle={
            user?.target_exam
              ? `Showing papers for your target exam: ${user.target_exam}.`
              : 'Realistic CBT flow: instructions → timer → autosave → submit → evaluation → answer key.'
          }
        />
      )}
      {user && !user.target_exam && (
        <div className="mb-6 rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-forest">
          Set your <strong>target exam</strong> in{' '}
          <Link to="/dashboard/profile" className="font-semibold text-teal">
            Profile
          </Link>{' '}
          to see mocks published for that exam only.
        </div>
      )}
      {loading ? (
        <LoadingBlock />
      ) : mocks.length === 0 ? (
        <EmptyState
          title={liveOnly ? 'No live exams for your target' : 'No mocks for your target exam'}
          hint={
            user?.target_exam
              ? `Nothing published yet for ${user.target_exam}. Ask admin to publish an AI exam for this target.`
              : user
                ? 'Choose a target exam in Profile, then published papers for that exam will appear here.'
                : 'Login and set your target exam to see matching CBT papers.'
          }
        />
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
                {m.is_live && m.window_ends_at && (
                  <span>Closes {new Date(m.window_ends_at).toLocaleTimeString()}</span>
                )}
              </div>
              <div className="mt-5">
                {user ? (
                  m.already_attempted ? (
                    <span className="text-sm font-medium text-coral">Already attempted — closed</span>
                  ) : !m.window_open && m.is_live ? (
                    <span className="text-sm font-medium text-coral">Exam closed</span>
                  ) : (
                    <Link
                      to={`/cbt/${m.id}/instructions`}
                      className="inline-flex rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal"
                    >
                      {m.can_continue ? 'Continue CBT' : 'Start CBT'}
                    </Link>
                  )
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
    </>
  );

  if (embedded) return <div>{body}</div>;
  return <div className="mx-auto max-w-7xl px-4 py-10">{body}</div>;
}
