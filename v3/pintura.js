// Hand-painted vector art for the Talavera skin: line icons, plate decoration, mini dice and dialog emblems.
// Everything is emitted as self-contained inline SVG (no <use> or url(#id) references, which break under <base href>).

const icons = {
  play: '<path d="M7.5 4.8v14.4L19.4 12z" fill="currentColor"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="3.2"/>',
  sound: '<path d="M3.8 9.4h3.4l5-4.2v13.6l-5-4.2H3.8z" fill="currentColor"/><path d="M15.4 9.2a4 4 0 0 1 0 5.6M18.2 6.4a8 8 0 0 1 0 11.2"/>',
  mute: '<path d="M3.8 9.4h3.4l5-4.2v13.6l-5-4.2H3.8z" fill="currentColor"/><path d="M15.8 9.6l4.8 4.8M20.6 9.6l-4.8 4.8"/>',
  help: '<circle cx="12" cy="12" r="8.8"/><path d="M9.4 9.5a2.7 2.7 0 1 1 3.8 2.5c-.8.4-1.2 1-1.2 1.8v.6"/><circle cx="12" cy="17.1" r=".7" fill="currentColor"/>',
  book: '<path d="M12 6.6C10 5.1 7.1 4.6 3.6 5v13.1c3.5-.4 6.4.1 8.4 1.6 2-1.5 4.9-2 8.4-1.6V5c-3.5-.4-6.4.1-8.4 1.6zM12 6.6v13"/>',
  home: '<path d="M4 11.2 12 4.6l8 6.6M6.4 9.6v9.9h11.2V9.6M10 19.5v-4.6a2 2 0 0 1 4 0v4.6"/>',
  refresh: '<path d="M19.4 12.4a7.4 7.4 0 1 1-2.3-5.6M19.4 4.6v4.3h-4.3"/>',
  expand: '<path d="M4.6 9.2V4.6h4.6M14.8 4.6h4.6v4.6M19.4 14.8v4.6h-4.6M9.2 19.4H4.6v-4.6"/>',
  grid: '<rect x="4.4" y="4.4" width="15.2" height="15.2" rx="1.6"/><path d="M9.5 4.4v15.2M14.5 4.4v15.2M4.4 9.5h15.2M4.4 14.5h15.2"/>',
  target: '<circle cx="12" cy="12" r="6.4"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><path d="M12 2.6v3.6M12 17.8v3.6M2.6 12h3.6M17.8 12h3.6"/>',
  jar: '<path d="M8.8 3.6h6.4M9.6 3.6c0 2-2.4 2.5-2.4 4.4 0 .8.5 1.4.5 1.4-2 1.4-2.7 3.6-2.7 5.4 0 3.6 3.1 5.6 7 5.6s7-2 7-5.6c0-1.8-.7-4-2.7-5.4 0 0 .5-.6.5-1.4 0-1.9-2.4-2.4-2.4-4.4"/><path d="M7.6 14.6c2.9 1.3 5.9 1.3 8.8 0"/>',
  chisel: '<path d="M15.4 3.4 20.6 8.6l-3 3-5.2-5.2z"/><path d="M12.9 7.2l3.9 3.9-7.6 7.6-5.1 1.3 1.3-5.1z"/>',
  hourglass: '<path d="M6.6 3.6h10.8M6.6 20.4h10.8M8 3.6c0 4.2 4 5.4 4 8.4s-4 4.2-4 8.4M16 3.6c0 4.2-4 5.4-4 8.4s4 4.2 4 8.4"/>',
  check: '<path d="M5 12.6l4.4 4.4L19 7.4"/>',
  forward: '<path d="M6 6.5l5.5 5.5L6 17.5M12.5 6.5 18 12l-5.5 5.5"/>',
  undo: '<path d="M9.4 5.8 4.6 10.6l4.8 4.8M5 10.6h9.2a4.9 4.9 0 0 1 0 9.8H11"/>',
  download: '<path d="M12 3.6v11M7.6 10.2l4.4 4.4 4.4-4.4M4.6 16.6v2.8h14.8v-2.8"/>',
  store: '<path d="M4.2 9.6 5.7 4.6h12.6l1.5 5M4.2 9.6c0 1.4 1.1 2.4 2.6 2.4s2.6-1 2.6-2.4c0 1.4 1.1 2.4 2.6 2.4s2.6-1 2.6-2.4c0 1.4 1.1 2.4 2.6 2.4s2.6-1 2.6-2.4M5.8 12v7.8h12.4V12M10 19.8v-4.4h4v4.4"/>',
  flame: '<path d="M12 20.8c-3.5 0-5.9-2.4-5.9-5.5 0-3.5 3-5.3 3.5-8.9C12 7.9 13 9.9 13 11.4c.9-.6 1.5-1.8 1.5-3.4 2.4 1.9 3.4 4.5 3.4 7.3 0 3.1-2.4 5.5-5.9 5.5z"/>',
  exit: '<path d="M13.4 4.6H5.6v14.8h7.8M10 12h10M16.6 8.6 20 12l-3.4 3.4"/>',
  close: '<path d="M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8"/>',
};

