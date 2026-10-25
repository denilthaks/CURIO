// Hash-based routing works on GitHub Pages without any server rewrites.

const ROUTES = [
  { name: 'home', pattern: /^\/?$/ },
  { name: 'start', pattern: /^\/start$/ },
  { name: 'map', pattern: /^\/map$/ },
  { name: 'quest', pattern: /^\/quest\/([a-z0-9-]+)$/ },
  { name: 'complete', pattern: /^\/complete\/([a-z0-9-]+)$/ },
];

export function parseHash(hash) {
  const path = (hash || '').replace(/^#/, '') || '/';
  for (const route of ROUTES) {
    const match = path.match(route.pattern);
    if (match) return { name: route.name, id: match[1] || null };
  }
  return { name: 'home', id: null, unknown: true };
}

export function navigate(path) {
  const target = `#${path}`;
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = target;
}

export function startRouter(onRoute) {
  const handle = () => onRoute(parseHash(location.hash));
  window.addEventListener('hashchange', handle);
  handle();
}
