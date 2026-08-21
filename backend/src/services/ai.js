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

function pickMockResponse(prompt, studentContext = {}) {
  const lower = prompt.toLowerCase();
  const exam = studentContext.target_exam || 'your target exam';
  const gap = studentContext.gap_to_close;
  const readiness = studentContext.readiness_percent;

  if (lower.includes('ohm')) return MOCK_EXPLANATIONS.ohm;
  if (lower.includes('blood')) return MOCK_EXPLANATIONS.blood;

  if (
    /crack|strategy|how to (prepare|study)|score gap|not improving|readiness|time management|negative marking|skip strategy|daily loop|plateau/.test(
      lower
    )
  ) {
    return `## EduGate Performance Coach — How to Crack ${exam}

${readiness != null ? `**Your readiness:** ${readiness}%${gap != null ? ` · Gap to close: ${gap} marks` : ''}` : ''}

### Philosophy
Do **not** chase more content. Close the **score gap** by fixing mark leaks:
1. **Concept leaks** — weak topics that keep repeating in Mistake Book
2. **Time traps** — hard questions that steal minutes and force rushes
3. **Guessing leaks** — wrong attempts under pressure (negative marking)

### Daily Loop (15–45 min)
1. **5-min revision** of 1 weak concept
2. **10–15 accuracy questions** on that concept only
3. **Mistake-to-Mastery** — re-attempt yesterday’s wrong Qs
4. Weekly: 1 full CBT mock → open Readiness + Diagnosis

### Skip Strategy (Negative Marking Shield)
- Attempt only when you are **Sure** or have a strong **Educated Guess**
- If stuck after ~45 seconds → **skip** and return later
- Wild guessing usually costs more than it gains

### This week’s mission
- Open **Readiness Engine** → note your gap
- Open **Why Am I Not Improving?** → accept the 3-day recovery plan
- Ask me: *"Explain [weak topic] with exam tricks"* or *"Give 10 SSC/RRB questions on [topic]"*

---
**Your question:** ${prompt}`;
  }

  if (lower.includes('summarize') || lower.includes('summary')) {
    return `## Topic Summary\n\nBased on your request: **"${prompt.slice(0, 80)}"**\n\n### Key Points\n1. Understand the core definition first.\n2. Learn 3–5 high-frequency formulas or rules.\n3. Solve previous-year questions for that topic.\n4. Revise with a one-page notes sheet before mocks.\n\n### Next Steps\n- Watch related video lectures\n- Attempt a 20-question timed quiz\n- Ask me for practice questions on weak areas`;
  }
  if (lower.includes('question') || lower.includes('mcq') || lower.includes('generate')) {
    return `## Practice Questions Generated\n\nI've prepared practice material based on: **${prompt.slice(0, 100)}**\n\nUse the **AI Question Generator** page for full MCQ sets with answers and explanations.\n\nMeanwhile, try this sample:\n\n**Q.** If 40% of a number is 240, what is the number?\nA) 500  B) 600  C) 700  D) 800\n\n**Answer:** B) 600\n**Explanation:** (40/100) × x = 240 → x = 600.`;
  }
  return `## Coach reply

${MOCK_EXPLANATIONS.default}

### Exam tip for ${exam}
After learning this concept, do **10 timed questions**, then log mistakes. Close the gap — don’t collect more notes.

---
**Your question:** ${prompt}`;
}