export function icon(name, extra = '') {
  return `<svg class="ic${extra ? ` ${extra}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name] ?? ''}</svg>`;
}

// Replace every <i data-icon="name"> placeholder inside root with its inline SVG.
export function hydrateIcons(root = document) {
  for (const holder of root.querySelectorAll('i[data-icon]')) {
    const svg = document.createElement('template');
    svg.innerHTML = icon(holder.dataset.icon, holder.className);
    holder.replaceWith(svg.content.firstChild);
  }
}

// Majolica pigments, as they read once fired on tin glaze.
export const pigments = {
  cobalt: '#1d3e8e', copper: '#2e7a52', saffron: '#d99a1e', manganese: '#4d2b3c', orange: '#cf6a26', wash: '#7d98d2',
};

// Deterministic jitter so every plate looks hand-painted but stays identical between renders.
function seeded(seed) {
  let state = seed * 9301 + 49297;
  return () => ((state = (state * 9301 + 49297) % 233280) / 233280) - .5;
}

const round = value => Math.round(value * 100) / 100;

function waveRing(radius, amplitude, waves, jitter) {
  const points = [];
  for (let step = 0; step <= 180; step++) {
    const angle = step / 180 * Math.PI * 2;
    const r = radius + Math.sin(angle * waves) * amplitude + jitter() * .5;
    points.push(`${round(100 + Math.cos(angle) * r)} ${round(100 + Math.sin(angle) * r)}`);
  }
  return `M${points.join('L')}Z`;
}

const schemes = {
  main: { band: pigments.cobalt, vine: pigments.copper, dots: pigments.saffron, line: pigments.manganese, bloom: pigments.orange, seed: 3 },
  help: { band: pigments.copper, vine: pigments.cobalt, dots: pigments.saffron, line: pigments.manganese, bloom: pigments.saffron, seed: 7 },
  catalog: { band: pigments.manganese, vine: pigments.cobalt, dots: pigments.orange, line: pigments.manganese, bloom: pigments.copper, seed: 11 },
  victory: { band: pigments.saffron, vine: pigments.copper, dots: pigments.cobalt, line: pigments.manganese, bloom: pigments.orange, seed: 5 },
  defeat: { band: pigments.manganese, vine: pigments.orange, dots: pigments.cobalt, line: pigments.manganese, bloom: pigments.saffron, seed: 13 },
};

// A Talavera plate rim: scalloped band, vine with leaves and blossoms, bead ring and a clean central well.
export function plateArt(kind = 'main') {
  const { band, vine, dots, line, bloom, seed } = schemes[kind] ?? schemes.main;
  const jitter = seeded(seed);
  const parts = [
    `<circle cx="100" cy="100" r="97" fill="none" stroke="${line}" stroke-width="1.2" opacity=".55"/>`,
    `<circle cx="100" cy="100" r="89.5" fill="none" stroke="${band}" stroke-width="9.5" stroke-dasharray="7.6 4.11" opacity=".9"/>`,
    `<circle cx="100" cy="100" r="83.2" fill="none" stroke="${band}" stroke-width="1.3"/>`,
    `<path d="${waveRing(76.5, 3.4, 12, jitter)}" fill="none" stroke="${vine}" stroke-width="2.2" stroke-linecap="round"/>`,
  ];
  for (let index = 0; index < 24; index++) {
    const angle = index * 15 + 7.5 + jitter() * 3;
    const outward = index % 2 ? -1 : 1;
    parts.push(`<path d="M100 ${round(23.5 + outward * -1)}c${round(3 + jitter())} ${-4 * outward} ${round(2.6 + jitter())} ${-9 * outward} 0 ${-11.5 * outward}c-2.8 ${2.5 * outward}-3.2 ${7.4 * outward} 0 ${11.5 * outward}z" fill="${vine}" opacity=".88" transform="rotate(${round(angle)} 100 100)"/>`);
  }
  for (let index = 0; index < 12; index++) {
    const angle = index * 30 + jitter() * 2;
    parts.push(`<g transform="rotate(${round(angle)} 100 100)"><circle cx="100" cy="23.4" r="3.3" fill="${bloom}" opacity=".9"/><circle cx="100" cy="23.4" r="1.1" fill="${line}" opacity=".7"/></g>`);
  }
  parts.push(
    `<circle cx="100" cy="100" r="68.6" fill="none" stroke="${dots}" stroke-width="3.8" stroke-linecap="round" stroke-dasharray="0 7.18"/>`,
    `<circle cx="100" cy="100" r="63" fill="none" stroke="${band}" stroke-width="1.6"/>`,
    `<circle cx="100" cy="100" r="60.2" fill="none" stroke="${band}" stroke-width=".7" opacity=".55"/>`,
  );
  return `<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">${parts.join('')}</svg>`;
}

