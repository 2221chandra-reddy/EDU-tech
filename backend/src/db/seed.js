import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

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

const sampleQuestions = [
  {
    subject: 'Mathematics',
    topic: 'Percentage',
    difficulty: 'easy',
    question_text: 'What is 25% of 480?',
    option_a: '100',
    option_b: '120',
    option_c: '140',
    option_d: '150',
    correct_option: 'B',
    explanation: '25% of 480 = (25/100) × 480 = 120.',
  },
  {
    subject: 'Mathematics',
    topic: 'Percentage',
    difficulty: 'medium',
    question_text: 'A number is increased by 20% and then decreased by 20%. The net change is:',
    option_a: 'No change',
    option_b: '4% increase',
    option_c: '4% decrease',
    option_d: '2% decrease',
    correct_option: 'C',
    explanation: 'Net change = x − (x²/100) = 20 − 4 = 16% effective, which is 4% decrease from original.',
  },
  {
    subject: 'Reasoning',
    topic: 'Blood Relations',
    difficulty: 'easy',
    question_text: "Pointing to a man, a woman said, 'His mother is the only daughter of my mother.' How is the woman related to the man?",
    option_a: 'Mother',
    option_b: 'Sister',
    option_c: 'Aunt',
    option_d: 'Grandmother',
    correct_option: 'A',
    explanation: "Only daughter of woman's mother is the woman herself. So she is the man's mother.",
  },
  {
    subject: 'Reasoning',
    topic: 'Blood Relations',
    difficulty: 'medium',
    question_text: "A is B's brother. C is A's mother. D is C's father. E is B's son. How is D related to E?",
    option_a: 'Grandfather',
    option_b: 'Great grandfather',
    option_c: 'Uncle',
    option_d: 'Father',
    correct_option: 'B',
    explanation: "D is C's father, C is mother of A and B, E is B's son. So D is E's great grandfather.",
  },
  {
    subject: 'Physics',
    topic: "Ohm's Law",
    difficulty: 'easy',
    question_text: "According to Ohm's Law, V = ?",
    option_a: 'I / R',
    option_b: 'I × R',
    option_c: 'I + R',
    option_d: 'I − R',
    correct_option: 'B',
    explanation: "Ohm's Law states that Voltage (V) = Current (I) × Resistance (R).",
  },
  {
    subject: 'Physics',
    topic: "Ohm's Law",
    difficulty: 'medium',
    question_text: 'A current of 2A flows through a 5Ω resistor. The voltage across it is:',
    option_a: '2.5 V',
    option_b: '7 V',
    option_c: '10 V',
    option_d: '0.4 V',
    correct_option: 'C',
    explanation: 'V = I × R = 2 × 5 = 10 V.',
  },
  {
    subject: 'General Awareness',
    topic: 'Current Affairs',
    difficulty: 'easy',
    question_text: 'Which institution releases the Monetary Policy in India?',
    option_a: 'SEBI',
    option_b: 'RBI',
    option_c: 'NITI Aayog',
    option_d: 'Finance Ministry',
    correct_option: 'B',
    explanation: 'The Reserve Bank of India (RBI) announces and implements monetary policy.',
  },
  {
    subject: 'English',
    topic: 'Synonyms',
    difficulty: 'easy',
    question_text: 'Choose the synonym of "Abundant":',
    option_a: 'Scarce',
    option_b: 'Plentiful',
    option_c: 'Rare',
    option_d: 'Meagre',
    correct_option: 'B',
    explanation: 'Abundant means existing in large quantities; plentiful is the closest synonym.',
  },
  {
    subject: 'Mathematics',
    topic: 'Profit and Loss',
    difficulty: 'medium',
    question_text: 'A shopkeeper buys an article for ₹800 and sells it for ₹1000. His profit percentage is:',
    option_a: '20%',
    option_b: '25%',
    option_c: '15%',
    option_d: '30%',
    correct_option: 'B',
    explanation: 'Profit = 200. Profit% = (200/800) × 100 = 25%.',
  },
  {
    subject: 'Reasoning',
    topic: 'Coding-Decoding',
    difficulty: 'easy',
    question_text: 'If CAT is coded as 24, what is the code for DOG?',
    option_a: '26',
    option_b: '28',
    option_c: '30',
    option_d: '32',
    correct_option: 'A',
    explanation: 'C=3, A=1, T=20 → 3+1+20=24. D=4, O=15, G=7 → 4+15+7=26.',
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const adminHash = await bcrypt.hash('admin123', 10);
    const studentHash = await bcrypt.hash('student123', 10);

    await client.query(
      `INSERT INTO users (name, email, password_hash, role, target_exam)
       VALUES ($1, $2, $3, 'admin', NULL)
       ON CONFLICT (email) DO NOTHING`,
      ['Admin User', 'admin@edugate.com', adminHash]
    );

    await client.query(
      `INSERT INTO users (name, email, password_hash, role, target_exam)
       VALUES ($1, $2, $3, 'student', 'RRB NTPC')
       ON CONFLICT (email) DO NOTHING`,
      ['Hemanth Student', 'student@edugate.com', studentHash]
    );

    const examIds = {};
    for (const exam of exams) {
      const { rows } = await client.query(
        `INSERT INTO exams (name, code, category, description, duration_minutes, total_questions)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, code`,
        [exam.name, exam.code, exam.category, exam.description, exam.duration, exam.questions]
      );
      examIds[exam.code] = rows[0].id;
    }

    const rrbId = examIds.RRB_NTPC;
    const sscId = examIds.SSC_CGL;

    const courses = [
      {
        exam_id: rrbId,
        title: 'RRB NTPC Complete Course',
        slug: 'rrb-ntpc-complete',
        description: 'Full syllabus coverage for RRB NTPC with maths, reasoning, and general awareness.',
        level: 'Beginner',
        duration_hours: 120,
      },
      {
        exam_id: sscId,
        title: 'SSC CGL Quant Mastery',
        slug: 'ssc-cgl-quant',
        description: 'Master quantitative aptitude for SSC CGL with topic-wise drills.',
        level: 'Intermediate',
        duration_hours: 80,
      },
      {
        exam_id: examIds.IBPS_PO,
        title: 'Banking PO Foundation',
        slug: 'banking-po-foundation',
        description: 'IBPS & SBI PO prep covering reasoning, quant, English, and GA.',
        level: 'Beginner',
        duration_hours: 100,
      },
    ];

    const courseIds = [];
    for (const c of courses) {
      const { rows } = await client.query(
        `INSERT INTO courses (exam_id, title, slug, description, level, duration_hours)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
         RETURNING id`,
        [c.exam_id, c.title, c.slug, c.description, c.level, c.duration_hours]
      );
      courseIds.push(rows[0].id);
    }

    const materials = [
      { course_id: courseIds[0], exam_id: rrbId, title: 'RRB NTPC Maths eBook', type: 'book', subject: 'Mathematics', topic: 'Full Syllabus', description: 'Complete maths handbook for railway exams.' },
      { course_id: courseIds[0], exam_id: rrbId, title: 'Percentage Basics', type: 'video', subject: 'Mathematics', topic: 'Percentage', description: 'Upload an mp4 from Admin → Content → Videos.', duration_minutes: 25 },
      { course_id: courseIds[0], exam_id: rrbId, title: 'Blood Relations Notes', type: 'notes', subject: 'Reasoning', topic: 'Blood Relations', description: 'Quick notes with diagrams for blood relations.' },
      { course_id: courseIds[0], exam_id: rrbId, title: 'Ohm\'s Law Chapter PDF', type: 'pdf', subject: 'Physics', topic: "Ohm's Law", description: 'PDF chapter explaining Ohm\'s Law with examples.' },
      { course_id: courseIds[0], exam_id: rrbId, title: 'Reasoning Mind Map', type: 'mindmap', subject: 'Reasoning', topic: 'Overview', description: 'Visual mind map of reasoning topics.' },
      { course_id: courseIds[0], exam_id: rrbId, title: 'Maths Quick Revision', type: 'revision', subject: 'Mathematics', topic: 'Formulas', description: 'One-pager formula sheet for last-minute revision.' },
      { course_id: null, exam_id: rrbId, title: 'Weekly Current Affairs Digest', type: 'current_affairs', subject: 'General Awareness', topic: 'Current Affairs', description: 'Latest national and international affairs for exams.' },
      { course_id: courseIds[0], exam_id: rrbId, title: 'RRB NTPC 2024 Previous Paper', type: 'previous_paper', subject: 'Full Paper', topic: 'Previous Year', description: 'Official previous year question paper with solutions.' },
      { course_id: courseIds[1], exam_id: sscId, title: 'SSC Algebra Video Series', type: 'video', subject: 'Mathematics', topic: 'Algebra', description: 'Offline-ready placeholder. Upload lecture files from Admin panel.', duration_minutes: 40 },
      { course_id: courseIds[2], exam_id: examIds.IBPS_PO, title: 'Banking Awareness PDF', type: 'pdf', subject: 'General Awareness', topic: 'Banking', description: 'Banking terms and RBI updates.' },
    ];

    for (const m of materials) {
      await client.query(
        `INSERT INTO materials (course_id, exam_id, title, type, subject, topic, description, video_url, duration_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [m.course_id, m.exam_id, m.title, m.type, m.subject, m.topic, m.description, m.video_url || null, m.duration_minutes || null]
      );
    }

    const questionIds = [];
    for (const q of sampleQuestions) {
      const { rows } = await client.query(
        `INSERT INTO questions (exam_id, subject, topic, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'sample')
         RETURNING id`,
        [rrbId, q.subject, q.topic, q.difficulty, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.explanation]
      );
      questionIds.push(rows[0].id);
    }

    // Duplicate a few for SSC as well
    for (const q of sampleQuestions.slice(0, 5)) {
      await client.query(
        `INSERT INTO questions (exam_id, subject, topic, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'previous_year')`,
        [sscId, q.subject, q.topic, q.difficulty, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.explanation]
      );
    }

    const { rows: mockRows } = await client.query(
      `INSERT INTO mock_tests (exam_id, title, description, duration_minutes, total_questions, negative_marking, is_live, is_published)
       VALUES ($1, $2, $3, 30, $4, 0.25, TRUE, TRUE)
       RETURNING id`,
      [rrbId, 'RRB NTPC Full Mock Test 1', 'Realistic CBT mock based on latest pattern.', questionIds.length]
    );

    const mockId = mockRows[0].id;
    for (let i = 0; i < questionIds.length; i++) {
      await client.query(
        `INSERT INTO mock_test_questions (mock_test_id, question_id, sort_order) VALUES ($1, $2, $3)`,
        [mockId, questionIds[i], i + 1]
      );
    }

    await client.query(
      `INSERT INTO mock_tests (exam_id, title, description, duration_minutes, total_questions, negative_marking, is_live, is_published)
       VALUES ($1, $2, $3, 60, 50, 0.25, FALSE, TRUE)`,
      [sscId, 'SSC CGL Tier-1 Practice Mock', 'Section-wise timed practice mock for SSC CGL.']
    );

    const { rows: practiceRows } = await client.query(
      `INSERT INTO practice_sets (exam_id, title, mode, subject, topic, difficulty, question_count, time_limit_minutes, is_public)
       VALUES ($1, $2, 'topic', 'Mathematics', 'Percentage', 'medium', $3, 15, TRUE)
       RETURNING id`,
      [rrbId, 'Percentage Topic Drill', questionIds.length]
    );

    for (let i = 0; i < questionIds.length; i++) {
      await client.query(
        `INSERT INTO practice_set_questions (practice_set_id, question_id, sort_order) VALUES ($1, $2, $3)`,
        [practiceRows[0].id, questionIds[i], i + 1]
      );
    }

    const { rows: studentRows } = await client.query(`SELECT id FROM users WHERE email = 'student@edugate.com'`);
    if (studentRows[0]) {
      await client.query(
        `INSERT INTO enrollments (user_id, course_id, progress_percent)
         VALUES ($1, $2, 35), ($1, $3, 10)
         ON CONFLICT DO NOTHING`,
        [studentRows[0].id, courseIds[0], courseIds[1]]
      );
    }

    await client.query('COMMIT');
    console.log('Seed data inserted successfully.');
    console.log('Admin: admin@edugate.com / admin123');
    console.log('Student: student@edugate.com / student123');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
