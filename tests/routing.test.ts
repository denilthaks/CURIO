// The identity screen remembers which quest the player chose (regression:
// "Begin the quest" used to open The Missing Signal whatever was chosen).
import { describe, expect, test } from 'vitest';
import { FIRST_QUEST, afterIdentityPath, identityRedirect, parseHash } from '../src/app/router';
import * as progression from '../src/engine/progression';
import * as store from '../src/engine/progress-store';
import { loadAllQuests, loadWorld, memoryStorage } from './helpers';

const quests = loadAllQuests();
const world = loadWorld();
const exists = (id: string) => quests.has(id);

describe('identity screen routing', () => {
  test('the identity screen route can carry the chosen quest', () => {
    expect(parseHash('#/start')).toEqual({ name: 'start' });
    expect(parseHash('#/start/market-ledger')).toEqual({ name: 'start', next: 'market-ledger' });
    expect(parseHash('#/start/Bad Id')).toEqual({ name: 'home' }); // only valid ids are accepted
  });
  test('opening a quest, its results or a practice round without an identity remembers that quest', () => {
    expect(identityRedirect({ name: 'quest', id: 'market-ledger' })).toBe('/start/market-ledger');
    expect(identityRedirect({ name: 'complete', id: 'market-ledger' })).toBe('/start/market-ledger');
    expect(identityRedirect({ name: 'practice', id: 'market-ledger', scene: 'find-cell' })).toBe('/start/market-ledger');
    expect(identityRedirect({ name: 'map', id: null })).toBeNull();
  });
  test('"Begin the quest" returns to the chosen quest; without a valid choice it opens the first quest', () => {
    expect(afterIdentityPath('market-ledger', exists)).toBe('/quest/market-ledger');
    expect(afterIdentityPath(undefined, exists)).toBe(`/quest/${FIRST_QUEST}`);
    expect(afterIdentityPath('no-such-quest', exists)).toBe(`/quest/${FIRST_QUEST}`);
    expect(quests.has(FIRST_QUEST)).toBe(true);
  });
  test('regression: a save with progress but no player reaches the Merchant’s Ledger after choosing it', () => {
    const p = store.createProgressStore(memoryStorage({ [store.STORAGE_KEY]: JSON.stringify({
      version: 4, player: null, achievements: [], lessons: [], settings: {}, concepts: {},
      quests: { 'missing-signal': { run: null, runXp: 0, lastRun: null, lastXp: 60, bestXp: 60, bestStars: 3, completed: true, completions: 1, mastered: true, bestMastery: null, bestMedal: 'none', bestSilver: 0 } },
    }) })).load();
    const start = parseHash(`#${identityRedirect({ name: 'quest', id: 'market-ledger' })}`);
    expect(start.name === 'start' && start.next).toBe('market-ledger');
    const target = afterIdentityPath(start.name === 'start' ? start.next : undefined, exists);
    expect(target).toBe('/quest/market-ledger');
    const market = world.destinations.find((d) => d.id === 'trading-market')!;
    expect(progression.questStatus(quests.get('market-ledger')!, market, store.withPlayer(p, 'Friend', 'owl'))).toBe('available');
  });
  test('a locked choice is still guarded after the identity screen (no skipping ahead)', () => {
    const fresh = store.withPlayer(store.defaultProgress(), 'New', 'fox');
    const hall = world.destinations.find((d) => d.id === 'great-hall')!;
    expect(afterIdentityPath('great-hall-dashboard', exists)).toBe('/quest/great-hall-dashboard');
    expect(progression.destinationStatus(hall, quests, fresh)).toBe('locked'); // the route guard then sends the player to the map
  });
});
