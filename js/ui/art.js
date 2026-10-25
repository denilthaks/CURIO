// Static decorative illustrations (trusted markup, always aria-hidden).

export const HERO_ART = `
<svg class="hero-art" viewBox="0 0 400 300" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#132a4a"/>
      <stop offset="1" stop-color="#0b1626"/>
    </linearGradient>
  </defs>
  <rect width="400" height="300" rx="24" fill="url(#sky)"/>
  <g fill="#f6efe0" opacity=".85">
    <circle cx="48" cy="40" r="1.6"/><circle cx="120" cy="24" r="1.2"/><circle cx="300" cy="36" r="1.5"/>
    <circle cx="352" cy="70" r="1.1"/><circle cx="220" cy="18" r="1.3"/><circle cx="80" cy="88" r="1"/>
  </g>
  <circle cx="330" cy="62" r="22" fill="#f2b134" opacity=".9"/>
  <path d="M0 230 Q100 190 200 215 T400 205 V300 H0Z" fill="#0f3b3a"/>
  <path d="M0 255 Q120 225 220 248 T400 240 V300 H0Z" fill="#0c2f2e"/>
  <path class="trail" d="M60 300 C110 262 160 268 190 240 S250 205 300 196" fill="none" stroke="#f2b134" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round"/>
  <g fill="#14524f">
    <path d="M40 240 l18 -52 l18 52z"/><path d="M70 236 l14 -40 l14 40z"/>
    <path d="M330 222 l18 -54 l18 54z"/><path d="M362 226 l12 -36 l12 36z"/>
  </g>
  <g transform="translate(286 108)">
    <rect x="10" y="20" width="8" height="70" fill="#5b4a36"/>
    <rect x="-8" y="0" width="44" height="30" rx="4" fill="#f6efe0" stroke="#5b4a36" stroke-width="3"/>
    <path d="M0 10 h28 M0 18 h20" stroke="#8a7a62" stroke-width="2.5" stroke-linecap="round"/>
    <g class="signal" fill="none" stroke="#2dd4bf" stroke-width="3" stroke-linecap="round">
      <path d="M44 4 a14 14 0 0 1 0 22"/><path d="M52 -4 a24 24 0 0 1 0 38"/>
    </g>
  </g>
</svg>`;

export const NOTICEBOARD_ART = `
<svg class="noticeboard-art" viewBox="0 0 120 90" aria-hidden="true" focusable="false">
  <rect x="54" y="50" width="12" height="40" fill="#5b4a36"/>
  <rect x="10" y="8" width="100" height="52" rx="6" fill="#f6efe0" stroke="#5b4a36" stroke-width="4"/>
  <path d="M24 24 h56 M24 34 h70 M24 44 h40" stroke="#8a7a62" stroke-width="4" stroke-linecap="round"/>
  <g class="signal" fill="none" stroke="#2dd4bf" stroke-width="4" stroke-linecap="round">
    <path d="M100 2 a10 10 0 0 1 10 10"/><path d="M100 -8 a20 20 0 0 1 20 20"/>
  </g>
</svg>`;
