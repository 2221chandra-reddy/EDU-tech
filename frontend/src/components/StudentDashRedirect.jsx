import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Send logged-in students from public marketing routes into the student dashboard. */
export function StudentDashRedirect({ to, children }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (user && !isAdmin) return <Navigate to={to} replace />;
  return children;
}
