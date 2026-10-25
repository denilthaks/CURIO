// Browser-side progress. localStorage is user-controlled, so everything read
// back is treated as untrusted: migrated, validated and clamped. Suitable for
// a personal prototype, not for accounts or trusted scores.

export const STORAGE_KEY = 'curiotrail.progress';
export const SCHEMA_VERSION = 1;
export const EMBLEMS = ['fox', 'owl', 'deer', 'badger'];
export const MAX_NAME_LENGTH = 24;
const MAX_XP = 100000;

export function defaultSettings() {
  return { motion: 'system', textSize: 'normal' };
}

export function defaultProgress() {
  return { version: SCHEMA_VERSION, player: null, quests: {}, achievements: [], settings: defaultSettings() };
}

function clampInt(value, max = MAX_XP) {
  return Number.isInteger(value) && value > 0 ? Math.min(value, max) : 0;
}

export function cleanName(value) {
  if (typeof value !== 'string') return '';
  // Drop control characters; the UI always renders names as text, never HTML.
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME_LENGTH);
}

function sanitizePlayer(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    name: cleanName(raw.name) || 'Pathfinder',
    emblem: EMBLEMS.includes(raw.emblem) ? raw.emblem : EMBLEMS[0],
  };
}

function sanitizeSettings(raw) {
  const settings = defaultSettings();
  if (raw && typeof raw === 'object') {
    if (['system', 'reduce', 'full'].includes(raw.motion)) settings.motion = raw.motion;
    if (['normal', 'large'].includes(raw.textSize)) settings.textSize = raw.textSize;
  }
  return settings;
}

function sanitizeQuestRecord(id, raw) {
  if (!raw || typeof raw !== 'object') return null;
  // The run itself is checked against the quest content by restoreRun().
  const ownRun = (value) => (value && typeof value === 'object' && value.questId === id ? value : null);
  const run = ownRun(raw.run);
  const lastRun = ownRun(raw.lastRun);
  return {
    run,
    runXp: run ? clampInt(raw.runXp) : 0,
    lastRun,
    lastXp: lastRun ? clampInt(raw.lastXp) : 0,
    bestXp: clampInt(raw.bestXp),
    completed: raw.completed === true,
    completions: clampInt(raw.completions, 9999),
  };
}

// Upgrade older saves to the current shape. Add a case per schema change.
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const data = { ...raw };
  if (!Number.isInteger(data.version)) return null;
  if (data.version > SCHEMA_VERSION) return null; // saved by a newer release
  // e.g. if (data.version === 1) { ...transform...; data.version = 2; }
  return data;
}

export function sanitizeProgress(raw) {
  const data = migrate(raw);
  if (!data) return defaultProgress();
  const quests = {};
  if (data.quests && typeof data.quests === 'object' && !Array.isArray(data.quests)) {
    for (const [id, record] of Object.entries(data.quests)) {
      if (!/^[a-z0-9-]{1,64}$/.test(id)) continue;
      const clean = sanitizeQuestRecord(id, record);
      if (clean) quests[id] = clean;
    }
  }
  const achievements = Array.isArray(data.achievements)
    ? [...new Set(data.achievements.filter((a) => typeof a === 'string' && /^[a-z0-9-]{1,64}$/.test(a)))]
    : [];
  return {
    version: SCHEMA_VERSION,
    player: sanitizePlayer(data.player),
    quests,
    achievements,
    settings: sanitizeSettings(data.settings),
  };
}

function browserStorage() {
  try {
    const storage = globalThis.localStorage;
    const probe = '__curiotrail_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null; // private mode, blocked cookies, or no window
  }
}

export function createProgressStore(storage = browserStorage()) {
  return {
    available: Boolean(storage),
    load() {
      if (!storage) return defaultProgress();
      try {
        const text = storage.getItem(STORAGE_KEY);
        return text ? sanitizeProgress(JSON.parse(text)) : defaultProgress();
      } catch {
        return defaultProgress(); // corrupted JSON
      }
    },
    save(progress) {
      if (!storage) return false;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(progress));
        return true;
      } catch {
        return false; // quota exceeded or storage revoked
      }
    },
    reset() {
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

export function questRecord(progress, questId) {
  return (
    progress.quests[questId] || { run: null, runXp: 0, lastRun: null, lastXp: 0, bestXp: 0, completed: false, completions: 0 }
  );
}

export function withPlayer(progress, name, emblem) {
  return { ...progress, player: sanitizePlayer({ name, emblem }) };
}

export function withSettings(progress, settings) {
  return { ...progress, settings: sanitizeSettings({ ...progress.settings, ...settings }) };
}

export function withRun(progress, run, runXp) {
  const record = questRecord(progress, run.questId);
  return { ...progress, quests: { ...progress.quests, [run.questId]: { ...record, run, runXp: clampInt(runXp) } } };
}

// Record a finished run. Replays keep the best score rather than stacking XP,
// so total XP reflects demonstrated skill, not repetition.
export function withCompletion(progress, run, xp, achievementId) {
  const record = questRecord(progress, run.questId);
  const quests = {
    ...progress.quests,
    [run.questId]: {
      run,
      runXp: clampInt(xp),
      lastRun: run,
      lastXp: clampInt(xp),
      bestXp: Math.max(record.bestXp, clampInt(xp)),
      completed: true,
      completions: record.completions + (record.run && record.run.completed ? 0 : 1),
    },
  };
  const achievements =
    achievementId && !progress.achievements.includes(achievementId)
      ? [...progress.achievements, achievementId]
      : progress.achievements;
  return { ...progress, quests, achievements };
}

export function withReplay(progress, questId) {
  const record = questRecord(progress, questId);
  return { ...progress, quests: { ...progress.quests, [questId]: { ...record, run: null, runXp: 0 } } };
}

export function totalXp(progress) {
  return Object.values(progress.quests).reduce((sum, r) => sum + Math.max(r.bestXp, r.runXp), 0);
}