function buildCoachSystemPrompt(studentContext = {}) {
  const exam = studentContext.target_exam || 'RRB / SSC / Banking / State exams';
  const lines = [
    `You are EduGate Performance Coach — an AI exam coach for Indian competitive exams (${exam}).`,
    `Your job is NOT to dump content. Your job is to CLOSE SCORE GAPS.`,
    `Always diagnose mark leaks: concept weakness, calculation errors, careless mistakes, time traps, guessing / negative marking.`,
    `Structure replies with markdown: ## Why this matters, ## Core trick, ## Exam strategy, ## 2–3 practice Qs (with answers), ## Next action.`,
    `Use short Hinglish phrases only when it helps Tier-2/3 clarity (e.g. "long method mat lagao"). Prefer clear English otherwise.`,
    `If the student asks how to crack / prepare / improve, give a Daily Loop plan: revision → accuracy drill → mistake recovery → weekly mock.`,
    `Push actionable next steps: open Readiness, Mistake Book, adaptive practice, or a timed mini-CBT.`,
  ];
  if (studentContext.readiness_percent != null) {
    lines.push(
      `Student context: readiness ${studentContext.readiness_percent}%, expected score ${studentContext.current_expected_score}, target ${studentContext.target_score}, gap ${studentContext.gap_to_close}, status ${studentContext.status}, guess risk ${studentContext.guess_risk || 'n/a'}.`
    );
  }
  if (studentContext.weak_topics?.length) {
    lines.push(`Known weak topics: ${studentContext.weak_topics.slice(0, 5).join(', ')}.`);
  }
  return lines.join('\n');
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

  const bank = pickTopicBank(exam, subject, topic, difficulty);
  const n = Math.min(Math.max(Number(count) || 5, 1), 50);
  const result = [];
  for (let i = 0; i < n; i++) {
    const t = bank[i % bank.length];
    const variant = Math.floor(i / bank.length);
    result.push({
      ...t,
      question_text: variant > 0 ? `${t.question_text} [Set ${variant + 1}]` : t.question_text,
      subject: subject || t.subject || 'General',
      topic: topic || t.topic || 'Mixed',
      difficulty: difficulty || t.difficulty || 'medium',
      source: 'offline_bank',
    });
  }
  return result;
}

function normalizeKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function pickTopicBank(exam, subject, topic, difficulty) {
  const key = normalizeKey(`${subject} ${topic}`);
  const banks = TOPIC_QUESTION_BANKS;

  for (const [matchers, bank] of banks) {
    if (matchers.some((m) => key.includes(m))) {
      return bank.map((q) => ({
        ...q,
        difficulty: difficulty || q.difficulty || 'medium',
      }));
    }
  }

  // Subject-level fallbacks
  if (key.includes('math') || key.includes('quant') || key.includes('arithmetic')) {
    return PERCENTAGE_BANK;
  }
  if (key.includes('reason')) {
    return BLOOD_BANK;
  }
  if (key.includes('awareness') || key.includes('gk') || key.includes('general')) {
    return GENERAL_AWARENESS_BANK;
  }

  return buildGenericExamBank(exam, subject, topic, difficulty);
}

const PERCENTAGE_BANK = [
  {
    question_text: 'If 40% of a number is 240, what is the number?',
    option_a: '500',
    option_b: '600',
    option_c: '700',
    option_d: '800',
    correct_option: 'B',
    explanation: 'Let number = x. (40/100)×x = 240 → x = 240×100/40 = 600.',
    topic: 'Percentage',
    subject: 'Mathematics',
  },
  {
    question_text: 'A value increases from 250 to 300. What is the percentage increase?',
    option_a: '15%',
    option_b: '18%',
    option_c: '20%',
    option_d: '25%',
    correct_option: 'C',
    explanation: 'Increase = 50. Percentage = (50/250)×100 = 20%.',
    topic: 'Percentage',
    subject: 'Mathematics',
  },
  {
    question_text: 'If the price of an article is decreased by 20%, by what % must it be increased to restore the original price?',
    option_a: '20%',
    option_b: '25%',
    option_c: '30%',
    option_d: '16%',
    correct_option: 'B',
    explanation: 'After 20% fall, price = 0.8P. Need ×1.25 to get P → increase = 25%.',
    topic: 'Percentage',
    subject: 'Mathematics',
  },
  {
    question_text: 'In an election, a candidate got 55% of votes and won by 1500 votes. Find total votes polled (assuming only two candidates).',
    option_a: '12,000',
    option_b: '15,000',
    option_c: '10,000',
    option_d: '18,000',
    correct_option: 'B',
    explanation: 'Margin = 55% − 45% = 10% = 1500 → total = 1500×10 = 15,000.',
    topic: 'Percentage',
    subject: 'Mathematics',
  },
  {
    question_text: 'A student scored 72 marks out of 90. What is the percentage score?',
    option_a: '75%',
    option_b: '78%',
    option_c: '80%',
    option_d: '82%',
    correct_option: 'C',
    explanation: '(72/90)×100 = 80%.',
    topic: 'Percentage',
    subject: 'Mathematics',
  },
  {
    question_text: 'If 12% of x is 48, then 25% of x is:',
    option_a: '80',
    option_b: '90',
    option_c: '100',
    option_d: '120',
    correct_option: 'C',
    explanation: '0.12x = 48 → x = 400. 25% of 400 = 100.',
    topic: 'Percentage',
    subject: 'Mathematics',
  },
  {
    question_text: 'A number is increased by 10% and then decreased by 10%. The net change is:',
    option_a: 'No change',
    option_b: '1% decrease',
    option_c: '1% increase',
    option_d: '2% decrease',
    correct_option: 'B',
    explanation: 'Multiplier = 1.1 × 0.9 = 0.99 → 1% decrease.',
    topic: 'Percentage',
    subject: 'Mathematics',
  },
  {
    question_text: 'What is 15% of 15% of 400?',
    option_a: '6',
    option_b: '9',
    option_c: '12',
    option_d: '15',
    correct_option: 'B',
    explanation: '15% of 400 = 60; 15% of 60 = 9.',
    topic: 'Percentage',
    subject: 'Mathematics',
  },
  {
    question_text: 'If A is 25% more than B, then B is what percent less than A?',
    option_a: '20%',
    option_b: '25%',
    option_c: '30%',
    option_d: '16.67%',
    correct_option: 'A',
    explanation: 'Let B=100, A=125. Difference=25. % less = (25/125)×100 = 20%.',
    topic: 'Percentage',
    subject: 'Mathematics',
  },
  {
    question_text: 'A shopkeeper marks goods 40% above cost and gives 10% discount. His profit % is:',
    option_a: '26%',
    option_b: '30%',
    option_c: '24%',
    option_d: '28%',
    correct_option: 'A',
    explanation: 'SP = 1.4C × 0.9 = 1.26C → profit = 26%.',
    topic: 'Percentage',
    subject: 'Mathematics',
  },
];

