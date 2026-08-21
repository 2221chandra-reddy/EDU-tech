const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem('edugate_token');
}

function extractError(data, status) {
  if (!data) return `Request failed (${status})`;
  if (typeof data.error === 'string') return data.error;
  if (data.error?.message) {
    const details = Array.isArray(data.error.details)
      ? `: ${data.error.details.map((d) => d.message || d.field).join(', ')}`
      : '';
    return `${data.error.message}${details}`;
  }
  if (data.message) return data.message;
  return `Request failed (${status})`;
}

export async function api(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      body:
        options.body == null
          ? undefined
          : options.body instanceof FormData
            ? options.body
            : JSON.stringify(options.body),
    });
  } catch {
    const base = String(API_BASE || '').trim();
    if (!base) {
      throw new Error(
        'API is not connected on Vercel. In the frontend project set VITE_API_URL to your live API (https://...) then Redeploy. Do not use localhost.'
      );
    }
    if (/localhost|127\.0\.0\.1/.test(base)) {
      throw new Error(
        'This live site is calling localhost, which only works on your PC. Set VITE_API_URL to the public API URL and Redeploy.'
      );
    }
    throw new Error(
      `Cannot reach the API at ${base}. Start/host the backend, allow this Vercel URL in CLIENT_URL, then try again.`
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractError(data, res.status));
  }
  return data;
}

export const authApi = {
  login: (body) => api('/api/auth/login', { method: 'POST', body }),
  register: (body) => api('/api/auth/register', { method: 'POST', body }),
  me: () => api('/api/auth/me'),
};

export const catalogApi = {
  exams: () => api('/api/exams'),
  courses: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/api/courses${q ? `?${q}` : ''}`);
  },
  course: (slug) => api(`/api/courses/${slug}`),
  enroll: (id) => api(`/api/courses/${id}/enroll`, { method: 'POST' }),
  materials: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/api/materials${q ? `?${q}` : ''}`);
  },
  material: (id) => api(`/api/materials/${id}`),
  contact: (body) => api('/api/contact', { method: 'POST', body }),
};

export const studentApi = {
  overview: () => api('/api/student/overview'),
  updateProfile: (body) => api('/api/student/profile', { method: 'PUT', body }),
  completeOnboarding: (body) => api('/api/student/onboarding', { method: 'POST', body }),
  skills: () => api('/api/student/skills'),
  stats: () => api('/api/student/stats'),
  startDiagnostic: () => api('/api/student/diagnostic/start', { method: 'POST' }),
  submitDiagnostic: (body) => api('/api/student/diagnostic/submit', { method: 'POST', body }),
  dailyPlan: () => api('/api/student/daily-plan', { method: 'POST' }),
  adaptivePractice: () => api('/api/student/adaptive-practice', { method: 'POST' }),
  mistakes: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/api/student/mistakes${q ? `?${q}` : ''}`);
  },
  resolveMistake: (id) => api(`/api/student/mistakes/${id}`, { method: 'PATCH' }),
  bookmark: (id) => api(`/api/student/bookmarks/${id}`, { method: 'POST' }),
  unbookmark: (id) => api(`/api/student/bookmarks/${id}`, { method: 'DELETE' }),
  watchProgress: (body) => api('/api/student/watch-progress', { method: 'POST', body }),
  results: () => api('/api/student/results'),
  certificates: () => api('/api/student/certificates'),
  readiness: () => api('/api/student/readiness'),
  whyNotImproving: () => api('/api/student/diagnostics/why-not-improving'),
  recoveryPlan: () => api('/api/student/recovery-plan', { method: 'POST' }),
  notifications: () => api('/api/student/notifications'),
  markNotificationRead: (id) => api(`/api/student/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => api('/api/student/notifications/read-all', { method: 'PATCH' }),
};

export const aiApi = {
  sessions: () => api('/api/ai/sessions'),
  createSession: (title) => api('/api/ai/sessions', { method: 'POST', body: { title } }),
  messages: (id) => api(`/api/ai/sessions/${id}/messages`),
  chat: (body) => api('/api/ai/chat', { method: 'POST', body }),
  generateQuestions: (body) => api('/api/ai/generate-questions', { method: 'POST', body }),
  analyze: (body) => api('/api/ai/analyze', { method: 'POST', body }),
};

