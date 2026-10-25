// Destination and quest states derived purely from saved progress + world data.
// The same functions drive the 3D markers, the accessible list and the HUD.

import type { Destination, Quest, World } from './types';
import type { Progress } from './progress-store';
import { questRecord } from './progress-store';

export type QuestStatus = 'locked' | 'available' | 'in-progress' | 'completed';
export type DestinationStatus = QuestStatus | 'planned';

export function isQuestCompleted(progress: Progress, questId: string): boolean {
  return questRecord(progress, questId).completed;
}

export function isDestinationUnlocked(destination: Destination, progress: Progress): boolean {
  if (destination.unlockedBy === 'planned') return false;
  return destination.unlockedBy.every((id) => isQuestCompleted(progress, id));
}

export function questStatus(quest: Quest, destination: Destination, progress: Progress): QuestStatus {
  if (!isDestinationUnlocked(destination, progress)) return 'locked';
  // Within a destination, quests unlock in order.
  const index = destination.quests.indexOf(quest.id);
  if (index > 0 && !isQuestCompleted(progress, destination.quests[index - 1])) return 'locked';
  const record = questRecord(progress, quest.id);
  // An unfinished run (a first attempt or a replay) takes precedence.
  if (record.run && !record.run.completed) return 'in-progress';
  if (record.completed) return 'completed';
  return 'available';
}

export function destinationStatus(destination: Destination, quests: Map<string, Quest>, progress: Progress): DestinationStatus {
  if (destination.unlockedBy === 'planned') return 'planned';
  if (!isDestinationUnlocked(destination, progress)) return 'locked';
  const statuses = destination.quests.map((id) => {
    const quest = quests.get(id);
    return quest ? questStatus(quest, destination, progress) : 'locked';
  });
  if (statuses.every((s) => s === 'completed')) return 'completed';
  if (statuses.some((s) => s === 'in-progress')) return 'in-progress';
  return 'available';
}

/** The quest a destination's main button should open, or null. */
export function nextQuestAt(destination: Destination, quests: Map<string, Quest>, progress: Progress): Quest | null {
  for (const id of destination.quests) {
    const quest = quests.get(id);
    if (!quest) continue;
    const status = questStatus(quest, destination, progress);
    if (status === 'available' || status === 'in-progress') return quest;
  }
  return null;
}

export function unlockRequirement(destination: Destination, quests: Map<string, Quest>, progress: Progress): string {
  if (destination.unlockedBy === 'planned') return 'Planned for a future update. There is no playable quest here yet.';
  const missing = destination.unlockedBy.filter((id) => !isQuestCompleted(progress, id));
  if (!missing.length) return '';
  const names = missing.map((id) => quests.get(id)?.title ?? id);
  return `Complete ${names.map((n) => `“${n}”`).join(' and ')} to unlock.`;
}

export function destinationForQuest(world: World, questId: string): Destination | undefined {
  return world.destinations.find((d) => d.quests.includes(questId));
}

/** Destinations that become available because this quest was just completed. */
export function newlyUnlocked(world: World, before: Progress, after: Progress): Destination[] {
  return world.destinations.filter((d) => !isDestinationUnlocked(d, before) && isDestinationUnlocked(d, after));
}