const PROFIT_LOSS_BANK = [
  {
    question_text: 'A man buys an article for ₹500 and sells it for ₹600. Find profit percentage.',
    option_a: '15%',
    option_b: '20%',
    option_c: '25%',
    option_d: '18%',
    correct_option: 'B',
    explanation: 'Profit = 100; % = (100/500)×100 = 20%.',
    topic: 'Profit and Loss',
    subject: 'Mathematics',
  },
  {
    question_text: 'Cost price of 12 articles is equal to selling price of 9 articles. Find profit %.',
    option_a: '25%',
    option_b: '33.33%',
    option_c: '30%',
    option_d: '20%',
    correct_option: 'B',
    explanation: 'CP of 12 = SP of 9 → profit on 9 = CP of 3 → (3/9)×100 = 33.33%.',
    topic: 'Profit and Loss',
    subject: 'Mathematics',
  },
  {
    question_text: 'An article is sold at 10% loss. If sold for ₹60 more, there would be 5% profit. Find CP.',
    option_a: '₹300',
    option_b: '₹400',
    option_c: '₹350',
    option_d: '₹450',
    correct_option: 'B',
    explanation: '0.05C − (−0.10C) = 60 → 0.15C = 60 → C = 400.',
    topic: 'Profit and Loss',
    subject: 'Mathematics',
  },
  {
    question_text: 'A trader sells two articles at ₹1980 each. On one he gains 10% and on the other he loses 10%. Overall result is:',
    option_a: 'No profit no loss',
    option_b: '1% loss',
    option_c: '1% profit',
    option_d: '2% loss',
    correct_option: 'B',
    explanation: 'Equal SP with +10% and −10% → overall loss = (10)²/100 = 1%.',
    topic: 'Profit and Loss',
    subject: 'Mathematics',
  },
  {
    question_text: 'Marked price is ₹800. After 15% discount, SP is:',
    option_a: '₹680',
    option_b: '₹700',
    option_c: '₹720',
    option_d: '₹660',
    correct_option: 'A',
    explanation: 'SP = 800 × 0.85 = 680.',
    topic: 'Profit and Loss',
    subject: 'Mathematics',
  },
];

