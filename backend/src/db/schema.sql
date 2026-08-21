-- EduGate AI Learning + CBT Platform Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'faculty')),
  target_exam VARCHAR(80),
  phone VARCHAR(20),
  avatar_url TEXT,
  exam_date DATE,
  daily_study_minutes INT DEFAULT 60,
  preferred_language VARCHAR(40) DEFAULT 'English',
  target_score INT,
  qualification VARCHAR(120),
  previous_attempt BOOLEAN DEFAULT FALSE,
  onboarding_done BOOLEAN DEFAULT FALSE,
  diagnostic_done BOOLEAN DEFAULT FALSE,
  plan VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  code VARCHAR(40) UNIQUE NOT NULL,
  category VARCHAR(80),
  description TEXT,
  duration_minutes INT DEFAULT 90,
  total_questions INT DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(220) UNIQUE NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  level VARCHAR(40) DEFAULT 'Beginner',
  duration_hours INT DEFAULT 40,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  type VARCHAR(40) NOT NULL CHECK (type IN (
    'book', 'video', 'notes', 'pdf', 'mindmap', 'revision', 'current_affairs', 'previous_paper'
  )),
  subject VARCHAR(100),
  topic VARCHAR(150),
  description TEXT,
  content_text TEXT,
  file_url TEXT,
  video_url TEXT,
  duration_minutes INT,
  origin VARCHAR(20) DEFAULT 'admin',
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, material_id)
);

CREATE TABLE IF NOT EXISTS watch_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  progress_percent INT DEFAULT 0,
  last_position_seconds INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, material_id)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  progress_percent INT DEFAULT 0,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
  subject VARCHAR(100) NOT NULL,
  topic VARCHAR(150),
  chapter VARCHAR(150),
  concept VARCHAR(150),
  difficulty VARCHAR(20) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  explanation TEXT,
  source VARCHAR(40) DEFAULT 'manual' CHECK (source IN ('manual', 'ai', 'previous_year', 'sample', 'notebook', 'diagnostic')),
  status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS practice_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  mode VARCHAR(40) DEFAULT 'topic' CHECK (mode IN (
    'topic', 'chapter', 'subject', 'daily', 'timed', 'previous_year', 'ai_generated'
  )),
  subject VARCHAR(100),
  topic VARCHAR(150),
  difficulty VARCHAR(20),
  question_count INT DEFAULT 10,
  time_limit_minutes INT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS practice_set_questions (
  practice_set_id UUID REFERENCES practice_sets(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  PRIMARY KEY (practice_set_id, question_id)
);

CREATE TABLE IF NOT EXISTS practice_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  practice_set_id UUID REFERENCES practice_sets(id) ON DELETE CASCADE,
  score INT DEFAULT 0,
  total INT DEFAULT 0,
  accuracy NUMERIC(5,2) DEFAULT 0,
  time_taken_seconds INT DEFAULT 0,
  answers JSONB DEFAULT '{}',
  analysis JSONB,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mock_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  duration_minutes INT DEFAULT 90,
  total_questions INT DEFAULT 100,
  negative_marking NUMERIC(3,2) DEFAULT 0.25,
  is_live BOOLEAN DEFAULT FALSE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mock_test_questions (
  mock_test_id UUID REFERENCES mock_tests(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  PRIMARY KEY (mock_test_id, question_id)
);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mock_test_id UUID REFERENCES mock_tests(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'evaluated')),
  answers JSONB DEFAULT '{}',
  marked_for_review JSONB DEFAULT '[]',
  visited JSONB DEFAULT '[]',
  score NUMERIC(8,2) DEFAULT 0,
  total_marks NUMERIC(8,2) DEFAULT 0,
  correct_count INT DEFAULT 0,
  wrong_count INT DEFAULT 0,
  unattempted_count INT DEFAULT 0,
  time_taken_seconds INT DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  analysis JSONB,
  autosave_at TIMESTAMPTZ,
  timings JSONB DEFAULT '{}',
  confidence JSONB DEFAULT '{}'
);

ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS timings JSONB DEFAULT '{}';
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS confidence JSONB DEFAULT '{}';

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  mock_test_id UUID REFERENCES mock_tests(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  score NUMERIC(8,2),
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  certificate_code VARCHAR(40) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) DEFAULT 'New chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
  plan JSONB NOT NULL,
  weak_topics JSONB DEFAULT '[]',
  strong_topics JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL,
  subject VARCHAR(200),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  code VARCHAR(40) UNIQUE NOT NULL,
  description TEXT,
  origin VARCHAR(20) DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  question_type VARCHAR(40) DEFAULT 'mcq',
  duration_minutes INT DEFAULT 90,
  total_questions INT DEFAULT 100,
  negative_marking NUMERIC(3,2) DEFAULT 0.25,
  publish_at TIMESTAMPTZ NOT NULL,
  pattern_sections JSONB DEFAULT '[]',
  notebook_direction TEXT,
  material_ids JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'generating', 'published', 'failed')),
  mock_test_id UUID REFERENCES mock_tests(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
CREATE INDEX IF NOT EXISTS idx_materials_type ON materials(type);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user ON exam_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);

