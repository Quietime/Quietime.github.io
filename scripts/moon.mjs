// Quietime moon mark, rebuilt as layered vector so every layer can move.
// Structure (back to front):
//   9 wave bands (shadow side)  -> clipped by the moon disc
//   9 wave bands (lit side)     -> clipped by disc ∩ the "lit" circle
//   highlight ellipse
// Bands are periodic every 300 units, so translating a band by -300 loops seamlessly.

const P = 300; // wave period
const BANDS = [
  // top y, amplitude, phase, second harmonic amplitude
  [44, 0, 0, 0],
  [112, 16, 40, 6],
  [178, 22, 150, 8],
  [238, 20, 90, 7],
  [300, 24, 210, 9],
  [356, 20, 30, 6],
  [412, 22, 260, 8],
  [466, 18, 120, 7],
  [520, 16, 190, 6],
];

function wavePath([y0, a, ph, a2]) {
  const pts = [];
  for (let x = -320; x <= 940; x += 12) {
    const t = ((x + ph) / P) * Math.PI * 2;
    const y = y0 + a * Math.sin(t) + a2 * Math.sin(t * 2 + 1.3);
    pts.push(`${x.toFixed(0)} ${y.toFixed(1)}`);
  }
  return `M${pts.join(' L')} L940 640 L-320 640 Z`;
}

export const moonBands = BANDS.map(wavePath);

/**
 * @param {object} o
 * @param {string} o.id unique id prefix (needed when several moons share a page)
 * @param {string} [o.cls] extra class
 * @param {string} [o.label] accessible label; omit for decorative use
 */
export function moonSVG({ id = 'm', cls = '', label = '' } = {}) {
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"';
  const dark = moonBands
    .map((d, i) => `<path class="mb mb${i}" data-band="${i}" d="${d}" fill="var(--m-d${i})"/>`)
    .join('');
  const lit = moonBands
    .map((d, i) => `<path class="mb mb${i}" data-band="${i}" d="${d}" fill="var(--m-l${i})"/>`)
    .join('');
  return `<svg class="moon ${cls}" viewBox="0 0 600 600" ${a11y}>
<defs>
<clipPath id="${id}-disc"><circle cx="300" cy="300" r="290"/></clipPath>
<clipPath id="${id}-lit"><circle class="moon-litc" cx="128" cy="96" r="292"/></clipPath>
</defs>
<g clip-path="url(#${id}-disc)">
<rect x="0" y="0" width="600" height="600" fill="var(--m-d0)"/>
<g class="moon-dark">${dark}</g>
<g class="moon-lit" clip-path="url(#${id}-lit)"><rect x="0" y="0" width="600" height="600" fill="var(--m-l0)"/>${lit}</g>
<ellipse class="moon-hl" cx="186" cy="120" rx="40" ry="30" transform="rotate(-28 186 120)" fill="var(--m-hl)"/>
</g>
</svg>`;
}
