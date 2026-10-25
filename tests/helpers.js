import { readFileSync } from 'node:fs';

export function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

export function loadQuest() {
  return readJson('data/quests/missing-signal.json');
}

export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data,
  };
}
