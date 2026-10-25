// Preferences and focus helpers shared by every screen.

export function applySettings(settings) {
  const root = document.documentElement;
  root.dataset.motion = settings.motion;
  root.dataset.textSize = settings.textSize;
}

export function prefersReducedMotion() {
  const setting = document.documentElement.dataset.motion;
  if (setting === 'reduce') return true;
  if (setting === 'full') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Polite announcements for changes that don't move focus.
export function announce(message) {
  const region = document.getElementById('announcer');
  if (!region) return;
  region.textContent = '';
  // A fresh text node after a tick makes repeat messages announce again.
  window.setTimeout(() => {
    region.textContent = message;
  }, 50);
}

export function focusElement(el) {
  if (!el) return;
  if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
    el.setAttribute('tabindex', '-1');
  }
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

// After a screen change, move focus to its main heading so keyboard and
// screen-reader users start at the new content.
export function focusMainHeading(container) {
  const heading = container.querySelector('h1');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
  window.scrollTo({ top: 0, behavior: 'auto' });
}
