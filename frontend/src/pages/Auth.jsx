import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const exams = [
  'RRB NTPC', 'RRB ALP', 'RRB Group D', 'SSC CGL', 'SSC CHSL', 'SSC MTS',
  'IBPS PO', 'SBI PO', 'UPSC CSE', 'APPSC', 'TSPSC', 'Police Recruitment',
];

export function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('student@edugate.com');
  const [password, setPassword] = useState('student123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      const dest = location.state?.from || (user.role === 'admin' ? '/admin' : '/dashboard');
      navigate(dest);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Login to continue learning and take CBT exams.">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{error}</div>}
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <Field label="Password" type="password" value={password} onChange={setPassword} />
        <button
          disabled={loading}
          className="w-full rounded-xl bg-forest py-3 text-sm font-semibold text-sand disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Login'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate">
        New here? <Link to="/register" className="font-medium text-teal">Create account</Link>
      </p>
      <p className="mt-3 text-center text-xs text-slate">
        Demo: student@edugate.com / student123 · admin@edugate.com / admin123
      </p>
    </AuthShell>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    target_exam: 'RRB NTPC',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Choose your target exam and start the full learning journey.">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{error}</div>}
        <Field label="Full name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
        <Field label="Phone (optional)" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-forest">Target exam</span>
          <select
            className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2.5 outline-none focus:border-teal"
            value={form.target_exam}
            onChange={(e) => setForm({ ...form, target_exam: e.target.value })}
          >
            {exams.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
        <button
          disabled={loading}
          className="w-full rounded-xl bg-forest py-3 text-sm font-semibold text-sand disabled:opacity-60"
        >
          {loading ? 'Creating...' : 'Register'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate">
        Already have an account? <Link to="/login" className="font-medium text-teal">Login</Link>
      </p>
    </AuthShell>
  );
}

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="mx-auto grid min-h-[80vh] max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-2">
      <div className="hidden lg:block">
        <div className="rounded-[2rem] bg-mesh p-10 text-sand">
          <div className="font-display text-4xl">EduGate</div>
          <p className="mt-4 max-w-sm text-mint/80">
            AI Learning + CBT Examination Portal — books, videos, tutor, practice and mocks in one ecosystem.
          </p>
        </div>
      </div>
      <div className="rounded-3xl bg-white p-8 shadow-sm shadow-forest/10">
        <h1 className="font-display text-3xl text-forest">{title}</h1>
        <p className="mt-2 text-sm text-slate">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-forest">{label}</span>
      <input
        type={type}
        required={type !== 'text' || label.includes('name') || label.includes('Email') || label.includes('Password')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2.5 outline-none focus:border-teal"
      />
    </label>
  );
}