const TIME_WORK_BANK = [
  {
    question_text: 'A can do a work in 12 days and B in 18 days. In how many days can they finish together?',
    option_a: '6.5 days',
    option_b: '7.2 days',
    option_c: '8 days',
    option_d: '9 days',
    correct_option: 'B',
    explanation: '1 day work = 1/12 + 1/18 = 5/36 → days = 36/5 = 7.2.',
    topic: 'Time and Work',
    subject: 'Mathematics',
  },
  {
    question_text: 'A is twice as efficient as B. Together they finish in 14 days. A alone takes:',
    option_a: '18 days',
    option_b: '21 days',
    option_c: '24 days',
    option_d: '28 days',
    correct_option: 'B',
    explanation: 'Let B = x, A = x/2. 2/x + 1/x = 1/14 → 3/x = 1/14 → x=42, A=21.',
    topic: 'Time and Work',
    subject: 'Mathematics',
  },
  {
    question_text: '12 men can complete a work in 18 days. How many men are needed to finish in 12 days?',
    option_a: '15',
    option_b: '16',
    option_c: '18',
    option_d: '20',
    correct_option: 'C',
    explanation: 'M1D1 = M2D2 → 12×18 = M×12 → M = 18.',
    topic: 'Time and Work',
    subject: 'Mathematics',
  },
];

const SI_CI_BANK = [
  {
    question_text: 'Simple interest on ₹5000 at 8% p.a. for 3 years is:',
    option_a: '₹1000',
    option_b: '₹1200',
    option_c: '₹1400',
    option_d: '₹1600',
    correct_option: 'B',
    explanation: 'SI = PRT/100 = 5000×8×3/100 = 1200.',
    topic: 'Simple Interest',
    subject: 'Mathematics',
  },
  {
    question_text: 'Compound interest on ₹10000 at 10% p.a. for 2 years (annual compounding) is:',
    option_a: '₹2000',
    option_b: '₹2100',
    option_c: '₹2200',
    option_d: '₹2050',
    correct_option: 'B',
    explanation: 'Amount = 10000×1.1² = 12100 → CI = 2100.',
    topic: 'Compound Interest',
    subject: 'Mathematics',
  },
  {
    question_text: 'The difference between CI and SI on ₹8000 for 2 years at 5% p.a. is:',
    option_a: '₹10',
    option_b: '₹20',
    option_c: '₹25',
    option_d: '₹40',
    correct_option: 'B',
    explanation: 'Difference = P(R/100)² = 8000×(0.05)² = 20.',
    topic: 'Compound Interest',
    subject: 'Mathematics',
  },
];

const RATIO_BANK = [
  {
    question_text: 'If A:B = 2:3 and B:C = 4:5, then A:B:C is:',
    option_a: '8:12:15',
    option_b: '2:3:5',
    option_c: '4:6:5',
    option_d: '6:9:10',
    correct_option: 'A',
    explanation: 'A:B = 2:3 = 8:12; B:C = 4:5 = 12:15 → A:B:C = 8:12:15.',
    topic: 'Ratio and Proportion',
    subject: 'Mathematics',
  },
  {
    question_text: 'Divide ₹840 in the ratio 3:4. The larger share is:',
    option_a: '₹360',
    option_b: '₹420',
    option_c: '₹480',
    option_d: '₹560',
    correct_option: 'C',
    explanation: 'Parts = 7; larger = (4/7)×840 = 480.',
    topic: 'Ratio and Proportion',
    subject: 'Mathematics',
  },
];

const AVERAGE_BANK = [
  {
    question_text: 'Average of 5 numbers is 28. If one number 40 is excluded, the new average is:',
    option_a: '24',
    option_b: '25',
    option_c: '26',
    option_d: '27',
    correct_option: 'B',
    explanation: 'Sum = 140; remaining sum = 100; average of 4 = 25.',
    topic: 'Average',
    subject: 'Mathematics',
  },
  {
    question_text: 'Average age of 6 persons is 30 years. A new person of age 36 joins. New average is:',
    option_a: '30.5',
    option_b: '30.86',
    option_c: '31',
    option_d: '31.5',
    correct_option: 'B',
    explanation: 'Sum = 180; new sum = 216; average = 216/7 ≈ 30.86.',
    topic: 'Average',
    subject: 'Mathematics',
  },
];

