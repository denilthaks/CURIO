// Browser-side progress. localStorage is user-controlled, so everything read
// back is treated as untrusted: migrated, validated and clamped. Suitable for
// a personal prototype, not for accounts or trusted scores.

import type { Quest, Run } from './types';
import { computeStars, restoreRun, MEDAL_RANK, type Medal } from './game-engine';
import { sanitizeConcepts, type ConceptRecord } from './games/mastery';

export const STORAGE_KEY = 'curiotrail.progress';
export const SCHEMA_VERSION = 4;
export const MEDALS: Medal[] = ['none', 'bronze', 'silver', 'gold'];
export const EMBLEMS = ['fox', 'owl', 'deer', 'badger'] as const;
export const MAX_NAME_LENGTH = 24;
const MAX_XP = 100000;

export type Emblem = (typeof EMBLEMS)[number];
export type Motion = 'system' | 'reduce' | 'full';
export type TextSize = 'normal' | 'large';
export type Graphics = 'auto' | 'high' | 'low' | 'off';

export interface Settings { motion: Motion; textSize: TextSize; graphics: Graphics }

export interface QuestRecord {
  run: Run | null; // in-progress (or just finished) run
  runXp: number;
  lastRun: Run | null; // last finished run, shown on the results screen
  lastXp: number;
  bestXp: number;
  bestStars: number;
  completed: boolean;
  completions: number;
  /** Mastery reached (boss threshold met). Unlocks depend on this, not on XP. */
  mastered: boolean;
  /** Best boss mastery (0–1) across runs; null when the quest has no boss or it was never scored. */
  bestMastery: number | null;
  bestMedal: Medal;
}

export interface Progress {
  version: number;
  player: { name: string; emblem: Emblem } | null;
  quests: Record<string, QuestRecord>;
  achievements: string[];
  /** Lessons (theory cards) the player has read, as "questId/sceneId". */
  lessons: string[];
  settings: Settings;
  /** Per-concept mastery (encyclopedia ids), kept on this device only. */
  concepts: Record<string, ConceptRecord>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function defaultSettings(): Settings {
  return { motion: 'system', textSize: 'normal', graphics: 'auto' };
}

export function defaultProgress(): Progress {
  return { version: SCHEMA_VERSION, player: null, quests: {}, achievements: [], lessons: [], settings: defaultSettings(), concepts: {} };
}

export function emptyRecord(): QuestRecord {
  return { run: null, runXp: 0, lastRun: null, lastXp: 0, bestXp: 0, bestStars: 0, completed: false, completions: 0, mastered: false, bestMastery: null, bestMedal: 'none' };
}

function clampInt(value: unknown, max = MAX_XP): number {
  return Number.isInteger(value) && (value as number) > 0 ? Math.min(value as number, max) : 0;
}

export function cleanName(value: unknown): string {
  if (typeof value !== 'string') return '';
  // Drop control characters; the UI always renders names as text, never HTML.
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME_LENGTH);
}

function sanitizePlayer(raw: unknown): Progress['player'] {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    name: cleanName(r.name) || 'Pathfinder',
    emblem: (EMBLEMS as readonly string[]).includes(r.emblem as string) ? (r.emblem as Emblem) : EMBLEMS[0],
  };
}

function sanitizeSettings(raw: unknown): Settings {
  const settings = defaultSettings();
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    if (['system', 'reduce', 'full'].includes(r.motion as string)) settings.motion = r.motion as Motion;
    if (['normal', 'large'].includes(r.textSize as string)) settings.textSize = r.textSize as TextSize;
    if (['auto', 'high', 'low', 'off'].includes(r.graphics as string)) settings.graphics = r.graphics as Graphics;
  }
  return settings;
}

function sanitizeQuestRecord(id: string, raw: unknown): QuestRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  // Runs are re-checked against quest content by restoreRun().
  const ownRun = (value: unknown) => (value && typeof value === 'object' && (value as Run).questId === id ? (value as Run) : null);
  const run = ownRun(r.run);
  const lastRun = ownRun(r.lastRun);
  return {
    run,
    runXp: run ? clampInt(r.runXp) : 0,
    lastRun,
    lastXp: lastRun ? clampInt(r.lastXp) : 0,
    bestXp: clampInt(r.bestXp),
    bestStars: clampInt(r.bestStars, 3),
    completed: r.completed === true,
    completions: clampInt(r.completions, 9999),
    // Saves from before mastery existed: a completed quest keeps its unlocks.
    mastered: typeof r.mastered === 'boolean' ? r.mastered && r.completed === true : r.completed === true,
    bestMastery: typeof r.bestMastery === 'number' && r.bestMastery >= 0 && r.bestMastery <= 1 ? r.bestMastery : null,
    bestMedal: (MEDALS as string[]).includes(r.bestMedal as string) ? (r.bestMedal as Medal) : 'none',
  };
}

