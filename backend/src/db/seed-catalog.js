import bcrypt from 'bcryptjs';
import pool, { isMemoryMode } from '../config/db.js';

const exams = [
  { name: 'RRB NTPC', code: 'RRB_NTPC', category: 'Railway', description: 'Non-Technical Popular Categories recruitment exam.', duration: 90, questions: 100 },
  { name: 'RRB ALP', code: 'RRB_ALP', category: 'Railway', description: 'Assistant Loco Pilot exam.', duration: 90, questions: 75 },
  { name: 'RRB Group D', code: 'RRB_GROUP_D', category: 'Railway', description: 'Railway Group D level recruitment.', duration: 90, questions: 100 },
  { name: 'SSC CGL', code: 'SSC_CGL', category: 'SSC', description: 'Combined Graduate Level examination.', duration: 60, questions: 100 },
  { name: 'SSC CHSL', code: 'SSC_CHSL', category: 'SSC', description: 'Combined Higher Secondary Level exam.', duration: 60, questions: 100 },
  { name: 'SSC MTS', code: 'SSC_MTS', category: 'SSC', description: 'Multi Tasking Staff examination.', duration: 90, questions: 90 },
  { name: 'IBPS PO', code: 'IBPS_PO', category: 'Banking', description: 'Institute of Banking Personnel Selection PO.', duration: 60, questions: 100 },
  { name: 'SBI PO', code: 'SBI_PO', category: 'Banking', description: 'State Bank of India Probationary Officer.', duration: 60, questions: 100 },
  { name: 'UPSC CSE', code: 'UPSC_CSE', category: 'UPSC', description: 'Civil Services Examination.', duration: 120, questions: 100 },
  { name: 'APPSC', code: 'APPSC', category: 'State', description: 'Andhra Pradesh Public Service Commission.', duration: 150, questions: 150 },
  { name: 'TSPSC', code: 'TSPSC', category: 'State', description: 'Telangana State Public Service Commission.', duration: 150, questions: 150 },
  { name: 'Police Recruitment', code: 'POLICE', category: 'Police', description: 'State police constable and SI exams.', duration: 90, questions: 100 },
  { name: 'DRDO', code: 'DRDO', category: 'Defence', description: 'Defence Research and Development Organisation.', duration: 120, questions: 100 },
  { name: 'ISRO', code: 'ISRO', category: 'Science', description: 'Indian Space Research Organisation exams.', duration: 120, questions: 100 },
];

async function seedCatalog() {
  if (isMemoryMode()) {
    throw new Error('db:seed:catalog requires Neon/Postgres. Set DATABASE_URL to the pooled Neon string.');
  }

  const adminHash = await bcrypt.hash('admin123', 10);
  const studentHash = await bcrypt.hash('student123', 10);

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, onboarding_done, diagnostic_done, plan, plan_status, plan_started_at, plan_expires_at)
     VALUES ($1, $2, $3, 'admin', TRUE, TRUE, 'premium', 'active', NOW(), NOW() + INTERVAL '10 years')
     ON CONFLICT (email) DO NOTHING`,
    ['Admin User', 'admin@edugate.com', adminHash]
  );

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, target_exam, onboarding_done, diagnostic_done, plan, plan_status, plan_started_at, plan_expires_at)
     VALUES ($1, $2, $3, 'student', 'RRB NTPC', FALSE, FALSE, 'free', 'active', NOW(), NOW() + INTERVAL '30 days')
     ON CONFLICT (email) DO NOTHING`,
    ['Hemanth Student', 'student@edugate.com', studentHash]
  );

  for (const exam of exams) {
    await pool.query(
      `INSERT INTO exams (name, code, category, description, duration_minutes, total_questions)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
      [exam.name, exam.code, exam.category, exam.description, exam.duration, exam.questions]
    );
  }

  console.log('[db:seed:catalog] Exams + admin/student accounts ready (no demo questions/materials).');
  console.log('Admin: admin@edugate.com / admin123');
  console.log('Student: student@edugate.com / student123');
  await pool.end();
}

seedCatalog().catch((err) => {
  console.error('Catalog seed failed:', err.message);
  process.exit(1);
});
