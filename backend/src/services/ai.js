const MOCK_EXPLANATIONS = {
  "ohm": `## Ohm's Law Explained

**Ohm's Law** states that the current flowing through a conductor is directly proportional to the voltage across it, provided temperature remains constant.

### Formula
\`\`\`
V = I × R
\`\`\`
Where:
- **V** = Voltage (Volts)
- **I** = Current (Amperes)
- **R** = Resistance (Ohms)

### Example
If a 10Ω resistor has 2A current flowing through it:
V = 2 × 10 = **20 Volts**

### Practice Tip
Always rearrange: I = V/R and R = V/I for circuit problems.`,

  "blood": `## Blood Relations — Quick Guide

Blood relation puzzles test how well you track family connections.

### Core Relations
- Father's / Mother's father → **Grandfather**
- Father's / Mother's mother → **Grandmother**
- Brother's / Sister's son → **Nephew**
- Brother's / Sister's daughter → **Niece**

### Solving Method
1. Draw a family tree
2. Mark generations clearly
3. Use + for male, − for female
4. Trace the asked relation last

### Example
"A is B's brother. C is A's mother." → C is also B's mother.`,

  "default": `I'd be happy to help you learn this topic!

### Structured Explanation
1. **Core Concept** — Start with the definition and why it matters for your exam.
2. **Key Formulas / Rules** — Memorize these first.
3. **Worked Example** — Apply the concept step by step.
4. **Common Traps** — Errors students make in CBT exams.
5. **Practice** — Try 5–10 questions right after studying.

Ask me to:
- Explain any topic in depth
- Generate practice MCQs
- Summarize a PDF chapter
- Create a revision sheet

*(Configure OPENAI_API_KEY or GEMINI_API_KEY in backend/.env for live AI responses.)*`,
};

function pickMockResponse(prompt) {
  const lower = prompt.toLowerCase();
  if (lower.includes('ohm')) return MOCK_EXPLANATIONS.ohm;
  if (lower.includes('blood')) return MOCK_EXPLANATIONS.blood;
  if (lower.includes('summarize') || lower.includes('summary')) {
    return `## Topic Summary\n\nBased on your request: **"${prompt.slice(0, 80)}"**\n\n### Key Points\n1. Understand the core definition first.\n2. Learn 3–5 high-frequency formulas or rules.\n3. Solve previous-year questions for that topic.\n4. Revise with a one-page notes sheet before mocks.\n\n### Next Steps\n- Watch related video lectures\n- Attempt a 20-question timed quiz\n- Ask me for practice questions on weak areas`;
  }
  if (lower.includes('question') || lower.includes('mcq') || lower.includes('generate')) {
    return `## Practice Questions Generated\n\nI've prepared practice material based on: **${prompt.slice(0, 100)}**\n\nUse the **AI Question Generator** page for full MCQ sets with answers and explanations.\n\nMeanwhile, try this sample:\n\n**Q.** If 40% of a number is 240, what is the number?\nA) 500  B) 600  C) 700  D) 800\n\n**Answer:** B) 600\n**Explanation:** (40/100) × x = 240 → x = 600.`;
  }
  return MOCK_EXPLANATIONS.default + `\n\n---\n**Your question:** ${prompt}`;
}

function buildMockQuestions({ exam, subject, topic, difficulty, count, textbook_content }) {
  if (textbook_content && String(textbook_content).trim().length > 40) {
    return buildQuestionsFromTextbook({
      exam,
      subject,
      topic,
      difficulty,
      count,
      textbook_content,
    });
  }

  const templates = [
    {
      question_text: `In ${exam || 'the exam'}, which of the following is correct about ${topic || subject || 'this topic'}?`,
      option_a: 'Statement A only',
      option_b: 'Statement B only',
      option_c: 'Both A and B',
      option_d: 'Neither A nor B',
      correct_option: 'C',
      explanation: `Both related statements about ${topic || subject} are typically tested together in competitive exams.`,
    },
    {
      question_text: `A standard ${difficulty || 'medium'} level question on ${topic || subject}: If value increases by 20%, new value becomes?`,
      option_a: '1.2 times',
      option_b: '0.8 times',
      option_c: '2 times',
      option_d: '1.5 times',
      correct_option: 'A',
      explanation: 'Increase of 20% means multiply by 1.20.',
    },
    {
      question_text: `Which formula is most useful for ${topic || subject} problems in ${exam || 'competitive exams'}?`,
      option_a: 'Basic identity formula',
      option_b: 'Advanced calculus',
      option_c: 'Random estimation',
      option_d: 'None of these',
      correct_option: 'A',
      explanation: `Most ${topic || subject} questions rely on core identity/formula application.`,
    },
    {
      question_text: `Time management tip for ${topic || subject}: recommended time per question is?`,
      option_a: '10 seconds',
      option_b: '45–60 seconds',
      option_c: '5 minutes',
      option_d: 'No limit',
      correct_option: 'B',
      explanation: 'In CBT, allocate roughly under a minute per MCQ depending on section length.',
    },
    {
      question_text: `Common mistake in ${topic || subject} is:`,
      option_a: 'Ignoring units / sign conventions',
      option_b: 'Reading the question carefully',
      option_c: 'Checking calculations',
      option_d: 'Using elimination',
      correct_option: 'A',
      explanation: 'Careless unit/sign errors are frequent under timed CBT pressure.',
    },
  ];

  const n = Math.min(Math.max(Number(count) || 5, 1), 50);
  const result = [];
  for (let i = 0; i < n; i++) {
    const t = templates[i % templates.length];
    result.push({
      ...t,
      question_text: `${t.question_text} (Q${i + 1})`,
      subject: subject || 'General',
      topic: topic || 'Mixed',
      difficulty: difficulty || 'medium',
      source: 'ai',
    });
  }
  return result;
}