export const practiceApi = {
  sets: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/api/practice/sets${q ? `?${q}` : ''}`);
  },
  set: (id) => api(`/api/practice/sets/${id}`),
  questions: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/api/practice/questions${q ? `?${q}` : ''}`);
  },
  submit: (body) => api('/api/practice/submit', { method: 'POST', body }),
};

export const cbtApi = {
  mocks: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/api/cbt/mocks${q ? `?${q}` : ''}`);
  },
  mock: (id) => api(`/api/cbt/mocks/${id}`),
  start: (id) => api(`/api/cbt/mocks/${id}/start`, { method: 'POST' }),
  autosave: (id, body) => api(`/api/cbt/attempts/${id}/autosave`, { method: 'PATCH', body }),
  submit: (id, body) => api(`/api/cbt/attempts/${id}/submit`, { method: 'POST', body }),
  attempt: (id) => api(`/api/cbt/attempts/${id}`),
  answerKey: (id) => api(`/api/cbt/attempts/${id}/answer-key`),
};

export const billingApi = {
  catalog: () => api('/api/billing/catalog'),
  me: () => api('/api/billing/me'),
  order: () => api('/api/billing/order', { method: 'POST' }),
  verify: (body) => api('/api/billing/verify', { method: 'POST', body }),
  demoPay: () => api('/api/billing/demo-pay', { method: 'POST' }),
};

export const adminApi = {
  dashboard: () => api('/api/admin/dashboard'),
  students: () => api('/api/admin/students'),
  createCourse: (body) => api('/api/admin/courses', { method: 'POST', body }),
  deleteCourse: (id) => api(`/api/admin/courses/${id}`, { method: 'DELETE' }),
  createMaterial: (body) => api('/api/admin/materials', { method: 'POST', body }),
  async uploadVideo(formData) {
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/admin/materials/upload-video`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    return data;
  },
  async uploadDoc(formData) {
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/admin/materials/upload-doc`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    return data;
  },
  materials: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/api/admin/materials${q ? `?${q}` : ''}`);
  },
  updateMaterial: (id, body) => api(`/api/admin/materials/${id}`, { method: 'PUT', body }),
  deleteMaterial: (id) => api(`/api/admin/materials/${id}`, { method: 'DELETE' }),
  subjects: () => api('/api/admin/subjects'),
  createSubject: (body) => api('/api/admin/subjects', { method: 'POST', body }),
  deleteSubject: (id) => api(`/api/admin/subjects/${id}`, { method: 'DELETE' }),
  deleteUnusedSubjects: () => api('/api/admin/subjects/unused', { method: 'DELETE' }),
  schedules: () => api('/api/admin/schedules'),
  createSchedule: (body) => api('/api/admin/schedules', { method: 'POST', body }),
  processDueSchedules: () => api('/api/admin/schedules/process-due', { method: 'POST' }),
  notebookLlm: (body) => api('/api/admin/notebook-llm', { method: 'POST', body }),
  notebookJobs: () => api('/api/admin/notebook-jobs'),
  questions: () => api('/api/admin/questions'),
  createQuestion: (body) => api('/api/admin/questions', { method: 'POST', body }),
  updateQuestion: (id, body) => api(`/api/admin/questions/${id}`, { method: 'PATCH', body }),
  deleteQuestion: (id) => api(`/api/admin/questions/${id}`, { method: 'DELETE' }),
  deleteSampleQuestions: () => api('/api/admin/questions/samples', { method: 'DELETE' }),
  setStudentPlan: (id, plan) => api(`/api/admin/students/${id}/plan`, { method: 'PATCH', body: { plan } }),
  planSettings: () => api('/api/admin/plan-settings'),
  savePlanSettings: (body) => api('/api/admin/plan-settings', { method: 'PUT', body }),
  payments: () => api('/api/admin/payments'),
  generateQuestions: (body) => api('/api/admin/generate-questions', { method: 'POST', body }),
  createMock: (body) => api('/api/admin/mocks', { method: 'POST', body }),
  results: () => api('/api/admin/results'),
  analytics: () => api('/api/admin/analytics'),
};