const SPEED_BANK = [
  {
    question_text: 'A train covers 240 km in 4 hours. Its speed is:',
    option_a: '50 km/h',
    option_b: '55 km/h',
    option_c: '60 km/h',
    option_d: '65 km/h',
    correct_option: 'C',
    explanation: 'Speed = Distance/Time = 240/4 = 60 km/h.',
    topic: 'Speed Distance Time',
    subject: 'Mathematics',
  },
  {
    question_text: 'A car travels at 40 km/h for 2 hours and 60 km/h for 3 hours. Average speed is:',
    option_a: '50 km/h',
    option_b: '52 km/h',
    option_c: '48 km/h',
    option_d: '55 km/h',
    correct_option: 'B',
    explanation: 'Distance = 80+180=260; time=5; avg = 260/5 = 52 km/h.',
    topic: 'Speed Distance Time',
    subject: 'Mathematics',
  },
];

const BLOOD_BANK = [
  {
    question_text: "Pointing to a man, a woman said, \"His mother is the only daughter of my mother.\" How is the woman related to the man?",
    option_a: 'Sister',
    option_b: 'Mother',
    option_c: 'Aunt',
    option_d: 'Grandmother',
    correct_option: 'B',
    explanation: "Only daughter of woman's mother is the woman herself → she is his mother.",
    topic: 'Blood Relations',
    subject: 'Reasoning',
  },
  {
    question_text: "A is B's brother. C is A's mother. D is C's father. How is B related to D?",
    option_a: 'Grandson / Granddaughter',
    option_b: 'Son',
    option_c: 'Uncle',
    option_d: 'Brother',
    correct_option: 'A',
    explanation: 'D is maternal grandfather of A and B.',
    topic: 'Blood Relations',
    subject: 'Reasoning',
  },
  {
    question_text: "If P is the brother of Q, R is the sister of Q, and S is the father of P, how is R related to S?",
    option_a: 'Daughter',
    option_b: 'Wife',
    option_c: 'Sister',
    option_d: 'Mother',
    correct_option: 'A',
    explanation: 'S is father of P and Q; R is sister of Q → R is daughter of S.',
    topic: 'Blood Relations',
    subject: 'Reasoning',
  },
];

const SERIES_BANK = [
  {
    question_text: 'Find the next number: 2, 6, 12, 20, 30, ?',
    option_a: '40',
    option_b: '42',
    option_c: '44',
    option_d: '46',
    correct_option: 'B',
    explanation: 'Pattern: +4, +6, +8, +10, +12 → 30+12 = 42.',
    topic: 'Number Series',
    subject: 'Reasoning',
  },
  {
    question_text: 'Find the odd one out: 3, 5, 7, 9, 11',
    option_a: '3',
    option_b: '7',
    option_c: '9',
    option_d: '11',
    correct_option: 'C',
    explanation: 'All others are prime; 9 is composite.',
    topic: 'Odd One Out',
    subject: 'Reasoning',
  },
];

const GENERAL_AWARENESS_BANK = [
  {
    question_text: 'Who is known as the Father of the Indian Constitution?',
    option_a: 'Mahatma Gandhi',
    option_b: 'Jawaharlal Nehru',
    option_c: 'Dr. B.R. Ambedkar',
    option_d: 'Sardar Patel',
    correct_option: 'C',
    explanation: 'Dr. B.R. Ambedkar was the Chairman of the Drafting Committee.',
    topic: 'General Awareness',
    subject: 'General Awareness',
  },
  {
    question_text: 'Headquarters of Indian Railways is located at:',
    option_a: 'Mumbai',
    option_b: 'New Delhi',
    option_c: 'Kolkata',
    option_d: 'Chennai',
    correct_option: 'B',
    explanation: 'Railway Board / Indian Railways headquarters is in New Delhi.',
    topic: 'Railway GK',
    subject: 'General Awareness',
  },
  {
    question_text: 'Which of the following is the national animal of India?',
    option_a: 'Lion',
    option_b: 'Tiger',
    option_c: 'Elephant',
    option_d: 'Peacock',
    correct_option: 'B',
    explanation: 'The Bengal Tiger is the national animal of India.',
    topic: 'General Awareness',
    subject: 'General Awareness',
  },
  {
    question_text: 'The currency of Japan is:',
    option_a: 'Yuan',
    option_b: 'Won',
    option_c: 'Yen',
    option_d: 'Ringgit',
    correct_option: 'C',
    explanation: 'Japan uses the Yen.',
    topic: 'General Awareness',
    subject: 'General Awareness',
  },
];