/** Build MCQs grounded in pasted / uploaded textbook chapter text (works offline with mock AI). */
function buildQuestionsFromTextbook({ exam, subject, topic, difficulty, count, textbook_content }) {
  const text = String(textbook_content || '').replace(/\s+/g, ' ').trim();
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 35 && s.length <= 280);

  const n = Math.min(Math.max(Number(count) || 10, 1), 50);
  const result = [];
  const pool = sentences.length ? sentences : [text.slice(0, 220) || `${subject || 'Topic'} basics from the textbook.`];

  for (let i = 0; i < n; i++) {
    const fact = pool[i % pool.length];
    const short = fact.length > 140 ? `${fact.slice(0, 137)}...` : fact;
    const distractors = [
      'This statement is not supported by the textbook chapter.',
      'Opposite of the textbook explanation.',
      'Unrelated exam trick option.',
    ];
    const styles = [
      {
        question_text: `Based on the textbook matter for ${topic || subject || 'this chapter'}, which statement is correct?`,
        option_a: short,
        option_b: distractors[0],
        option_c: distractors[1],
        option_d: distractors[2],
        correct_option: 'A',
        explanation: `Taken from textbook: ${fact}`,
      },
      {
        question_text: `According to the study material (${exam || 'exam'} / ${subject || 'subject'}), identify the true fact:`,
        option_a: distractors[1],
        option_b: short,
        option_c: distractors[0],
        option_d: distractors[2],
        correct_option: 'B',
        explanation: `Notebook LLM extracted this from the textbook: ${fact}`,
      },
      {
        question_text: `From the uploaded textbook chapter on ${topic || subject}, what is taught?`,
        option_a: distractors[2],
        option_b: distractors[0],
        option_c: short,
        option_d: distractors[1],
        correct_option: 'C',
        explanation: `Source textbook line: ${fact}`,
      },
      {
        question_text: `Pick the option that matches the textbook content for ${topic || subject}:`,
        option_a: distractors[0],
        option_b: distractors[2],
        option_c: distractors[1],
        option_d: short,
        correct_option: 'D',
        explanation: `Directly based on textbook matter: ${fact}`,
      },
    ];
    const t = styles[i % styles.length];
    result.push({
      ...t,
      question_text: `${t.question_text} (Q${i + 1})`,
      subject: subject || 'General',
      topic: topic || 'Textbook',
      difficulty: difficulty || 'medium',
      source: 'notebook',
    });
  }
  return result;
}

export async function generateQuestions(params) {
  const provider = process.env.AI_PROVIDER || 'mock';
  const textbook = String(params.textbook_content || '').trim();
  const prompt = `Generate ${params.count || 10} MCQ questions for ${params.exam || 'competitive exam'}, subject ${params.subject || 'General'}, topic ${params.topic || 'Mixed'}, difficulty ${params.difficulty || 'medium'}.
${params.extra ? `Admin / Notebook LLM directions:\n${params.extra}\n` : ''}
${textbook ? `IMPORTANT: Create questions AND answers ONLY from this textbook / notes matter. Do not invent unrelated facts.\n--- TEXTBOOK MATTER START ---\n${textbook.slice(0, 12000)}\n--- TEXTBOOK MATTER END ---\n` : ''}
Each question must include a clear correct answer and a short explanation grounded in the textbook.
Return ONLY a JSON array of objects with keys: question_text, option_a, option_b, option_c, option_d, correct_option (A/B/C/D), explanation, subject, topic, difficulty.`;

  try {
    let raw = '';
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      raw = await callOpenAI([
        { role: 'system', content: 'You generate exam MCQs from provided textbook matter. Reply with valid JSON array only.' },
        { role: 'user', content: prompt },
      ]);
    } else if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      raw = await callGemini(prompt + '\nReply with valid JSON array only.');
    } else {
      return buildMockQuestions(params);
    }

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return buildMockQuestions(params);
    const parsed = JSON.parse(match[0]);
    return parsed.map((q) => ({
      ...q,
      subject: q.subject || params.subject || 'General',
      topic: q.topic || params.topic || 'Mixed',
      difficulty: q.difficulty || params.difficulty || 'medium',
      source: textbook ? 'notebook' : 'ai',
      correct_option: String(q.correct_option || 'A').toUpperCase().charAt(0),
    }));
  } catch {
    return buildMockQuestions(params);
  }
}