CREATE TABLE IF NOT EXISTS user_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(100) NOT NULL,
  topic VARCHAR(150) DEFAULT 'General',
  mastery INT DEFAULT 0,
  accuracy INT DEFAULT 0,
  avg_seconds INT DEFAULT 0,
  attempts INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'average' CHECK (status IN ('strong', 'average', 'weak', 'speed', 'concept')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, subject, topic)
);

CREATE TABLE IF NOT EXISTS diagnostic_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  question_ids JSONB DEFAULT '[]',
  answers JSONB DEFAULT '{}',
  score INT DEFAULT 0,
  total INT DEFAULT 0,
  analysis JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mistakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  attempt_type VARCHAR(40) DEFAULT 'practice',
  attempt_id UUID,
  mistake_type VARCHAR(40) DEFAULT 'unknown' CHECK (mistake_type IN (
    'concept', 'calculation', 'guessing', 'misread', 'time_pressure', 'unknown'
  )),
  student_answer VARCHAR(10),
  correct_option VARCHAR(10),
  subject VARCHAR(100),
  topic VARCHAR(150),
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp INT DEFAULT 0,
  streak_days INT DEFAULT 0,
  last_active_date DATE,
  badges JSONB DEFAULT '[]',
  ai_chat_count_today INT DEFAULT 0,
  ai_chat_date DATE,
  live_mocks_this_week INT DEFAULT 0,
  live_mocks_week_start DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_user ON mistakes(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);
CREATE INDEX IF NOT EXISTS idx_questions_exam_subject_status ON questions(exam_id, subject, status);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_mock ON exam_attempts(mock_test_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_mock_tests_live ON mock_tests(is_live, starts_at, ends_at);

ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_source_check;
ALTER TABLE questions ADD CONSTRAINT questions_source_check CHECK (source IN ('manual', 'ai', 'previous_year', 'sample', 'notebook', 'diagnostic'));
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'admin', 'faculty'));
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS origin VARCHAR(20) DEFAULT 'admin';
ALTER TABLE materials ADD COLUMN IF NOT EXISTS origin VARCHAR(20) DEFAULT 'admin';

-- Notebook LLM jobs (memory store already had this; Postgres must too)
CREATE TABLE IF NOT EXISTS notebook_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
  schedule_id UUID REFERENCES exam_schedules(id) ON DELETE SET NULL,
  mock_test_id UUID REFERENCES mock_tests(id) ON DELETE SET NULL,
  title VARCHAR(200),
  direction TEXT,
  subject VARCHAR(100),
  topic VARCHAR(150),
  material_ids JSONB DEFAULT '[]',
  content_text TEXT,
  total_questions INT DEFAULT 20,
  duration_minutes INT DEFAULT 60,
  publish BOOLEAN DEFAULT TRUE,
  is_live BOOLEAN DEFAULT TRUE,
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  result_summary TEXT,
  question_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  type VARCHAR(40) DEFAULT 'info',
  mock_test_id UUID REFERENCES mock_tests(id) ON DELETE CASCADE,
  link VARCHAR(300),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notebook_jobs_created ON notebook_jobs(created_at DESC);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS mock_test_id UUID REFERENCES mock_tests(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link VARCHAR(300);

ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_status VARCHAR(20) DEFAULT 'active';

CREATE TABLE IF NOT EXISTS plan_settings (
  id VARCHAR(20) PRIMARY KEY DEFAULT 'default',
  free_trial_days INT NOT NULL DEFAULT 7,
  premium_price_inr INT NOT NULL DEFAULT 499,
  premium_duration_days INT NOT NULL DEFAULT 30,
  currency VARCHAR(8) DEFAULT 'INR',
  razorpay_key_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plan_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount_inr INT NOT NULL DEFAULT 0,
  currency VARCHAR(8) DEFAULT 'INR',
  provider VARCHAR(40) DEFAULT 'razorpay',
  provider_order_id TEXT,
  provider_payment_id TEXT,
  status VARCHAR(20) DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed', 'demo')),
  plan_granted VARCHAR(20) DEFAULT 'premium',
  days_granted INT,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id, created_at DESC);