const TOPIC_QUESTION_BANKS = [
  [['percentage', 'percent'], PERCENTAGE_BANK],
  [['profit', 'loss', 'discount', 'marked price'], PROFIT_LOSS_BANK],
  [['time and work', 'work and time', 'pipes', 'cistern'], TIME_WORK_BANK],
  [['simple interest', 'compound interest', 'si ', 'ci ', 'interest'], SI_CI_BANK],
  [['ratio', 'proportion'], RATIO_BANK],
  [['average', 'mean'], AVERAGE_BANK],
  [['speed', 'distance', 'time', 'train'], SPEED_BANK],
  [['blood', 'relation', 'family'], BLOOD_BANK],
  [['series', 'odd one', 'coding', 'analogy'], SERIES_BANK],
  [['railway gk', 'general awareness', 'current affairs', 'gk'], GENERAL_AWARENESS_BANK],
];

function buildGenericExamBank(exam, subject, topic, difficulty) {
  const label = topic || subject || 'this topic';
  return [
    {
      question_text: `For ${exam || 'competitive exams'}, which approach is best for ${label}?`,
      option_a: 'Learn concept → formula → practice PYQs',
      option_b: 'Memorize random options only',
      option_c: 'Skip basics and jump to hard mocks',
      option_d: 'Avoid timed practice',
      correct_option: 'A',
      explanation: `Strong ${label} preparation follows concept clarity, formula revision, then previous-year practice.`,
      subject: subject || 'General',
      topic: topic || 'Mixed',
      difficulty: difficulty || 'medium',
    },
    {
      question_text: `A ${difficulty || 'medium'} level CBT question on ${label} typically requires:`,
      option_a: 'Direct formula application with careful calculation',
      option_b: 'Guessing without reading',
      option_c: 'Ignoring units',
      option_d: 'Leaving all questions blank',
      correct_option: 'A',
      explanation: `Most ${exam || 'exam'} MCQs on ${label} are solvable with standard methods under time pressure.`,
      subject: subject || 'General',
      topic: topic || 'Mixed',
      difficulty: difficulty || 'medium',
    },
    {
      question_text: `While solving ${label} questions in ${exam || 'the exam'}, a common error is:`,
      option_a: 'Misreading data or sign/percentage base',
      option_b: 'Checking answer with reverse method',
      option_c: 'Using elimination smartly',
      option_d: 'Managing time section-wise',
      correct_option: 'A',
      explanation: 'Careless reading and wrong base for percentages/ratios cause most marks loss.',
      subject: subject || 'General',
      topic: topic || 'Mixed',
      difficulty: difficulty || 'medium',
    },
  ];
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
  const count = Math.min(Math.max(Number(params.count) || 10, 1), 50);
  const prompt = `You are an expert question setter for Indian competitive exams (${params.exam || 'RRB NTPC / SSC / Banking'}).

Generate exactly ${count} unique, exam-standard MCQ questions (UPSC/SSC/Banking/RRB quality — not school-level trivia).
Subject: ${params.subject || 'General'}
Topic: ${params.topic || 'Mixed'}
Difficulty: ${params.difficulty || 'medium'}
${params.extra ? `Extra directions:\n${params.extra}\n` : ''}
${textbook ? `IMPORTANT: Create questions AND answers ONLY from this textbook / notes matter. Do not invent unrelated facts.\n--- TEXTBOOK MATTER START ---\n${textbook.slice(0, 12000)}\n--- TEXTBOOK MATTER END ---\n` : ''}

Rules:
- Each stem must be unique. Never repeat the same question with different numbers only if the concept is identical.
- Questions must be exam-realistic (numbers, formulas, clear stem).
- Exactly 4 options: A B C D with one correct answer. Avoid "all of the above" unless necessary.
- Include a short step-by-step explanation.
- Do NOT write vague questions like "which statement is correct about X".
- For Maths: use concrete numerical problems.
- For Reasoning: use standard puzzle / relation / series style.
- For GA: use factual competitive-exam style items.
- No duplicate stems, no placeholder/demo wording.

Return ONLY a JSON array of objects with keys:
question_text, option_a, option_b, option_c, option_d, correct_option (A/B/C/D), explanation, subject, topic, difficulty.`;

  const mapQuestions = (parsed, source) =>
    parsed.map((q) => ({
      ...q,
      subject: q.subject || params.subject || 'General',
      topic: q.topic || params.topic || 'Mixed',
      difficulty: q.difficulty || params.difficulty || 'medium',
      source,
      correct_option: String(q.correct_option || 'A').toUpperCase().charAt(0),
    }));

  try {
    let raw = '';
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      raw = await callOpenAI([
        { role: 'system', content: 'You generate exam MCQs. Reply with valid JSON array only.' },
        { role: 'user', content: prompt },
      ]);
    } else if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      raw = await callGemini(prompt + '\nReply with valid JSON array only.');
    } else {
      return buildMockQuestions({ ...params, count });
    }

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return buildMockQuestions({ ...params, count });
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return buildMockQuestions({ ...params, count });
    }
    return mapQuestions(parsed, textbook ? 'notebook' : 'ai');
  } catch {
    return buildMockQuestions({ ...params, count });
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
  // Prefer GEMINI_MODEL; fall through aliases that still accept free-tier traffic.
  const preferred = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const models = [
    preferred,
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  let lastError = '';
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    lastError = await res.text();
    // Try next model on quota / not found; fail fast on auth errors
    if (res.status === 401 || res.status === 403) break;
  }
  throw new Error(`Gemini error: ${lastError}`);
}