const pipSpots = [[], [[8, 8]], [[4.6, 4.6], [11.4, 11.4]], [[4.6, 4.6], [8, 8], [11.4, 11.4]],
  [[4.6, 4.6], [11.4, 4.6], [4.6, 11.4], [11.4, 11.4]], [[4.6, 4.6], [11.4, 4.6], [8, 8], [4.6, 11.4], [11.4, 11.4]],
  [[4.6, 4.2], [11.4, 4.2], [4.6, 8], [11.4, 8], [4.6, 11.8], [11.4, 11.8]]];

// A tiny glazed die face used by the combination sampler.
export function miniDie(value, glaze = '') {
  const fill = glaze || '#fbf5e8';
  const ink = glaze ? '#fff7e6' : pigments.manganese;
  return `<svg class="mini-die" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x=".7" y=".7" width="14.6" height="14.6" rx="3.2" fill="${fill}" stroke="${glaze ? 'rgba(0,0,0,.25)' : pigments.manganese}" stroke-width=".9"/>${
    pipSpots[value].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.45" fill="${ink}"/>`).join('')}</svg>`;
}

// Painted medallions for the outcome cartouche.
export function emblem(kind) {
  if (kind === 'victory') {
    const rays = Array.from({ length: 16 }, (_, index) => `<path d="M60 9 64 24H56z" fill="${index % 2 ? pigments.orange : pigments.saffron}" transform="rotate(${index * 22.5} 60 60)"/>`).join('');
    return `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">${rays}<circle cx="60" cy="60" r="30" fill="${pigments.saffron}"/><circle cx="60" cy="60" r="30" fill="none" stroke="${pigments.manganese}" stroke-width="1.6"/>
      <path d="M60 41 64.8 53.4 78 54.2 67.8 62.6 71.2 75.4 60 68.2 48.8 75.4 52.2 62.6 42 54.2 55.2 53.4z" fill="${pigments.cobalt}"/></svg>`;
  }
  // A plate split by a crack mended in gold (kintsugi): defeat is a repairable break, not an end.
  return `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false"><circle cx="60" cy="60" r="46" fill="#f6eedd" stroke="${pigments.manganese}" stroke-width="1.6"/>
    <circle cx="60" cy="60" r="38" fill="none" stroke="${pigments.cobalt}" stroke-width="5" stroke-dasharray="4.6 3.36"/><circle cx="60" cy="60" r="26" fill="none" stroke="${pigments.cobalt}" stroke-width="1.4"/>
    <path d="M58 14 54 33 63 45 51 60 62 74 56 90 61 106" fill="none" stroke="${pigments.manganese}" stroke-width="4.4" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M58 14 54 33 63 45 51 60 62 74 56 90 61 106" fill="none" stroke="#e6b443" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
