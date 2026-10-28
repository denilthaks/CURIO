// Hash routes work on GitHub Pages without server rewrites.

import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'start'; next?: string }
  | { name: 'map'; id: string | null }
  | { name: 'quest'; id: string }
  | { name: 'complete'; id: string }
  | { name: 'practice'; id: string; scene: string }
  | { name: 'progress' };

export function parseHash(hash: string): Route {
  const path = (hash || '').replace(/^#/, '') || '/';
  let m: RegExpMatchArray | null;
  if (path === '/' || path === '') return { name: 'home' };
  if (path === '/start') return { name: 'start' };
  if ((m = path.match(/^\/start\/([a-z0-9-]+)$/))) return { name: 'start', next: m[1] };
  if (path === '/progress') return { name: 'progress' };
  if ((m = path.match(/^\/map(?:\/([a-z0-9-]+))?$/))) return { name: 'map', id: m[1] ?? null };
  if ((m = path.match(/^\/quest\/([a-z0-9-]+)$/))) return { name: 'quest', id: m[1] };
  if ((m = path.match(/^\/complete\/([a-z0-9-]+)$/))) return { name: 'complete', id: m[1] };
  if ((m = path.match(/^\/practice\/([a-z0-9-]+)\/([a-z0-9-]+)$/))) return { name: 'practice', id: m[1], scene: m[2] };
  return { name: 'home' };
}

/** The quest a new player is sent to when they did not choose one. */
export const FIRST_QUEST = 'missing-signal';

/**
 * A player without an identity who opens a quest (or its results or a practice
 * round) goes to the identity screen first, remembering which quest they chose.
 */
export function identityRedirect(route: Route): string | null {
  if (route.name === 'quest' || route.name === 'complete' || route.name === 'practice') return `/start/${route.id}`;
  return null;
}

/**
 * Where "Begin the quest" leads: the quest the player chose, if it exists;
 * otherwise the first quest. Lock rules still apply on arrival (the route
 * guard sends a locked quest back to its place on the map).
 */
export function afterIdentityPath(next: string | undefined, questExists: (id: string) => boolean): string {
  return next && questExists(next) ? `/quest/${next}` : `/quest/${FIRST_QUEST}`;
}

export function navigate(path: string, { replace = false } = {}) {
  const target = `#${path}`;
  if (location.hash === target) return;
  if (replace) {
    history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = target;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const handle = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', handle);
    return () => window.removeEventListener('hashchange', handle);
  }, []);
  return route;
}
