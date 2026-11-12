// Offline original artwork. No packages, network, fonts or raster assets.
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const LABEL = '\uC608\uC2DC \uC0AC\uC9C4 \u00B7 \uC2E4\uC81C \uB9E4\uBB3C \uC544\uB2D8';
const palettes = [
  ['#dad6cb', '#bab5a9', '#748889', '#b9cbd0', '밝은 석재'],
  ['#c0c9cc', '#8b999f', '#456574', '#a9c4ce', '은회색 금속'],
  ['#b88770', '#835e50', '#53686c', '#b9cecc', '적갈색 벽돌'],
  ['#e4e2dc', '#b9bab5', '#72868e', '#c6d7dc', '아이보리 콘크리트'],
  ['#707e81', '#4d5c60', '#3b535e', '#99b9c4', '짙은 회색 패널'],
  ['#c6b69a', '#9b876b', '#6a7c7c', '#b9cdcd', '베이지 석재'],
  ['#c0c5ba', '#919b8f', '#627a78', '#bad1c9', '회녹색 석재'],
  ['#aca3a0', '#827873', '#4f6876', '#b3c9d2', '회갈색 벽돌'],
];
const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;

function facade(index) {
  const [stone, side, glass, light] = palettes[index % palettes.length];
  const floors = 4 + index % 7, cols = 4 + index % 3;
  const width = 334 + (index % 4) * 25, height = 170 + floors * 30;
  const x = 480 - width / 2 - 28, y = 588 - height, depth = 88 + index % 3 * 14;
  const seed = (n) => ((index + 3) * 73 + n * 37) % 101;
  const shapes = [];
  // Calm, lightly hazed neighborhood context, with no real location references.
  for (let n = 0; n < 9; n++) {
    const cx = n * 126 - 32, ch = 108 + seed(n) * 2;
    shapes.push(rect(cx, 590 - ch, 98, ch, n % 2 ? '#c8d0ce' : '#d1d7d3'));
    for (let r = 0; r < ch / 28 - 1; r++) for (let c = 0; c < 4; c++) shapes.push(rect(cx + 12 + c * 20, 603 - ch + r * 28, 10, 16, '#b0bfbd', 'opacity=".55"'));
  }
  const windows = [], sideWindows = [];
  const pitch = (width - 38) / cols, rowH = (height - 84) / (floors - 1);
  for (let floor = 0; floor < floors - 1; floor++) {
    const wy = y + 28 + floor * rowH;
    for (let col = 0; col < cols; col++) {
      const wx = x + 22 + col * pitch, ww = pitch - (index % 3 === 0 ? 12 : 18), wh = rowH - 12;
      windows.push(rect(wx - 3, wy - 3, ww + 6, wh + 6, side, 'opacity=".65"'));
      windows.push(rect(wx, wy, ww, wh, 'url(#glass)'));
      windows.push(`<path d="M${wx + 2} ${wy + wh * .76}L${wx + ww - 2} ${wy + wh * .12}V${wy + 2}H${wx + 2}Z" fill="${light}" opacity=".${25 + seed(floor + col) % 25}"/>`);
      windows.push(rect(wx + ww * .54, wy, 2, wh, '#435c65', 'opacity=".65"'));
      windows.push(rect(wx - 3, wy + wh + 2, ww + 6, 3, '#f4f0e7', 'opacity=".6"'));
      if (seed(floor * cols + col) > 76) windows.push(rect(wx + 2, wy + 2, ww * .5, wh * .28, '#e7e0d1', 'opacity=".52"'));
    }
    sideWindows.push(rect(x + width + 18, wy, depth - 34, rowH - 12, glass));
    sideWindows.push(rect(x + width + 21, wy + 2, 3, rowH - 17, light, 'opacity=".5"'));
  }
  const retail = [];
  const groundY = 525, unitW = (width - 32) / 3;
  for (let n = 0; n < 3; n++) {
    const rx = x + 16 + n * unitW;
    retail.push(rect(rx, groundY, unitW - 8, 61, '#354c55'));
    retail.push(rect(rx + 3, groundY + 4, unitW - 14, 51, 'url(#retail)'));
    retail.push(rect(rx + unitW * .53, groundY + 3, 2, 56, '#c3c6bc'));
    retail.push(rect(rx + 10, groundY + 31, unitW * .5, 2, '#a9b5af', 'opacity=".6"'));
    // Generic, abstract sign strokes; no brand name or real business.
    retail.push(rect(rx, groundY - 18, unitW - 8, 14, n === 1 ? '#6b7c70' : '#ede8dc'));
    for (let t = 0; t < 5; t++) retail.push(rect(rx + 10 + t * 8, groundY - 13, t % 2 ? 4 : 6, 4, n === 1 ? '#e1e6d9' : '#73827d'));
  }
  const seams = [];
  for (let r = 0; r < height / 16; r++) seams.push(`<path d="M${x} ${y + r * 16}h${width}" stroke="${side}" stroke-width=".7" opacity=".3"/>`);
  for (let c = 1; c < 7; c++) seams.push(`<path d="M${x + c * width / 7} ${y}v${height}" stroke="${side}" stroke-width=".5" opacity=".22"/>`);
  const trees = [x - 58, x + width + depth + 40].map((tx, n) => `<g><path d="M${tx} 618V510m0 34l-14-19m14 8l16-18" fill="none" stroke="#7b8272" stroke-width="5"/><g fill="${n ? '#7e9782' : '#8ca28a'}"><ellipse cx="${tx - 12}" cy="510" rx="25" ry="35"/><ellipse cx="${tx + 13}" cy="497" rx="27" ry="40"/><ellipse cx="${tx - 4}" cy="482" rx="25" ry="32"/></g><ellipse cx="${tx + 9}" cy="485" rx="18" ry="27" fill="#a5b69a" opacity=".55"/>${rect(tx - 25, 612, 50, 7, '#a9afa3')}</g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720" role="img" aria-labelledby="title desc">
<title id="title">Original synthetic facade illustration ${index + 1}</title><desc id="desc">An imagined ${floors}-storey commercial facade. Architectural illustration, not a photograph or a real property.</desc>
<defs>
<linearGradient id="sky" x2="0" y2="1"><stop stop-color="#b5cbd6"/><stop offset="1" stop-color="#edf0e8"/></linearGradient>
<linearGradient id="glass" x2=".7" y2="1"><stop stop-color="${light}"/><stop offset=".45" stop-color="${glass}"/><stop offset="1" stop-color="#627b80"/></linearGradient>
<linearGradient id="retail" x2="1" y2="1"><stop stop-color="#819597"/><stop offset=".5" stop-color="#435e64"/><stop offset="1" stop-color="#bdc4b4"/></linearGradient>
<linearGradient id="edge"><stop stop-color="${side}"/><stop offset="1" stop-color="${glass}"/></linearGradient>
<linearGradient id="wash" x2="1" y2=".3"><stop stop-color="#ffffff" stop-opacity=".15"/><stop offset="1" stop-color="#17283b" stop-opacity=".06"/></linearGradient>
</defs>
${rect(0, 0, 960, 720, 'url(#sky)')}
<path d="M50 159q90-27 180-7m410-54q90-22 215 5" stroke="#f2f4ef" stroke-width="20" stroke-linecap="round" opacity=".4"/>
${shapes.join('')}
${rect(0, 586, 960, 80, '#c1c5bd')}${rect(0, 639, 960, 81, '#939fa0')}
<path d="M0 641H960M0 646H960" stroke="#e3e5dd" stroke-width="2"/>
<path d="M0 681H960" stroke="#d2d6d0" stroke-width="3" stroke-dasharray="90 52"/>
<path d="M${x - 42} 604l${width + 136} -9 148 37H${x + 30}Z" fill="#475c5e" opacity=".16"/>
<g transform="translate(20 0) skewY(-2)">
<path d="M${x + width} ${y}l${depth} -28v${height}l-${depth} 28Z" fill="url(#edge)"/>
<g transform="translate(0 ${((x + width) * 28 / depth).toFixed(3)}) skewY(${(-Math.atan(28 / depth) * 180 / Math.PI).toFixed(3)})">${sideWindows.join('')}</g>
${rect(x, y, width, height, stone)}${seams.join('')}
${index % 3 === 1 ? rect(x + width * .72, y + 10, width * .2, height - 80, side, 'opacity=".38"') : ''}
${windows.join('')}${rect(x, 503, width, 85, side)}${retail.join('')}
${rect(x - 6, y - 7, width + 12, 9, '#ede9df')}
<path d="M${x - 6} ${y - 7}l${depth} -28h${width + 12}l-${depth} 28Z" fill="#c7ccc3"/>
${rect(x + 28, y - 20, 55, 12, '#acb7b1')}${rect(x + width - 74, y - 24, 43, 16, '#a4b1ad')}
${rect(x - 9, 588, width + 18, 6, '#dcded5')}${rect(x - 15, 596, width + 30, 5, '#b0b7ae')}
${rect(x + 8, 571, 36, 17, '#8b9988')}${rect(x + 11, 562, 30, 12, '#718c72', 'rx="5"')}
${rect(x + width - 43, 571, 32, 17, '#8b9988')}${rect(x + width - 41, 560, 28, 14, '#78957a', 'rx="5"')}
</g>
${trees}
<g transform="translate(${118 + index % 4 * 142} 625)"><ellipse cx="45" cy="24" rx="56" ry="6" fill="#435458" opacity=".2"/><path d="M0 6l14-7 14-15h39L85 0l18 6v14H0Z" fill="${index % 2 ? '#dce2de' : '#728992'}"/><path d="M31-13h17V0H20Zm20 0h14L80 0H51Z" fill="#536a75"/><circle cx="20" cy="20" r="8" fill="#47565b"/><circle cx="82" cy="20" r="8" fill="#47565b"/><circle cx="20" cy="20" r="4" fill="#b3bfbc"/><circle cx="82" cy="20" r="4" fill="#b3bfbc"/></g>
${rect(0, 0, 960, 720, 'url(#wash)')}
<text x="26" y="32" fill="#415866" font-family="sans-serif" font-size="11" letter-spacing="3">FACADE STUDY / ${String(index + 1).padStart(2, '0')}</text>
<text x="934" y="700" text-anchor="end" fill="#354e58" font-family="sans-serif" font-size="10" letter-spacing="2">ILLUSTRATION · SYNTHETIC</text>
</svg>\n`;
}

export function generatePhotos() {
  const files = new Map(), photos = [];
  for (let i = 0; i < 32; i++) {
    const id = `facade-${String(i + 1).padStart(2, '0')}`, file = `${id}.svg`;
    files.set(file, facade(i));
    photos.push({ id, file, kind: 'generated', width: 960, height: 720,
      alt: `\uC608\uC2DC \uAC74\uCD95 \uC77C\uB7EC\uC2A4\uD2B8\u00B7 ${palettes[i % palettes.length][4]} \uC678\uBCBD\uACFC \uC720\uB9AC \uC0C1\uAC00`,
      label: LABEL, author: 'PLOT OS procedural illustration generator', sourceUrl: null,
      license: 'CC0-1.0', licenseNotes: 'Original generated SVG artwork dedicated under CC0-1.0. No third-party imagery, brands or actual building references. Does not depict the assigned building.' });
  }
  const manifest = { version: 1, label: LABEL, generator: 'tools/gen-photos.mjs',
    notes: 'Offline architectural illustrations, shared deterministically across synthetic records. Geometry, storeys, materials and views are illustrative, not property evidence.', photos };
  files.set('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  files.set('../../js/photo-catalog.js', `// Generated by tools/gen-photos.mjs; do not edit. Mirrors assets/photos/manifest.json.\nexport const EXAMPLE_PHOTO_LABEL = ${JSON.stringify(LABEL)};\nexport const PHOTO_CATALOG = ${JSON.stringify(photos, null, 2)};\n`);
  files.set('LICENSES.md', `# Generated example imagery\n\nAll 32 facade SVGs are original procedural architectural illustrations generated by \`tools/gen-photos.mjs\` using Node built-ins. No downloaded photographs, third-party assets, real brands or identifiable building references are used.\n\n- Author: PLOT OS procedural illustration generator.\n- License: CC0-1.0 dedication for these generated SVG illustrations.\n- Source URL: not applicable (generated locally). Per-file metadata is in \`manifest.json\`.\n- Disclosure: ${LABEL}. These illustrations do not depict the selected building; facade, floors, materials and viewpoints must not be interpreted as listing facts. Gallery entries are different facade studies, not multiple photographs of one property.\n- Rebuild from repository root: \`node tools/gen-photos.mjs\`. Stable inputs produce byte-identical SVG, manifest and catalog files. No network or packages required.\n`);
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = new URL('../web-v2/assets/photos/', import.meta.url);
  mkdirSync(output, { recursive: true });
  for (const [file, content] of generatePhotos()) writeFileSync(new URL(file, output), content, 'utf8');
  console.log('Generated 32 original SVG facades, manifest, catalog and license notes.');
}