export async function askTutor({ message, history = [], studentContext = {} } = {}) {
  const provider = process.env.AI_PROVIDER || 'mock';
  const system = buildCoachSystemPrompt(studentContext);

  try {
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      const messages = [
        { role: 'system', content: system },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: message },
      ];
      return await callOpenAI(messages);
    }

    if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      const hist = history.map((h) => `${h.role}: ${h.content}`).join('\n');
      return await callGemini(`${system}\n\n${hist}\nuser: ${message}`);
    }
  } catch (err) {
    const msg = String(err?.message || err);
    const quota = /429|RESOURCE_EXHAUSTED|quota/i.test(msg);
    const fallback = pickMockResponse(message, studentContext);
    if (quota) {
      return `${fallback}

---
**Note:** Gemini free-tier quota is exhausted right now. Showing offline coach reply. Wait ~1 minute or enable billing / new API key in Google AI Studio, then try again.`;
    }
    return `${fallback}

---
**Note:** Live AI temporarily unavailable (${msg.slice(0, 120)}). Showing offline coach reply.`;
  }

  return pickMockResponse(message, studentContext);
}

export async function analyzePerformance(payload) {
  const provider = process.env.AI_PROVIDER || 'mock';
  const base = buildMockAnalysis(payload);
  const lost = Math.max(0, (payload.total || 0) - (payload.score || 0));
  base.mark_leak_narrative = `You scored ${payload.score}/${payload.total}. Marks not earned ≈ ${lost}. Focus on weak topics (${(base.weak_subjects || []).slice(0, 3).join(', ') || 'mixed'}) and time management (${base.time_management?.verdict || 'review pace'}) instead of attempting more random papers.`;
  base.recommended_study_plan = [
    ...(base.weak_subjects || [])
      .filter((t) => !/no major|keep practicing/i.test(t))
      .slice(0, 3)
      .map((t) => `Fix "${t}" today: 5-min revision + 15 accuracy Qs + Mistake Book review`),
    'Enforce 45-second skip rule on stuck questions to stop time traps',
    'One full mock this week → open Why Am I Not Improving? and accept recovery plan',
    ...base.recommended_study_plan.slice(0, 2),
  ].slice(0, 6);

  if (provider === 'mock' || (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY)) {
    return base;
  }

  try {
    const prompt = `You are EduGate Performance Coach. Given this mock analysis JSON, return ONLY a JSON object with keys:
"recommended_study_plan" (array of 4-6 actionable strings),
"mark_leak_narrative" (1-3 sentences explaining WHY marks leaked and what to fix first).
Analysis:\n${JSON.stringify(base)}`;
    let extra = '';
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      extra = await callOpenAI([
        { role: 'system', content: 'Return valid JSON object only with recommended_study_plan and mark_leak_narrative.' },
        { role: 'user', content: prompt },
      ]);
    } else if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      extra = await callGemini(prompt + '\nReturn JSON object only.');
    }
    const match = extra.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed.recommended_study_plan)) {
        base.recommended_study_plan = parsed.recommended_study_plan;
      }
      if (typeof parsed.mark_leak_narrative === 'string' && parsed.mark_leak_narrative.trim()) {
        base.mark_leak_narrative = parsed.mark_leak_narrative.trim();
      }
    }
  } catch {
    // keep base analysis
  }
  return base;
}