function buildMockAnalysis({ score, total, answers, questions, timeTakenSeconds }) {
  const byTopic = {};
  for (const q of questions) {
    const key = q.topic || q.subject || 'General';
    if (!byTopic[key]) byTopic[key] = { correct: 0, total: 0 };
    byTopic[key].total += 1;
    const ans = answers?.[q.id];
    if (ans && ans === q.correct_option) byTopic[key].correct += 1;
  }

  const topicStats = Object.entries(byTopic).map(([topic, s]) => ({
    topic,
    accuracy: s.total ? Math.round((s.correct / s.total) * 100) : 0,
    correct: s.correct,
    total: s.total,
  }));

  const strong = topicStats.filter((t) => t.accuracy >= 70).map((t) => t.topic);
  const weak = topicStats.filter((t) => t.accuracy < 50).map((t) => t.topic);
  const accuracy = total ? Math.round((score / total) * 100) : 0;
  const avgTime = total ? Math.round((timeTakenSeconds || 0) / total) : 0;

  return {
    strong_subjects: strong.length ? strong : ['Keep practicing for clearer strengths'],
    weak_subjects: weak.length ? weak : ['No major weak topics detected'],
    accuracy,
    time_management: {
      total_seconds: timeTakenSeconds || 0,
      avg_seconds_per_question: avgTime,
      verdict: avgTime > 90 ? 'Slow — practice timed quizzes' : avgTime < 20 ? 'Possibly rushed — recheck accuracy' : 'Balanced pace',
    },
    topic_breakdown: topicStats,
    recommended_study_plan: [
      ...(weak.length
        ? weak.map((t) => `Focus 2 days on "${t}" — theory + 50 practice questions`)
        : ['Maintain daily 30-minute mixed practice']),
      'Take one full-length mock every weekend',
      'Revise formulas every morning for 15 minutes',
    ],
    suggested_videos: weak.slice(0, 2).map((t) => `Watch "${t} Basics"`).concat(['Watch "Time Management for CBT"']),
    suggested_books: ['Quantitative Aptitude by R.S. Aggarwal', 'Lucent GK', 'Previous Year Papers compilation'],
    suggested_practice: weak.slice(0, 2).map((t) => `Practice 50 questions on ${t}`).concat(['Daily 20-question quiz']),
  };
}

async function callOpenAI(messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error: ${err}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

export async function askTutor({ message, history = [] }) {
  const provider = process.env.AI_PROVIDER || 'mock';
  const system = `You are EduGate AI Tutor for competitive exams (RRB, SSC, Banking, UPSC, State PSC).
Explain clearly with examples, formulas, and short practice questions.
Keep answers structured with markdown headings.`;

  if (provider === 'openai' && process.env.OPENAI_API_KEY) {
    const messages = [
      { role: 'system', content: system },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];
    return callOpenAI(messages);
  }

  if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
    const hist = history.map((h) => `${h.role}: ${h.content}`).join('\n');
    return callGemini(`${system}\n\n${hist}\nuser: ${message}`);
  }

  return pickMockResponse(message);
}

export async function analyzePerformance(payload) {
  const provider = process.env.AI_PROVIDER || 'mock';
  const base = buildMockAnalysis(payload);

  if (provider === 'mock' || (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY)) {
    return base;
  }

  try {
    const prompt = `Given this exam analysis JSON, refine the study plan recommendations briefly:\n${JSON.stringify(base)}`;
    let extra = '';
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      extra = await callOpenAI([
        { role: 'system', content: 'Return improved recommended_study_plan as a JSON array of strings only.' },
        { role: 'user', content: prompt },
      ]);
    } else if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      extra = await callGemini(prompt + '\nReturn JSON array of study plan strings only.');
    }
    const match = extra.match(/\[[\s\S]*\]/);
    if (match) {
      base.recommended_study_plan = JSON.parse(match[0]);
    }
  } catch {
    // keep base analysis
  }
  return base;
}

export { buildMockQuestions, buildMockAnalysis, buildQuestionsFromTextbook };
