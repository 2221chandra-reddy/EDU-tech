import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AiTutor from '../pages/AITutor.jsx';
import AiGenerator from '../pages/AiGenerator.jsx';

/** Public AI routes: keep logged-in users inside their panel layout. */
export function AiTutorRoute() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (user && !isAdmin) return <Navigate to="/dashboard/ai-tutor" replace />;
  return <AiTutor />;
}

export function AiGeneratorRoute() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (user && isAdmin) return <Navigate to="/admin/ai-generator" replace />;
  if (user && !isAdmin) return <Navigate to="/dashboard/ai-generator" replace />;
  return <AiGenerator />;
}