export async function buildDiagnosticStudyPlan({ exam, score, total, skills = [], examDate, dailyMinutes = 60 }) {
  const accuracy = total ? Math.round((score / total) * 100) : 0;
  const weak = (skills || [])
    .filter((s) => s.status === 'weak' || s.status === 'concept' || (s.accuracy != null && s.accuracy < 55))
    .slice(0, 6);
  const strong = (skills || []).filter((s) => s.status === 'strong').slice(0, 4);
  const weakLabels = weak.map((s) => `${s.subject} / ${s.topic}`) ;
  const fallback = {
    summary: `You scored ${score}/${total} (${accuracy}%) on the ${exam || 'target'} diagnostic. AI will coach you on this CBT pattern — start with weak areas, then mixed mocks.`,
    weak_areas: weakLabels.length ? weakLabels : ['Full syllabus mixed practice'],
    strong_areas: strong.map((s) => `${s.subject} / ${s.topic}`),
    daily_routine: [
      `${dailyMinutes} minutes: 15 min revision of weakest topic`,
      '20 mixed MCQs at exam pace (skip after 45 seconds)',
      'Mistake Book review for every wrong answer',
      'End with 5 hard questions on today\'s weak topic',
    ],
    seven_day_plan: Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const w = weak[i % Math.max(weak.length, 1)];
      return {
        day: d.toISOString().slice(0, 10),
        focus: w ? `${w.subject} — ${w.topic}` : `${exam || 'Exam'} mixed`,
        tasks: i === 6 ? ['Mini mock', 'Error log', 'Revise formulas'] : ['Revision', 'Accuracy drill', 'Speed set'],
      };
    }),
    mock_advice: examDate
      ? `Exam date is ${String(examDate).slice(0, 10)}. Take 1 full CBT mock every 3 days and only analyse mark leaks, not raw attempts.`
      : 'Take 1 full CBT mock per week after 4 days of topic repair. Do not sit extra papers until accuracy on weak topics is above 70%.',
  };

  const provider = process.env.AI_PROVIDER || 'mock';
  if (provider === 'mock' || (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY)) {
    return fallback;
  }

  try {
    const prompt = `You are EduGate Performance Coach for Indian CBT (${exam || 'RRB/SSC/Banking'}).
Student diagnostic: ${score}/${total} (${accuracy}%).
Weak: ${JSON.stringify(weakLabels)}
Strong: ${JSON.stringify(fallback.strong_areas)}
Daily minutes: ${dailyMinutes}
Exam date: ${examDate || 'not set'}

Return ONLY JSON with keys:
summary (2-4 sentences),
weak_areas (string array),
strong_areas (string array),
daily_routine (4-6 strings),
seven_day_plan (array of {day, focus, tasks: string[]}),
mock_advice (1-3 sentences).
Be specific to this exam's CBT pattern. No generic filler.`;

    let raw = '';
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      raw = await callOpenAI([
        { role: 'system', content: 'Return valid JSON object only.' },
        { role: 'user', content: prompt },
      ]);
    } else if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      raw = await callGemini(prompt + '\nReturn JSON object only.');
    }
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]);
    return {
      summary: parsed.summary || fallback.summary,
      weak_areas: Array.isArray(parsed.weak_areas) ? parsed.weak_areas : fallback.weak_areas,
      strong_areas: Array.isArray(parsed.strong_areas) ? parsed.strong_areas : fallback.strong_areas,
      daily_routine: Array.isArray(parsed.daily_routine) ? parsed.daily_routine : fallback.daily_routine,
      seven_day_plan: Array.isArray(parsed.seven_day_plan) ? parsed.seven_day_plan : fallback.seven_day_plan,
      mock_advice: parsed.mock_advice || fallback.mock_advice,
    };
  } catch {
    return fallback;
  }
}

export { buildMockQuestions, buildMockAnalysis, buildQuestionsFromTextbook };
