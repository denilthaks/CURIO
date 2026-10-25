// Shared types for quest content, runs and saved progress.

export type Cell = string | number | null;

export interface Character {
  name: string;
  role: string;
  initial: string;
}

export interface Evidence {
  id: string;
  kind: 'source' | 'ai' | 'message' | string;
  kindLabel: string;
  title: string;
  from: string;
  body: string[];
}

interface SceneBase {
  id: string;
  title: string;
  speaker?: string;
  lines?: string[];
  context?: string;
  action?: string;
}

interface ChallengeBase extends SceneBase {
  prompt: string;
  hints: string[];
  explanation: string;
  skills: string[];
  xp: number;
}

export interface DialogueScene extends SceneBase { type: 'dialogue' }
export interface EndingScene extends SceneBase { type: 'ending' }
export interface EvidenceScene extends SceneBase { type: 'evidence'; evidence: string[] }

export interface ChoiceOption { id: string; text: string; feedback: string; code?: boolean }
export interface ChoiceScene extends ChallengeBase {
  type: 'choice';
  options: ChoiceOption[];
  correct: string;
  code?: string; // optional code/data snippet shown with the question
}

export interface AssembleOption { id: string; text: string; correct?: boolean; feedback?: string }
export interface AssembleScene extends ChallengeBase {
  type: 'assemble';
  heading: string;
  fixedLines?: string[];
  successFeedback?: string;
  slots: { id: string; label: string; options: AssembleOption[] }[];
  extras?: { id: string; text: string; supported: boolean; feedback?: string }[];
}

export interface TableData { name: string; columns: string[]; rows: Cell[][] }

export interface SqlScene extends ChallengeBase {
  type: 'sql';
  setup: string; // SQL run on a fresh in-memory database before each query
  tables: TableData[]; // shown to the player
  starter: string;
  expected: { rows: Cell[][]; ordered?: boolean };
  requireKeywords?: string[];
  solution: string;
  successFeedback?: string;
}

export interface PythonScene extends ChallengeBase {
  type: 'python';
  code: string[]; // program lines; "___" marks where the player's expression goes
  variables: Record<string, unknown>; // values available to the expression
  expected: { value?: unknown; output?: string };
  outputTemplate?: string; // e.g. "print(___)" → shows what the program prints
  requireNames?: string[];
  forbidPattern?: string;
  starter?: string;
  solution: string;
  successFeedback?: string;
}

export interface ExcelScene extends ChallengeBase {
  type: 'excel';
  columns: string[]; // header labels for A, B, C…
  rows: Cell[][]; // row 1 is the first data row under the header (sheet row 2)
  target: string; // e.g. "D2"
  fillDownTo?: string; // e.g. "D5": formula is copied down like Excel's fill handle
  expected: Record<string, number>;
  requireFunctions?: string[];
  starter?: string;
  solution: string;
  successFeedback?: string;
}

export interface KpiScene extends ChallengeBase {
  type: 'kpi';
  categories: { id: string; label: string; description: string }[];
  cards: { id: string; label: string; detail: string; category: string; feedback: string }[];
  successFeedback?: string;
}

export type ChallengeScene = ChoiceScene | AssembleScene | SqlScene | PythonScene | ExcelScene | KpiScene;
export type Scene = DialogueScene | EvidenceScene | EndingScene | ChallengeScene;

export interface Quest {
  schemaVersion: 1;
  id: string;
  number: number;
  title: string;
  completionTitle?: string;
  region: string;
  destination: string;
  subject: string;
  estimatedMinutes: string;
  intro: string;
  objectives: { id: string; label: string }[];
  characters: Record<string, Character>;
  evidence: Evidence[];
  xp: { firstTryBonus: number; completion: number };
  badge?: { id: string; name: string; description: string; icon?: string };
  takeaway: string;
  scenes: Scene[];
}

export interface Destination {
  id: string;
  name: string;
  theme: string;
  icon: string;
  quests: string[];
  unlockedBy: string[] | 'planned';
  position: [number, number]; // island x/z in model units; height comes from raycasting
  landmark: string;
  teaser?: string;
}

export interface World {
  schemaVersion: 1;
  destinations: Destination[];
}

// ---- Runs and answers ----

export interface ChallengeResult { attempts: number; solved: boolean; revealed: boolean }

export interface Run {
  questId: string;
  sceneIndex: number;
  inspected: string[];
  results: Record<string, ChallengeResult>;
  completed: boolean;
}

export interface SqlResult { columns: string[]; rows: Cell[][] }

export type Answer =
  | string // choice option id
  | { slots: Record<string, string>; extras: string[] } // assemble
  | { query: string; result?: SqlResult; error?: string } // sql (executed by sql-runner)
  | { expression: string } // python
  | { formula: string } // excel
  | { placement: Record<string, string> }; // kpi

export interface Issue { id: string; label: string; text: string }

export interface Outcome {
  valid: boolean;
  message?: string;
  correct?: boolean;
  feedback?: string;
  issues?: Issue[];
  output?: string; // what the code/query/formula produced, shown to the player
  attempts?: number;
  hint?: string | null;
  canReveal?: boolean;
  explanation?: string;
}
