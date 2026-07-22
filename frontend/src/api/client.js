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
    throw new Error('Network error. Check if the API server is running.');
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
  bookmark: (id) => api(`/api/student/bookmarks/${id}`, { method: 'POST' }),
  unbookmark: (id) => api(`/api/student/bookmarks/${id}`, { method: 'DELETE' }),
  watchProgress: (body) => api('/api/student/watch-progress', { method: 'POST', body }),
  results: () => api('/api/student/results'),
  certificates: () => api('/api/student/certificates'),
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

export const adminApi = {
  dashboard: () => api('/api/admin/dashboard'),
  students: () => api('/api/admin/students'),
  createCourse: (body) => api('/api/admin/courses', { method: 'POST', body }),
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
  schedules: () => api('/api/admin/schedules'),
  createSchedule: (body) => api('/api/admin/schedules', { method: 'POST', body }),
  processDueSchedules: () => api('/api/admin/schedules/process-due', { method: 'POST' }),
  notebookLlm: (body) => api('/api/admin/notebook-llm', { method: 'POST', body }),
  notebookJobs: () => api('/api/admin/notebook-jobs'),
  questions: () => api('/api/admin/questions'),
  createQuestion: (body) => api('/api/admin/questions', { method: 'POST', body }),
  deleteQuestion: (id) => api(`/api/admin/questions/${id}`, { method: 'DELETE' }),
  deleteSampleQuestions: () => api('/api/admin/questions/samples', { method: 'DELETE' }),
  generateQuestions: (body) => api('/api/admin/generate-questions', { method: 'POST', body }),
  createMock: (body) => api('/api/admin/mocks', { method: 'POST', body }),
  results: () => api('/api/admin/results'),
  analytics: () => api('/api/admin/analytics'),
};