/**
 * Step order of each quest in schema v2 (release 0.2). v2 saves record a run's
 * position only as an index; v3 adds lesson steps, which shifts indices, so the
 * migration converts each saved index into a stable step id using this table.
 * Do not edit: it describes content that has already shipped.
 */
export const V2_SCENE_ORDER: Record<string, string[]> = {
  'missing-signal': ['arrive', 'investigate', 'find-source', 'spot-conflict', 'verify-time', 'rumour', 'better-prompt', 'assemble', 'restore'],
  'the-ledger': ['arrive', 'read-select', 'filter-north', 'group-products', 'top-product', 'interpret', 'ending'],
  'broken-tally': ['arrive', 'read-error', 'fix-print', 'average', 'revenue', 'predict', 'ending'],
  'market-ledger': ['arrive', 'find-cell', 'row-revenue', 'total', 'average-price', 'absolute', 'ending'],
  'great-hall-dashboard': ['arrive', 'what-kpi', 'sort-kpis', 'tradeoff', 'chart', 'ending'],
};

function addSceneId(questId: string, run: unknown): unknown {
  if (!run || typeof run !== 'object') return run;
  const r = run as Record<string, unknown>;
  if (typeof r.sceneId === 'string') return run;
  const order = V2_SCENE_ORDER[questId];
  const id = order && Number.isInteger(r.sceneIndex) ? order[r.sceneIndex as number] : undefined;
  return id ? { ...r, sceneId: id } : run;
}

// Upgrade older saves to the current shape. One step per schema change.
export function migrate(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const data: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  if (!Number.isInteger(data.version)) return null;
  if ((data.version as number) > SCHEMA_VERSION) return null; // saved by a newer release
  if (data.version === 1) {
    // v2 added star ratings (back-filled from the last finished run once quest
    // content is loaded, see reconcileStars) and the graphics setting.
    data.version = 2;
  }
  if (data.version === 2) {
    // v3 added lessons (theory cards) and stable step ids on runs.
    const quests: Record<string, unknown> = {};
    if (data.quests && typeof data.quests === 'object' && !Array.isArray(data.quests)) {
      for (const [id, record] of Object.entries(data.quests as Record<string, unknown>)) {
        quests[id] = record && typeof record === 'object'
          ? { ...(record as Record<string, unknown>), run: addSceneId(id, (record as Record<string, unknown>).run), lastRun: addSceneId(id, (record as Record<string, unknown>).lastRun) }
          : record;
      }
    }
    data.quests = quests;
    data.lessons = [];
    data.version = 3;
  }
  if (data.version === 3) {
    // v4 added mastery (unlocks follow mastery), medals, wagers and per-concept
    // records. Completed quests are treated as mastered so no one loses an
    // unlock they already earned (see sanitizeQuestRecord).
    data.concepts = {};
    data.version = 4;
  }
  return data;
}

export function sanitizeProgress(raw: unknown): Progress {
  const data = migrate(raw);
  if (!data) return defaultProgress();
  const quests: Record<string, QuestRecord> = {};
  if (data.quests && typeof data.quests === 'object' && !Array.isArray(data.quests)) {
    for (const [id, record] of Object.entries(data.quests as Record<string, unknown>)) {
      if (!/^[a-z0-9-]{1,64}$/.test(id)) continue;
      const clean = sanitizeQuestRecord(id, record);
      if (clean) quests[id] = clean;
    }
  }
  const achievements = Array.isArray(data.achievements)
    ? [...new Set(data.achievements.filter((a): a is string => typeof a === 'string' && /^[a-z0-9-]{1,64}$/.test(a)))]
    : [];
  const lessons = Array.isArray(data.lessons)
    ? [...new Set(data.lessons.filter((l): l is string => typeof l === 'string' && /^[a-z0-9-]{1,64}\/[a-z0-9-]{1,64}$/.test(l)))].slice(0, 1000)
    : [];
  return {
    version: SCHEMA_VERSION,
    player: sanitizePlayer(data.player),
    quests,
    achievements,
    lessons,
    settings: sanitizeSettings(data.settings),
    concepts: sanitizeConcepts(data.concepts),
  };
}

function browserStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage;
    const probe = '__curiotrail_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null; // private mode, blocked storage, or no window
  }
}

