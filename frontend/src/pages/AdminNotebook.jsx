import { Navigate } from 'react-router-dom';

/** @deprecated Use AdminAiExam at /admin/ai-exam */
export default function AdminNotebook() {
  return <Navigate to="/admin/ai-exam" replace />;
}
