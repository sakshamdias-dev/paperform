// Sample content used by the public landing page + interactive playground.
// Nothing here touches Supabase — it is purely local demo data.

export type DemoType = 'mcq' | 'subjective' | 'truefalse' | 'fillblank';
export type DemoDifficulty = 'easy' | 'medium' | 'hard';
export type DemoBloom = 'Remember' | 'Understand' | 'Apply' | 'Analyse' | 'Evaluate' | 'Create';
export type DemoSubject = 'Mathematics' | 'Physics' | 'Chemistry' | 'Biology';

export interface DemoSub {
  text: string;
  marks: number;
}

export interface DemoQuestion {
  id: string;
  subject: DemoSubject;
  chapter: string;
  type: DemoType;
  difficulty: DemoDifficulty;
  bloom: DemoBloom;
  marks: number;
  /** Text may contain inline math wrapped in $...$ */
  text: string;
  options?: string[];
  subs?: DemoSub[];
}

export const BLOOM_ORDER: DemoBloom[] = ['Remember', 'Understand', 'Apply', 'Analyse', 'Evaluate', 'Create'];

export const TYPE_LABEL: Record<DemoType, string> = {
  mcq: 'MCQ',
  subjective: 'Subjective',
  truefalse: 'True / False',
  fillblank: 'Fill in the blank',
};