export function createProgressStore(storage: StorageLike | null = browserStorage()) {
  return {
    available: Boolean(storage),
    load(): Progress {
      if (!storage) return defaultProgress();
      try {
        const text = storage.getItem(STORAGE_KEY);
        return text ? sanitizeProgress(JSON.parse(text)) : defaultProgress();
      } catch {
        return defaultProgress(); // corrupted JSON
      }
    },
    save(progress: Progress): boolean {
      if (!storage) return false;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(progress));
        return true;
      } catch {
        return false; // quota exceeded or storage revoked
      }
    },
    reset(): void {
      if (!storage) return;
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        /* nothing to clear */
      }
    },
  };
}

// ---- Pure helpers for updating progress ----

export function questRecord(progress: Progress, questId: string): QuestRecord {
  return progress.quests[questId] || emptyRecord();
}

export function withPlayer(progress: Progress, name: string, emblem: string): Progress {
  return { ...progress, player: sanitizePlayer({ name, emblem }) };
}

export function withSettings(progress: Progress, settings: Partial<Settings>): Progress {
  return { ...progress, settings: sanitizeSettings({ ...progress.settings, ...settings }) };
}

export function withRun(progress: Progress, run: Run, runXp: number): Progress {
  const record = questRecord(progress, run.questId);
  return { ...progress, quests: { ...progress.quests, [run.questId]: { ...record, run, runXp: clampInt(runXp) } } };
}

// Record a finished run. Replays keep the best score rather than stacking XP,
// so total XP reflects demonstrated skill, not repetition.
export interface CompletionResult {
  /** Whether this run reached mastery. Defaults to true for quests without a boss. */
  mastered?: boolean;
  mastery?: number | null;
  medal?: Medal;
}

export function withCompletion(progress: Progress, run: Run, xp: number, stars: number, achievementId?: string, result: CompletionResult = {}): Progress {
  const record = questRecord(progress, run.questId);
  const alreadyCounted = Boolean(record.run && record.run.completed);
  const mastered = result.mastered ?? true;
  const mastery = typeof result.mastery === 'number' ? result.mastery : null;
  const medal = result.medal ?? 'none';
  const quests = {
    ...progress.quests,
    [run.questId]: {
      run,
      runXp: clampInt(xp),
      lastRun: run,
      lastXp: clampInt(xp),
      bestXp: Math.max(record.bestXp, clampInt(xp)),
      bestStars: Math.max(record.bestStars, clampInt(stars, 3)),
      completed: true,
      completions: record.completions + (alreadyCounted ? 0 : 1),
      // Replays never take mastery or a medal away.
      mastered: record.mastered || mastered,
      bestMastery: mastery === null ? record.bestMastery : Math.max(record.bestMastery ?? 0, mastery),
      bestMedal: MEDAL_RANK[medal] > MEDAL_RANK[record.bestMedal] ? medal : record.bestMedal,
    },
  };
  const achievements = achievementId && !progress.achievements.includes(achievementId)
    ? [...progress.achievements, achievementId]
    : progress.achievements;
  return { ...progress, quests, achievements };
}

export function withReplay(progress: Progress, questId: string): Progress {
  const record = questRecord(progress, questId);
  return { ...progress, quests: { ...progress.quests, [questId]: { ...record, run: null, runXp: 0 } } };
}

/** Replace the per-concept mastery records (computed by games/mastery.ts). */
export function withConcepts(progress: Progress, concepts: Record<string, ConceptRecord>): Progress {
  return concepts === progress.concepts ? progress : { ...progress, concepts };
}

/** Remember that a lesson was read. Lessons award no XP: XP is for demonstrated skill. */
export function withLessonRead(progress: Progress, key: string): Progress {
  if (progress.lessons.includes(key) || !/^[a-z0-9-]{1,64}\/[a-z0-9-]{1,64}$/.test(key)) return progress;
  return { ...progress, lessons: [...progress.lessons, key] };
}

export function totalXp(progress: Progress): number {
  return Object.values(progress.quests).reduce((sum, r) => sum + Math.max(r.bestXp, r.runXp), 0);
}

export function totalStars(progress: Progress): number {
  return Object.values(progress.quests).reduce((sum, r) => sum + r.bestStars, 0);
}

/** Back-fill stars for saves made before stars existed (schema v1). */
export function reconcileStars(progress: Progress, quests: Map<string, Quest>): Progress {
  let changed = false;
  const next = { ...progress.quests };
  for (const [id, record] of Object.entries(progress.quests)) {
    const quest = quests.get(id);
    if (!quest || !record.completed || record.bestStars > 0 || !record.lastRun) continue;
    const stars = computeStars(quest, restoreRun(quest, record.lastRun));
    if (stars > 0) {
      next[id] = { ...record, bestStars: stars };
      changed = true;
    }
  }
  return changed ? { ...progress, quests: next } : progress;
}
