import { readFileSync } from 'node:fs';
import type { Quest, World } from '../src/engine/types';
import type { StorageLike } from '../src/engine/progress-store';

export function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')) as T;
}

export const QUEST_IDS = ['missing-signal', 'the-ledger', 'broken-tally', 'market-ledger', 'great-hall-dashboard', 'star-chart'];

export function loadQuest(id = 'missing-signal'): Quest {
  return readJson<Quest>(`public/data/quests/${id}.json`);
}

export function loadAllQuests(): Map<string, Quest> {
  return new Map(QUEST_IDS.map((id) => [id, loadQuest(id)]));
}

export function loadWorld(): World {
  return readJson<World>('public/data/world.json');
}

export function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key)! : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    data,
  };
}