export const DEMO_BANK: DemoQuestion[] = [
  {
    id: 'm1', subject: 'Mathematics', chapter: 'Quadratic Equations', type: 'mcq', difficulty: 'easy', bloom: 'Remember', marks: 1,
    text: 'The roots of $x^2 - 5x + 6 = 0$ are:',
    options: ['$2, 3$', '$-2, -3$', '$1, 6$', '$-1, 6$'],
  },
  {
    id: 'm2', subject: 'Mathematics', chapter: 'Quadratic Equations', type: 'subjective', difficulty: 'medium', bloom: 'Apply', marks: 3,
    text: 'Find the value of $k$ for which $kx^2 + 4x + 1 = 0$ has real and equal roots.',
  },
  {
    id: 'm3', subject: 'Mathematics', chapter: 'Calculus', type: 'subjective', difficulty: 'hard', bloom: 'Analyse', marks: 6,
    text: 'Let $f(x) = x^3 - 6x^2 + 9x + 1$.',
    subs: [
      { text: 'Find $f\'(x)$ and the critical points of $f$.', marks: 2 },
      { text: 'Determine the intervals on which $f$ is increasing.', marks: 2 },
      { text: 'Evaluate $\\int_0^2 f(x)\\,dx$.', marks: 2 },
    ],
  },
  {
    id: 'm4', subject: 'Mathematics', chapter: 'Trigonometry', type: 'fillblank', difficulty: 'easy', bloom: 'Remember', marks: 1,
    text: 'The value of $\\sin^2\\theta + \\cos^2\\theta$ is ________.',
  },
  {
    id: 'm5', subject: 'Mathematics', chapter: 'Probability', type: 'mcq', difficulty: 'medium', bloom: 'Understand', marks: 1,
    text: 'Two fair dice are thrown. The probability that the sum is $7$ is:',
    options: ['$\\frac{1}{6}$', '$\\frac{1}{12}$', '$\\frac{5}{36}$', '$\\frac{7}{36}$'],
  },
  {
    id: 'm6', subject: 'Mathematics', chapter: 'Matrices', type: 'subjective', difficulty: 'hard', bloom: 'Evaluate', marks: 4,
    text: 'If $A = \\begin{bmatrix} 2 & 1 \\\\ 1 & 3 \\end{bmatrix}$, verify that $A^2 - 5A + 5I = O$ and hence find $A^{-1}$.',
  },
  {
    id: 'p1', subject: 'Physics', chapter: 'Laws of Motion', type: 'mcq', difficulty: 'easy', bloom: 'Remember', marks: 1,
    text: "Which equation represents Newton's second law of motion?",
    options: ['$F = m/a$', '$F = ma$', '$F = m + a$', '$E = mc^2$'],
  },
  {
    id: 'p2', subject: 'Physics', chapter: 'Kinematics', type: 'subjective', difficulty: 'medium', bloom: 'Apply', marks: 5,
    text: 'A car starts from rest and accelerates uniformly at $2\\,\\text{m/s}^2$ for $5\\,\\text{s}$.',
    subs: [
      { text: 'Calculate its final velocity.', marks: 2 },
      { text: 'Calculate the total distance travelled.', marks: 3 },
    ],
  },
  {
    id: 'p3', subject: 'Physics', chapter: 'Electricity', type: 'truefalse', difficulty: 'easy', bloom: 'Understand', marks: 1,
    text: 'The resistance of a conductor is independent of its temperature.',
  },
  {
    id: 'p4', subject: 'Physics', chapter: 'Optics', type: 'subjective', difficulty: 'hard', bloom: 'Analyse', marks: 4,
    text: 'Using the lens formula $\\frac{1}{v} - \\frac{1}{u} = \\frac{1}{f}$, find the image position for an object placed $30\\,\\text{cm}$ from a convex lens of focal length $20\\,\\text{cm}$. Comment on the nature of the image.',
  },
  {
    id: 'p5', subject: 'Physics', chapter: 'Work & Energy', type: 'mcq', difficulty: 'medium', bloom: 'Apply', marks: 1,
    text: 'A body of mass $2\\,\\text{kg}$ moves at $3\\,\\text{m/s}$. Its kinetic energy is:',
    options: ['$6\\,\\text{J}$', '$9\\,\\text{J}$', '$18\\,\\text{J}$', '$3\\,\\text{J}$'],
  },
  {
    id: 'c1', subject: 'Chemistry', chapter: 'Chemical Reactions', type: 'subjective', difficulty: 'medium', bloom: 'Understand', marks: 2,
    text: 'Balance the equation: $\\mathrm{Fe} + \\mathrm{H_2O} \\rightarrow \\mathrm{Fe_3O_4} + \\mathrm{H_2}$',
  },
  {
    id: 'c2', subject: 'Chemistry', chapter: 'Periodic Table', type: 'mcq', difficulty: 'easy', bloom: 'Remember', marks: 1,
    text: 'Which element has the highest electronegativity?',
    options: ['Oxygen', 'Chlorine', 'Fluorine', 'Nitrogen'],
  },
  {
    id: 'c3', subject: 'Chemistry', chapter: 'Mole Concept', type: 'subjective', difficulty: 'hard', bloom: 'Apply', marks: 3,
    text: 'Calculate the number of molecules present in $8.8\\,\\text{g}$ of $\\mathrm{CO_2}$. ($N_A = 6.022 \\times 10^{23}$)',
  },
  {
    id: 'c4', subject: 'Chemistry', chapter: 'Acids & Bases', type: 'fillblank', difficulty: 'easy', bloom: 'Remember', marks: 1,
    text: 'A solution with $\\mathrm{pH} = 7$ at $25^\\circ\\mathrm{C}$ is called ________.',
  },
  {
    id: 'b1', subject: 'Biology', chapter: 'Cell Biology', type: 'subjective', difficulty: 'hard', bloom: 'Evaluate', marks: 5,
    text: 'Explain the fundamental mechanism of cellular respiration.',
    subs: [
      { text: 'Differentiate between aerobic and anaerobic respiration.', marks: 3 },
      { text: 'Where does glycolysis take place in a eukaryotic cell?', marks: 2 },
    ],
  },
  {
    id: 'b2', subject: 'Biology', chapter: 'Genetics', type: 'mcq', difficulty: 'medium', bloom: 'Understand', marks: 1,
    text: 'A cross between $Tt$ and $tt$ produces tall plants in the ratio:',
    options: ['$1:1$', '$3:1$', '$1:2:1$', 'All tall'],
  },
  {
    id: 'b3', subject: 'Biology', chapter: 'Ecology', type: 'truefalse', difficulty: 'easy', bloom: 'Remember', marks: 1,
    text: 'Decomposers occupy the first trophic level of a food chain.',
  },
  {
    id: 'b4', subject: 'Biology', chapter: 'Human Physiology', type: 'subjective', difficulty: 'medium', bloom: 'Create', marks: 4,
    text: 'Design a labelled flowchart showing the path of blood through the human heart.',
  },
];

export const SUBJECTS: DemoSubject[] = ['Mathematics', 'Physics', 'Chemistry', 'Biology'];

export const getQuestion = (id: string) => DEMO_BANK.find(q => q.id === id);

